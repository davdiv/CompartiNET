import { Server } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { collectState } from "../../src/node/collectState";
import { createNetnsWorker } from "../../src/node/netnsWorker/create";
import { cleanupState, runActionAndVerify } from "./harness";

describe("integration / listening sockets", () => {
  afterEach(cleanupState);

  it("collects TCP listening sockets", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "socket-test-ns" });
    await runActionAndVerify({ type: "CreateVeth", netns: "", iface: "veth-srv", peerNetns: "socket-test-ns", peerIface: "veth-cli" });
    await runActionAndVerify({ type: "SetInterfaceUp", netns: "", iface: "veth-srv", up: true });
    await runActionAndVerify({ type: "SetInterfaceUp", netns: "socket-test-ns", iface: "veth-cli", up: true });
    await runActionAndVerify({ type: "AddIpAddress", netns: "socket-test-ns", iface: "veth-cli", ip: { family: "ipv4", address: "10.99.0.2", prefixLength: 24 } });

    // Start a TCP listener on port 9999 inside the namespace
    using worker = createNetnsWorker("socket-test-ns");
    const server = await worker.call<Server>({ type: "create-tcp-server", host: "10.99.0.2", port: 9999 });
    try {
      const { state } = await collectState();
      const ns = state.netnsByIno[state.namedNetns["socket-test-ns"]];
      expect(ns).toBeDefined();
      expect(ns.listeningSockets).toEqual(expect.arrayContaining([expect.objectContaining({ protocol: "tcp4", host: "10.99.0.2", port: 9999 })]));
    } finally {
      server.close();
    }
  });

  it("captures zone for IPv6 link-local listener", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "zone-test-ns" });
    await runActionAndVerify({ type: "CreateVeth", peerNetns: "", peerIface: "veth-zone-srv", netns: "zone-test-ns", iface: "veth-zone-cli" });
    await runActionAndVerify({ type: "SetInterfaceUp", netns: "", iface: "veth-zone-srv", up: true });
    await runActionAndVerify({ type: "SetInterfaceUp", netns: "zone-test-ns", iface: "veth-zone-cli", up: true });
    await runActionAndVerify({ type: "AddIpAddress", netns: "zone-test-ns", iface: "veth-zone-cli", ip: { family: "ipv6", address: "fe80::1", prefixLength: 64 } });

    // Start a listener on the link-local address bound to %veth-zone-cli
    using child = createNetnsWorker("zone-test-ns");
    const server = await child.call<Server>({ type: "create-tcp-server", host: "fe80::1%veth-zone-cli", port: 9999 });
    try {
      const { state } = await collectState();
      const ns = state.netnsByIno[state.namedNetns["zone-test-ns"]];
      expect(ns.listeningSockets).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            protocol: "tcp6",
            host: "fe80::1",
            port: 9999,
            zone: "veth-zone-cli",
          }),
        ]),
      );
    } finally {
      server.close();
    }
  });
});
