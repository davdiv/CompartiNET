import { afterEach, describe, expect, it } from "vitest";
import { commandForAction } from "../../src/common/model/actions";
import { RealInterfaceModel } from "../../src/common/model/networkModel";
import { reconcile } from "../../src/common/reconcile";
import { collectState } from "../../src/node/collectState";
import { exec, runCommand } from "../../src/node/spawnUtils";
import { normalizeModel } from "../utils";
import { cleanupState } from "./harness";

describe("integration / full reconcile", () => {
  afterEach(cleanupState);

  it("reconciles namespace, interface state, address and route end-to-end", async () => {
    // 1. Create a namespace manually so the reconciler sees the existing lo interface
    await exec(["ip", "netns", "add", "test-ns"]);

    // 2. Collect the actual system state (now includes test-ns with lo down)
    const { state: actual } = await collectState();

    // 3. Build desired state: bring lo up, add an IP, add a route
    const desired = structuredClone(actual);
    const testNs = desired.netnsByIno[desired.namedNetns["test-ns"]];
    (testNs.interfaces["lo"] as RealInterfaceModel).up = true;
    (testNs.interfaces["lo"] as RealInterfaceModel).addresses = [
      { family: "ipv4", address: "10.0.0.1", prefixLength: 32 },
      { family: "ipv4", address: "127.0.0.1", prefixLength: 8 },
      { family: "ipv6", address: "::1", prefixLength: 128 },
    ];
    testNs.routes = [{ family: "ipv4", address: "10.0.0.0", prefixLength: 8, iface: "lo" }];

    // 4. Reconcile
    const { actions, expectedModel, errors } = reconcile(actual, desired);
    expect(errors).toEqual([]);
    expect(normalizeModel(expectedModel)).toEqual(normalizeModel(desired));

    // 5. Execute all generated commands
    for (const action of actions) {
      const command = commandForAction(action);
      await runCommand(command);
    }

    // 6. Collect state after execution
    const { state: after } = await collectState();

    // 7. Assert the real system matches the desired model
    expect(normalizeModel(after)).toEqual(normalizeModel(desired));
  });
});
