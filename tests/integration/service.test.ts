import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { signal } from "signalium";
import { afterEach, describe, expect, it } from "vitest";
import { collectState } from "../../src/node/collectState";
import type { Feature } from "../../src/node/features";
import { createReconciler } from "../../src/node/reconciler";
import { cleanupState } from "./harness";

describe("integration / service", () => {
  afterEach(cleanupState);

  it("full service loop: config dir to apply to verify", async () => {
    const tmpDir = mkdtempSync("/tmp/compartinet-test-");
    writeFileSync(join(tmpDir, "10-namespace.json"), JSON.stringify({ type: "CreateNamespace", netns: "svc-ns" }));
    writeFileSync(join(tmpDir, "20-bridge.json"), JSON.stringify({ type: "CreateBridge", netns: "svc-ns", iface: "br0", vlanFiltering: false, stp: false }));

    const features$ = signal<Feature[]>([{ type: "ConfigDirectory", path: tmpDir }]);
    const reconciler = createReconciler(() => features$.value);

    const unsub = reconciler.watcher.addListener(() => {});
    await reconciler.applyReconciliation();
    unsub();

    const { state } = await collectState();
    expect(Object.keys(state.namedNetns)).toContain("svc-ns");
    const svcNs = state.netnsByIno[state.namedNetns["svc-ns"]];
    expect(Object.keys(svcNs.interfaces)).toContain("br0");
    expect(svcNs.interfaces["br0"].type).toBe("bridge");
  });

  it("nested ConfigDirectory loads from referenced folder", async () => {
    const tmpDir = mkdtempSync("/tmp/compartinet-test-");
    const nestedDir = mkdtempSync("/tmp/compartinet-test-nested-");

    writeFileSync(join(tmpDir, "main.json"), JSON.stringify({ type: "ConfigDirectory", path: nestedDir }));
    writeFileSync(join(nestedDir, "config.json"), JSON.stringify({ type: "CreateNamespace", netns: "nested-ns" }));

    const features$ = signal<Feature[]>([{ type: "ConfigDirectory", path: tmpDir }]);
    const reconciler = createReconciler(() => features$.value);

    const unsub = reconciler.watcher.addListener(() => {});
    await reconciler.applyReconciliation();
    unsub();

    const { state } = await collectState();
    expect(Object.keys(state.namedNetns)).toContain("nested-ns");
  });

  it("preserves birthNetns when netns and wireguard are created in the same round", async () => {
    const features$ = signal<Feature[]>([
      { type: "CreateNamespace", netns: "wg-test" },
      { type: "CreateWireguard", netns: "wg-test", iface: "wg0" },
    ]);
    const reconciler = createReconciler(() => features$.value);

    const unsub = reconciler.watcher.addListener(() => {});
    await reconciler.applyReconciliation();
    unsub();

    // Force a fresh collection and get the enriched state from the reconciler
    reconciler.refreshState();
    const state = await reconciler.currentState();
    const nsInode = state.namedNetns["wg-test"];
    expect(state.netnsByIno[nsInode].interfaces["wg0"]).toBeDefined();

    // birthNetns should equal the real kernel inode of the birth namespace
    const wgIface = state.netnsByIno[nsInode].interfaces["wg0"];
    expect(wgIface.type).toBe("wireguard");
    if (wgIface.type === "wireguard") {
      expect(wgIface.birthNetns).toBe(nsInode);
    }
  });
});
