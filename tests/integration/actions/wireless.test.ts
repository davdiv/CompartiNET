import { afterEach, describe, expect, it } from "vitest";
import { commandForActions } from "../../../src/common/model/actions";
import { reconcile } from "../../../src/common/reconcile";
import { collectState } from "../../../src/node/collectState";
import { exec, runCommands } from "../../../src/node/spawnUtils";
import { normalizeModel } from "../../utils";
import { cleanupState, trackNetns } from "../harness";

let loadedHwsim = false;

const loadHwsim = async () => {
  try {
    await exec(["modprobe", "mac80211_hwsim", "radios=1"]);
    loadedHwsim = true;
    // Give the kernel a moment to create interfaces
    await new Promise((resolve) => setTimeout(resolve, 500));
  } catch {
    // mac80211_hwsim not available
  }
};

const unloadHwsim = async () => {
  if (loadedHwsim) {
    try {
      await exec(["modprobe", "-r", "mac80211_hwsim"]);
    } catch {
      // ignore cleanup errors
    }
    loadedHwsim = false;
  }
};

describe("integration / wireless actions", () => {
  afterEach(async () => {
    await cleanupState();
    await unloadHwsim();
  });

  it("collects state with phyName for wireless interfaces", async () => {
    await loadHwsim();
    if (!loadedHwsim) {
      return;
    }

    const state = await collectState();
    // Find any wireless interface with a phyName
    let foundWireless = false;
    for (const ns of Object.values(state.netnsById)) {
      for (const iface of Object.values(ns.interfaces)) {
        if (iface.type === "hardware" && (iface as { phyName?: string }).phyName) {
          foundWireless = true;
        }
      }
    }
    expect(foundWireless).toBe(true);
  });

  it("moves a wireless phy to another namespace via reconcile", async () => {
    await loadHwsim();
    if (!loadedHwsim) {
      return;
    }

    // Find the wireless interface created by mac80211_hwsim
    const actual = await collectState();
    let wlanIface = "";
    let wlanPhy = "";
    for (const [, ns] of Object.entries(actual.netnsById)) {
      for (const [ifaceName, iface] of Object.entries(ns.interfaces)) {
        if (iface.type === "hardware" && (iface as { phyName?: string }).phyName) {
          wlanIface = ifaceName;
          wlanPhy = (iface as { phyName?: string }).phyName ?? "";
        }
      }
    }
    expect(wlanIface).not.toBe("");
    expect(wlanPhy).not.toBe("");

    // Create a target namespace manually
    await exec(["ip", "netns", "add", "test-ns"]);
    trackNetns("test-ns");

    // Build desired state: wireless interface in test-ns
    const desired = structuredClone(actual);
    if (desired.netnsById[desired.namedNetns[""]].interfaces[wlanIface]) {
      const iface = desired.netnsById[desired.namedNetns[""]].interfaces[wlanIface];
      delete desired.netnsById[desired.namedNetns[""]].interfaces[wlanIface];
      desired.netnsById[desired.namedNetns["test-ns"]].interfaces[wlanIface] = iface;
    }

    // Reconcile
    const { actions, expectedModel, errors } = reconcile(actual, desired);
    expect(errors).toEqual([]);
    expect(normalizeModel(expectedModel)).toEqual(normalizeModel(desired));

    // Execute
    const commands = commandForActions(actions);
    await runCommands(commands);

    // Verify
    const after = await collectState();
    expect(normalizeModel(after)).toEqual(normalizeModel(desired));
  });
});
