import { afterEach, describe, it } from "vitest";
import { cleanupState, runActionAndVerify } from "../harness";

describe("integration / route actions", () => {
  afterEach(cleanupState);

  it("adds and removes a route", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "test-ns" });

    // Bring lo up before adding route
    await runActionAndVerify({ type: "SetInterfaceUp", netns: "test-ns", iface: "lo", up: true });

    // Add route via loopback
    await runActionAndVerify({ type: "AddRoute", netns: "test-ns", route: { family: "ipv4", address: "10.0.0.0", prefixLength: 8, iface: "lo" } });

    await runActionAndVerify({ type: "RemoveRoute", netns: "test-ns", route: { family: "ipv4", address: "10.0.0.0", prefixLength: 8, iface: "lo" } });
  });

  it("removes routes when interface is shut down", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "test-ns" });

    // Create a veth pair and bring one end up
    await runActionAndVerify({ type: "CreateVeth", netns: "test-ns", iface: "veth0", peerNetns: "test-ns", peerIface: "veth1" });
    await runActionAndVerify({ type: "SetInterfaceUp", netns: "test-ns", iface: "veth0", up: true });

    // Add a route via veth0
    await runActionAndVerify({ type: "AddRoute", netns: "test-ns", route: { family: "ipv4", address: "10.0.0.0", prefixLength: 8, iface: "veth0" } });

    // Shutting down the interface removes the route
    await runActionAndVerify({ type: "SetInterfaceUp", netns: "test-ns", iface: "veth0", up: false });
  });

  it("removes routes when interface is moved to another namespace", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "ns1" });
    await runActionAndVerify({ type: "CreateNamespace", netns: "ns2" });

    // Create a veth pair in ns1 and bring one end up
    await runActionAndVerify({ type: "CreateVeth", netns: "ns1", iface: "veth0", peerNetns: "ns1", peerIface: "veth1" });
    await runActionAndVerify({ type: "SetInterfaceUp", netns: "ns1", iface: "veth1", up: true });

    // Add a route via veth1
    await runActionAndVerify({ type: "AddRoute", netns: "ns1", route: { family: "ipv4", address: "10.0.0.0", prefixLength: 8, iface: "veth1" } });

    // Moving the interface to another namespace removes the route
    await runActionAndVerify({ type: "MoveInterface", oldNetns: "ns1", oldIface: "veth1", newNetns: "ns2", newIface: "veth1" });
  });

  it("adds and removes a route with onlink flag", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "test-ns" });

    // Bring lo up before adding route
    await runActionAndVerify({ type: "SetInterfaceUp", netns: "test-ns", iface: "lo", up: true });

    // Add route with onlink flag and a gateway
    await runActionAndVerify({
      type: "AddRoute",
      netns: "test-ns",
      route: { family: "ipv4", address: "10.0.0.0", prefixLength: 8, iface: "lo", gateway: "10.255.255.1", onlink: true },
    });

    await runActionAndVerify({
      type: "RemoveRoute",
      netns: "test-ns",
      route: { family: "ipv4", address: "10.0.0.0", prefixLength: 8, iface: "lo", gateway: "10.255.255.1", onlink: true },
    });
  });

  it("updates route device when interface is renamed within same namespace", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "test-ns" });

    // Create a veth pair and bring one end up
    await runActionAndVerify({ type: "CreateVeth", netns: "test-ns", iface: "veth0", peerNetns: "test-ns", peerIface: "veth1" });
    await runActionAndVerify({ type: "SetInterfaceUp", netns: "test-ns", iface: "veth0", up: true });

    // Add a route via veth0
    await runActionAndVerify({ type: "AddRoute", netns: "test-ns", route: { family: "ipv4", address: "10.0.0.0", prefixLength: 8, iface: "veth0" } });

    // Renaming the interface updates the route's iface
    await runActionAndVerify({ type: "MoveInterface", oldNetns: "test-ns", oldIface: "veth0", newNetns: "test-ns", newIface: "veth0-renamed" });
  });
});
