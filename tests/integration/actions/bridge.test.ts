import { afterEach, describe, it } from "vitest";
import { cleanupState, runActionAndVerify } from "../harness";

describe("integration / bridge actions", () => {
  afterEach(cleanupState);

  it("creates and deletes a bridge", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "test-ns" });

    await runActionAndVerify({ type: "CreateBridge", netns: "test-ns", iface: "br0", vlanFiltering: true, stp: false });

    await runActionAndVerify({ type: "DeleteBridge", netns: "test-ns", iface: "br0" });
  });

  it("sets bridge vlan filtering", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "test-ns" });

    await runActionAndVerify({ type: "CreateBridge", netns: "test-ns", iface: "br0", vlanFiltering: false, stp: false });

    await runActionAndVerify({ type: "SetBridgeVlanFiltering", netns: "test-ns", iface: "br0", vlanFiltering: true });
  });

  it("adds and removes a bridge port", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "test-ns" });

    await runActionAndVerify({ type: "CreateBridge", netns: "test-ns", iface: "br0", vlanFiltering: true, stp: false });
    await runActionAndVerify({ type: "CreateVeth", netns: "test-ns", iface: "veth0", peerNetns: "test-ns", peerIface: "veth1" });

    await runActionAndVerify({ type: "AddBridgePort", netns: "test-ns", iface: "veth0", bridge: "br0" });
    await runActionAndVerify({ type: "RemoveBridgePort", netns: "test-ns", iface: "veth0" });
  });

  it("deletes a bridge that has members", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "test-ns" });

    await runActionAndVerify({ type: "CreateBridge", netns: "test-ns", iface: "br0", vlanFiltering: false, stp: false });
    await runActionAndVerify({ type: "CreateVeth", netns: "test-ns", iface: "veth0", peerNetns: "test-ns", peerIface: "veth1" });

    await runActionAndVerify({ type: "AddBridgePort", netns: "test-ns", iface: "veth0", bridge: "br0" });
    await runActionAndVerify({ type: "DeleteBridge", netns: "test-ns", iface: "br0" });
  });

  it("renames a bridge with members", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "test-ns" });

    await runActionAndVerify({ type: "CreateBridge", netns: "test-ns", iface: "br0", vlanFiltering: false, stp: false });
    await runActionAndVerify({ type: "CreateVeth", netns: "test-ns", iface: "veth0", peerNetns: "test-ns", peerIface: "veth1" });

    await runActionAndVerify({ type: "AddBridgePort", netns: "test-ns", iface: "veth0", bridge: "br0" });

    await runActionAndVerify({ type: "MoveInterface", oldNetns: "test-ns", oldIface: "br0", newNetns: "test-ns", newIface: "br0-renamed" });
  });

  it("adds and removes bridge port VLANs", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "test-ns" });

    await runActionAndVerify({ type: "CreateBridge", netns: "test-ns", iface: "br0", vlanFiltering: true, stp: false });
    await runActionAndVerify({ type: "CreateVeth", netns: "test-ns", iface: "veth0", peerNetns: "test-ns", peerIface: "veth1" });

    await runActionAndVerify({ type: "AddBridgePort", netns: "test-ns", iface: "veth0", bridge: "br0" });

    // Add a tagged VLAN
    await runActionAndVerify({ type: "AddBridgePortVlan", netns: "test-ns", iface: "veth0", vlanId: 10, untagged: false });

    // Add an untagged VLAN with pvid
    await runActionAndVerify({ type: "AddBridgePortVlan", netns: "test-ns", iface: "veth0", vlanId: 20, untagged: true, pvid: true });

    // Update tagged flag on existing VLAN
    await runActionAndVerify({ type: "AddBridgePortVlan", netns: "test-ns", iface: "veth0", vlanId: 10, untagged: true });

    // Remove a VLAN
    await runActionAndVerify({ type: "RemoveBridgePortVlan", netns: "test-ns", iface: "veth0", vlanId: 10 });

    // Re-add the PVID VLAN without pvid flag — kernel should clear PVID
    await runActionAndVerify({ type: "AddBridgePortVlan", netns: "test-ns", iface: "veth0", vlanId: 20, untagged: true });

    // Remove a non-existent VLAN is idempotent
    await runActionAndVerify({ type: "RemoveBridgePortVlan", netns: "test-ns", iface: "veth0", vlanId: 99 });
  });

  it("configures bridge self port VLANs", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "test-ns" });

    await runActionAndVerify({ type: "CreateBridge", netns: "test-ns", iface: "br0", vlanFiltering: true, stp: false });

    // Add a tagged VLAN to the bridge self port
    await runActionAndVerify({ type: "AddBridgePortVlan", netns: "test-ns", iface: "br0", vlanId: 10, untagged: false, self: true });

    // Add an untagged VLAN with pvid to the bridge self port
    await runActionAndVerify({ type: "AddBridgePortVlan", netns: "test-ns", iface: "br0", vlanId: 20, untagged: true, pvid: true, self: true });

    // Remove the PVID VLAN from the bridge self port
    await runActionAndVerify({ type: "RemoveBridgePortVlan", netns: "test-ns", iface: "br0", vlanId: 20, self: true });

    // Re-add a VLAN without pvid flag on self port
    await runActionAndVerify({ type: "AddBridgePortVlan", netns: "test-ns", iface: "br0", vlanId: 10, untagged: true, pvid: true, self: true });
    await runActionAndVerify({ type: "AddBridgePortVlan", netns: "test-ns", iface: "br0", vlanId: 10, untagged: true, self: true });
  });
});
