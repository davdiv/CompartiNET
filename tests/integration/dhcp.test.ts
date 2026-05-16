import { createSocket } from "node:dgram";
import { signal } from "signalium";
import { afterEach, describe, expect, it } from "vitest";
import { collectState } from "../../src/node/collectState";
import { BOOTP_OP, DHCP_MESSAGE_TYPE, DHCP_OPTION, DHCP_PORT } from "../../src/node/dhcp/protocol/constants";
import { formatDhcpPacket } from "../../src/node/dhcp/protocol/format";
import { parseDhcpPacket } from "../../src/node/dhcp/protocol/parse";
import type { Feature } from "../../src/node/features";
import { createReconciler } from "../../src/node/reconciler";
import { cleanupState } from "./harness";

async function startTestDhcpServer(serverIp: string, offeredIp: string, subnetMask: string): Promise<() => Promise<void>> {
  const server = createSocket({ type: "udp4", reuseAddr: true });

  server.on("message", (msg) => {
    let packet;
    try {
      packet = parseDhcpPacket(msg);
    } catch {
      return;
    }

    const msgType = packet.options[DHCP_OPTION.MESSAGE_TYPE] as number | undefined;
    console.log("[test-server] received DHCP message type:", msgType, "xid:", packet.xid);
    if (msgType !== DHCP_MESSAGE_TYPE.DHCPDISCOVER && msgType !== DHCP_MESSAGE_TYPE.DHCPREQUEST) return;

    const replyType = msgType === DHCP_MESSAGE_TYPE.DHCPDISCOVER ? DHCP_MESSAGE_TYPE.DHCPOFFER : DHCP_MESSAGE_TYPE.DHCPACK;
    console.log("[test-server] sending reply type:", replyType, "to 255.255.255.255:68");
    const leaseTime = 300;

    const reply = formatDhcpPacket({
      op: BOOTP_OP.BOOTREPLY,
      htype: 1,
      hlen: 6,
      hops: 0,
      xid: packet.xid,
      secs: 0,
      flags: 0,
      ciaddr: "0.0.0.0",
      yiaddr: offeredIp,
      siaddr: serverIp,
      giaddr: "0.0.0.0",
      chaddr: packet.chaddr,
      sname: "",
      bootFile: "",
      options: {
        [DHCP_OPTION.MESSAGE_TYPE]: replyType,
        [DHCP_OPTION.SERVER_IDENTIFIER]: serverIp,
        [DHCP_OPTION.IP_ADDRESS_LEASE_TIME]: leaseTime,
        [DHCP_OPTION.SUBNET_MASK]: subnetMask,
        [DHCP_OPTION.ROUTER]: serverIp,
        [DHCP_OPTION.RENEWAL_TIME]: Math.floor(leaseTime / 2),
        [DHCP_OPTION.REBINDING_TIME]: Math.floor((leaseTime * 7) / 8),
      },
    });

    server.send(reply, DHCP_PORT.CLIENT, "255.255.255.255");
  });

  await new Promise<void>((resolve, reject) => {
    server.on("listening", () => {
      server.setBroadcast(true);
      resolve();
    });
    server.on("error", reject);
    server.bind(DHCP_PORT.SERVER, "0.0.0.0");
  });

  return () => new Promise<void>((resolve) => server.close(() => resolve()));
}

describe("integration / dhcp", () => {
  let stopServer: (() => Promise<void>) | undefined;
  let unsub: (() => void) | undefined;

  afterEach(async () => {
    unsub?.();
    unsub = undefined;
    await stopServer?.();
    stopServer = undefined;
    await cleanupState();
  });

  it("acquires DHCP lease and applies IP address and default route", async () => {
    stopServer = await startTestDhcpServer("192.168.99.1", "192.168.99.100", "255.255.255.0");

    const features$ = signal<Feature[]>([
      { type: "CreateNamespace", netns: "dhcp-client-ns" },
      // Create veth from default ns so the command becomes "ip link add veth-server type veth peer name veth-client netns dhcp-client-ns"
      { type: "CreateVeth", netns: "", iface: "veth-server", peerNetns: "dhcp-client-ns", peerIface: "veth-client" },
      { type: "SetInterfaceUp", netns: "", iface: "veth-server", up: true },
      { type: "SetInterfaceUp", netns: "dhcp-client-ns", iface: "veth-client", up: true },
      { type: "AddIpAddress", netns: "", iface: "veth-server", ip: { family: "ipv4", address: "192.168.99.1", prefixLength: 24 } },
      // Default route in the default ns via veth-server: routes 255.255.255.255 so the DHCP
      // server can broadcast replies, and satisfies rp_filter for DHCPDISCOVER (source 0.0.0.0).
      { type: "AddRoute", netns: "", route: { family: "ipv4", address: "0.0.0.0", prefixLength: 0, iface: "veth-server" } },
      { type: "DhcpClient", netns: "dhcp-client-ns", iface: "veth-client", macAddress: "02:00:00:00:01:01" },
    ]);
    const reconciler = createReconciler(() => features$.value);
    unsub = reconciler.watcher.addListener(() => {});

    let acquired = false;
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 200));
      const { state } = await collectState();
      const ns = state.netnsByIno[state.namedNetns["dhcp-client-ns"]];
      const iface = ns?.interfaces["veth-client"];
      if (iface && iface.type !== "altname" && iface.addresses.some((a) => a.address === "192.168.99.100")) {
        acquired = true;
        break;
      }
    }

    expect(acquired).toBe(true);
    const { state } = await collectState();
    const ns = state.netnsByIno[state.namedNetns["dhcp-client-ns"]];
    const vethClient = ns.interfaces["veth-client"];
    expect(vethClient.type).not.toBe("altname");
    if (vethClient.type !== "altname") {
      expect(vethClient.addresses).toContainEqual(expect.objectContaining({ family: "ipv4", address: "192.168.99.100", prefixLength: 24 }));
    }
    expect(ns.routes).toContainEqual(expect.objectContaining({ address: "0.0.0.0", prefixLength: 0, gateway: "192.168.99.1" }));
  }, 30_000);
});
