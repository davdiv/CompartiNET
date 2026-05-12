import { afterEach, describe, it } from "vitest";
import { cleanupState, runActionAndVerify } from "../harness";

describe("integration / interface actions", () => {
  afterEach(cleanupState);

  it("sets interface up and down", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "test-ns" });

    // Bring lo up
    await runActionAndVerify({ type: "SetInterfaceUp", netns: "test-ns", iface: "lo", up: true });

    // Bring lo down
    await runActionAndVerify({ type: "SetInterfaceUp", netns: "test-ns", iface: "lo", up: false });
  });

  it("moves an interface between namespaces", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "ns1" });
    await runActionAndVerify({ type: "CreateNamespace", netns: "ns2" });

    // Create a veth pair in ns1
    await runActionAndVerify({ type: "CreateVeth", netns: "ns1", iface: "veth0", peerNetns: "ns1", peerIface: "veth1" });

    // Move veth1 to ns2
    await runActionAndVerify({ type: "MoveInterface", oldNetns: "ns1", oldIface: "veth1", newNetns: "ns2", newIface: "veth1" });
  });

  it("moves an interface with altnames between namespaces", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "ns1" });
    await runActionAndVerify({ type: "CreateNamespace", netns: "ns2" });

    // Create a veth pair in ns1
    await runActionAndVerify({ type: "CreateVeth", netns: "ns1", iface: "veth0", peerNetns: "ns1", peerIface: "veth1" });

    // Add an altname to veth1
    await runActionAndVerify({ type: "AddAltname", netns: "ns1", iface: "veth1", altname: "veth1-alt" });

    // Move veth1 to ns2
    await runActionAndVerify({ type: "MoveInterface", oldNetns: "ns1", oldIface: "veth1", newNetns: "ns2", newIface: "veth1" });
  });

  it("moves an up interface between namespaces", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "ns1" });
    await runActionAndVerify({ type: "CreateNamespace", netns: "ns2" });

    // Create a veth pair in ns1 and bring it up
    await runActionAndVerify({ type: "CreateVeth", netns: "ns1", iface: "veth0", peerNetns: "ns1", peerIface: "veth1" });
    await runActionAndVerify({ type: "SetInterfaceUp", netns: "ns1", iface: "veth1", up: true });

    // Move veth1 to ns2 while it is up
    await runActionAndVerify({ type: "MoveInterface", oldNetns: "ns1", oldIface: "veth1", newNetns: "ns2", newIface: "veth1" });
  });

  it("moves a bridge member between namespaces", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "ns1" });
    await runActionAndVerify({ type: "CreateNamespace", netns: "ns2" });

    // Create a bridge and a veth pair in ns1
    await runActionAndVerify({ type: "CreateBridge", netns: "ns1", iface: "br0", vlanFiltering: false, stp: false });
    await runActionAndVerify({ type: "CreateVeth", netns: "ns1", iface: "veth0", peerNetns: "ns1", peerIface: "veth1" });

    // Add veth0 as a bridge port
    await runActionAndVerify({ type: "AddBridgePort", netns: "ns1", iface: "veth0", bridge: "br0" });

    // Move veth0 to ns2 while it is a bridge member
    await runActionAndVerify({ type: "MoveInterface", oldNetns: "ns1", oldIface: "veth0", newNetns: "ns2", newIface: "veth0" });
  });

  it("renames an up interface within the same namespace", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "test-ns" });

    // Create a veth pair and bring one end up
    await runActionAndVerify({ type: "CreateVeth", netns: "test-ns", iface: "veth0", peerNetns: "test-ns", peerIface: "veth1" });
    await runActionAndVerify({ type: "SetInterfaceUp", netns: "test-ns", iface: "veth0", up: true });

    // Rename veth0 while it is up
    await runActionAndVerify({ type: "MoveInterface", oldNetns: "test-ns", oldIface: "veth0", newNetns: "test-ns", newIface: "veth0-renamed" });
  });

  it("moves a veth end across namespaces while both are up", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "ns1" });
    await runActionAndVerify({ type: "CreateNamespace", netns: "ns2" });

    // Create a veth pair in ns1 and bring both ends up
    await runActionAndVerify({ type: "CreateVeth", netns: "ns1", iface: "veth0", peerNetns: "ns1", peerIface: "veth1" });
    await runActionAndVerify({ type: "SetInterfaceUp", netns: "ns1", iface: "veth0", up: true });
    await runActionAndVerify({ type: "SetInterfaceUp", netns: "ns1", iface: "veth1", up: true });

    // Move veth1 to ns2 while both are up
    await runActionAndVerify({ type: "MoveInterface", oldNetns: "ns1", oldIface: "veth1", newNetns: "ns2", newIface: "veth1" });
  });

  it("moves an interface back to the default namespace", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "ns1" });

    // Create a veth pair in ns1
    await runActionAndVerify({ type: "CreateVeth", netns: "ns1", iface: "veth0", peerNetns: "ns1", peerIface: "veth1" });

    // Move veth1 back to the default namespace
    await runActionAndVerify({ type: "MoveInterface", oldNetns: "ns1", oldIface: "veth1", newNetns: "", newIface: "veth1" });
  });
});
