import { describe, expect, it } from "vitest";
import { generateActualNetworkModel } from "../../src/common/model/actualModelGenerator";
import { IPRoute2NetnsState } from "../../src/common/model/iproute2";

describe("generateActualNetworkModel", () => {
  it("parses a basic interface with addresses", () => {
    const state: IPRoute2NetnsState[] = [
      {
        ino: 4012345677,
        names: [""],
        addr: [
          {
            ifindex: 2,
            ifname: "eth0",
            flags: ["BROADCAST", "MULTICAST", "UP", "LOWER_UP"],
            mtu: 1500,
            operstate: "UP",
            link_type: "ether",
            address: "00:11:22:33:44:55",
            broadcast: "ff:ff:ff:ff:ff:ff",
            addr_info: [
              {
                family: "inet",
                local: "192.168.1.10",
                prefixlen: 24,
                scope: "global",
              },
            ],
          },
        ],
        route: [],
      },
    ];

    const model = generateActualNetworkModel(state);
    expect(model.netnsByIno[model.namedNetns[""]].interfaces["eth0"]).toMatchInlineSnapshot(`
			{
			  "addresses": [
			    {
			      "address": "192.168.1.10",
			      "family": "ipv4",
			      "prefixLength": 24,
			    },
			  ],
			  "altnames": [],
			  "hardwareBus": undefined,
			  "hardwareDevice": undefined,
			  "macAddress": "00:11:22:33:44:55",
			  "mtu": 1500,
			  "phy": undefined,
			  "type": "hardware",
			  "up": true,
			}
		`);
  });

  it("parses a bridge with vlan filtering and stp", () => {
    const state: IPRoute2NetnsState[] = [
      {
        ino: 4012345677,
        names: [""],
        addr: [
          {
            ifindex: 3,
            ifname: "br0",
            flags: ["BROADCAST", "MULTICAST", "UP", "LOWER_UP"],
            mtu: 1500,
            operstate: "UP",
            link_type: "ether",
            address: "00:11:22:33:44:66",
            broadcast: "ff:ff:ff:ff:ff:ff",
            linkinfo: {
              info_kind: "bridge",
              info_data: { vlan_filtering: 1, stp_state: 1 },
            },
            addr_info: [],
          },
        ],
        route: [],
      },
    ];

    const model = generateActualNetworkModel(state);
    expect(model.netnsByIno[model.namedNetns[""]].interfaces["br0"]).toMatchInlineSnapshot(`
			{
			  "addresses": [],
			  "altnames": [],
			  "macAddress": "00:11:22:33:44:66",
			  "mtu": 1500,
			  "netnsImmutable": true,
			  "self": {
			    "pvid": undefined,
			    "vlans": [],
			  },
			  "stp": true,
			  "type": "bridge",
			  "up": true,
			  "vlanFiltering": true,
			}
		`);
  });

  it("parses a bridge member interface with vlan info", () => {
    const state: IPRoute2NetnsState[] = [
      {
        ino: 4012345677,
        names: [""],
        addr: [
          {
            ifindex: 3,
            ifname: "br0",
            flags: ["BROADCAST", "MULTICAST", "UP", "LOWER_UP"],
            mtu: 1500,
            operstate: "UP",
            link_type: "ether",
            address: "00:11:22:33:44:66",
            broadcast: "ff:ff:ff:ff:ff:ff",
            linkinfo: {
              info_kind: "bridge",
              info_data: { vlan_filtering: 1, stp_state: 0 },
            },
            addr_info: [],
          },
          {
            ifindex: 4,
            ifname: "eth0",
            flags: ["BROADCAST", "MULTICAST", "UP", "LOWER_UP"],
            mtu: 1500,
            operstate: "UP",
            link_type: "ether",
            address: "00:11:22:33:44:77",
            broadcast: "ff:ff:ff:ff:ff:ff",
            master: "br0",
            addr_info: [],
          },
        ],
        bridgeVlans: [
          {
            ifname: "eth0",
            vlans: [
              { vlan: 1, flags: ["PVID", "Egress Untagged"] },
              { vlan: 10, flags: ["Egress Tagged"] },
            ],
          },
        ],
        route: [],
      },
    ];

    const model = generateActualNetworkModel(state);
    expect(model.netnsByIno[model.namedNetns[""]].interfaces["eth0"]).toMatchInlineSnapshot(`
			{
			  "addresses": [],
			  "altnames": [],
			  "bridgeMember": {
			    "bridge": "br0",
			    "pvid": 1,
			    "vlans": [
			      {
			        "untagged": true,
			        "vlanId": 1,
			      },
			      {
			        "untagged": false,
			        "vlanId": 10,
			      },
			    ],
			  },
			  "hardwareBus": undefined,
			  "hardwareDevice": undefined,
			  "macAddress": "00:11:22:33:44:77",
			  "mtu": 1500,
			  "phy": undefined,
			  "type": "hardware",
			  "up": true,
			}
		`);
  });

  it("parses a veth with peer name", () => {
    const state: IPRoute2NetnsState[] = [
      {
        ino: 4012345677,
        names: ["ns1"],
        addr: [
          {
            ifindex: 4,
            ifname: "veth0",
            flags: ["BROADCAST", "MULTICAST", "UP", "LOWER_UP"],
            mtu: 1500,
            operstate: "UP",
            link_type: "ether",
            address: "00:11:22:33:44:77",
            broadcast: "ff:ff:ff:ff:ff:ff",
            link: "veth1",
            linkinfo: { info_kind: "veth" },
            addr_info: [],
          },
        ],
        route: [],
      },
    ];

    const model = generateActualNetworkModel(state);
    expect(model.netnsByIno[model.namedNetns["ns1"]].interfaces["veth0"]).toMatchInlineSnapshot(`
      {
        "addresses": [],
        "altnames": [],
        "macAddress": "00:11:22:33:44:77",
        "mtu": 1500,
        "peerIface": "veth1",
        "peerNetns": 4012345677,
        "type": "veth",
        "up": true,
      }
    `);
  });

  it("parses a cross-namespace veth with link_index and link_netnsid", () => {
    const state: IPRoute2NetnsState[] = [
      {
        ino: 4012345677,
        names: ["ns1"],
        addr: [
          {
            ifindex: 3,
            ifname: "veth0",
            flags: ["BROADCAST", "MULTICAST"],
            mtu: 1500,
            operstate: "DOWN",
            link_type: "ether",
            address: "9a:d3:01:dc:5b:5a",
            broadcast: "ff:ff:ff:ff:ff:ff",
            link_index: 2,
            link_netnsid: 0,
            linkinfo: { info_kind: "veth" },
            addr_info: [],
          },
        ],
        route: [],
        lsns: [
          { ns: 4012345677, netnsid: "unassigned" },
          { ns: 4012345678, netnsid: "0" },
        ],
      },
      {
        ino: 4012345678,
        names: ["ns2"],
        addr: [
          {
            ifindex: 2,
            ifname: "veth1",
            flags: ["BROADCAST", "MULTICAST"],
            mtu: 1500,
            operstate: "DOWN",
            link_type: "ether",
            address: "9e:4f:ec:6c:18:e2",
            broadcast: "ff:ff:ff:ff:ff:ff",
            link_index: 3,
            link_netnsid: 0,
            linkinfo: { info_kind: "veth" },
            addr_info: [],
          },
        ],
        route: [],
        lsns: [
          { ns: 4012345677, netnsid: "0" },
          { ns: 4012345678, netnsid: "unassigned" },
        ],
      },
    ];

    const model = generateActualNetworkModel(state);
    expect(model.netnsByIno[model.namedNetns["ns1"]].interfaces["veth0"]).toMatchInlineSnapshot(`
      {
        "addresses": [],
        "altnames": [],
        "macAddress": "9a:d3:01:dc:5b:5a",
        "mtu": 1500,
        "peerIface": "veth1",
        "peerNetns": 4012345678,
        "type": "veth",
        "up": false,
      }
    `);
    expect(model.netnsByIno[model.namedNetns["ns2"]].interfaces["veth1"]).toMatchInlineSnapshot(`
      {
        "addresses": [],
        "altnames": [],
        "macAddress": "9e:4f:ec:6c:18:e2",
        "mtu": 1500,
        "peerIface": "veth0",
        "peerNetns": 4012345677,
        "type": "veth",
        "up": false,
      }
    `);
  });

  it("resolves a veth peer in an unnamed namespace via lsns nsid", () => {
    const state: IPRoute2NetnsState[] = [
      {
        ino: 4012345677,
        names: ["ns1"],
        addr: [
          {
            ifindex: 3,
            ifname: "veth0",
            flags: ["BROADCAST", "MULTICAST"],
            mtu: 1500,
            operstate: "DOWN",
            link_type: "ether",
            address: "9a:d3:01:dc:5b:5a",
            broadcast: "ff:ff:ff:ff:ff:ff",
            link_index: 2,
            link_netnsid: 0,
            linkinfo: { info_kind: "veth" },
            addr_info: [],
          },
        ],
        route: [],
        lsns: [
          { ns: 4012345677, netnsid: "unassigned" },
          { ns: 4012345999, netnsid: "0" },
        ],
      },
      {
        ino: 4012345999,
        names: [],
        addr: [
          {
            ifindex: 2,
            ifname: "veth-x",
            flags: ["BROADCAST", "MULTICAST"],
            mtu: 1500,
            operstate: "DOWN",
            link_type: "ether",
            address: "9e:4f:ec:6c:18:e2",
            broadcast: "ff:ff:ff:ff:ff:ff",
            link_index: 3,
            link_netnsid: 0,
            linkinfo: { info_kind: "veth" },
            addr_info: [],
          },
        ],
        route: [],
        lsns: [
          { ns: 4012345677, netnsid: "0" },
          { ns: 4012345999, netnsid: "unassigned" },
        ],
      },
    ];

    const model = generateActualNetworkModel(state);
    expect(model.namedNetns).toEqual({ ns1: 4012345677 });
    expect(model.netnsByIno[4012345999].names).toEqual([]);
    expect(model.netnsByIno[model.namedNetns["ns1"]].interfaces["veth0"]).toMatchObject({
      type: "veth",
      peerIface: "veth-x",
      peerNetns: 4012345999,
    });
    expect(model.netnsByIno[4012345999].interfaces["veth-x"]).toMatchObject({
      type: "veth",
      peerIface: "veth0",
      peerNetns: 4012345677,
    });
  });

  it("parses a wireguard interface", () => {
    const state: IPRoute2NetnsState[] = [
      {
        ino: 4012345678,
        names: [""],
        addr: [
          {
            ifindex: 5,
            ifname: "wg0",
            flags: ["NOARP", "UP", "LOWER_UP"],
            mtu: 1420,
            operstate: "UNKNOWN",
            link_type: "none",
            address: "00:00:00:00:00:00",
            broadcast: "00:00:00:00:00:00",
            linkinfo: { info_kind: "wireguard" },
            addr_info: [],
          },
        ],
        route: [],
        wireguard: {
          wg0: `[Interface]\nPrivateKey = testkey\nListenPort = 51820\n\n[Peer]\nPublicKey = peerpub\nAllowedIPs = 10.0.0.1/32\nEndpoint = 1.2.3.4:51820\nPersistentKeepalive = 25`,
        },
      },
    ];

    const model = generateActualNetworkModel(state);
    expect(model.netnsByIno[model.namedNetns[""]].interfaces["wg0"]).toMatchInlineSnapshot(`
			{
			  "addresses": [],
			  "altnames": [],
			  "config": {
			    "listenPort": 51820,
			    "peers": [
			      {
			        "allowedIPs": [
			          {
			            "address": "10.0.0.1",
			            "family": "ipv4",
			            "prefixLength": 32,
			          },
			        ],
			        "endpoint": "1.2.3.4:51820",
			        "persistentKeepalive": 25,
			        "publicKey": "peerpub",
			      },
			    ],
			    "privateKey": "testkey",
			  },
			  "macAddress": "00:00:00:00:00:00",
			  "mtu": 1420,
			  "type": "wireguard",
			  "up": true,
			}
		`);
  });

  it("parses a hardware interface", () => {
    const state: IPRoute2NetnsState[] = [
      {
        ino: 4012345678,
        names: [""],
        addr: [
          {
            ifindex: 2,
            ifname: "eth0",
            flags: ["BROADCAST", "MULTICAST", "UP", "LOWER_UP"],
            mtu: 1500,
            operstate: "UP",
            link_type: "ether",
            address: "00:11:22:33:44:55",
            broadcast: "ff:ff:ff:ff:ff:ff",
            parentbus: "pci",
            parentdev: "0000:00:1f.6",
            addr_info: [],
          },
        ],
        route: [],
      },
    ];

    const model = generateActualNetworkModel(state);
    expect(model.netnsByIno[model.namedNetns[""]].interfaces["eth0"]).toMatchInlineSnapshot(`
			{
			  "addresses": [],
			  "altnames": [],
			  "hardwareBus": "pci",
			  "hardwareDevice": "0000:00:1f.6",
			  "macAddress": "00:11:22:33:44:55",
			  "mtu": 1500,
			  "phy": undefined,
			  "type": "hardware",
			  "up": true,
			}
		`);
  });

  it("parses a wireless interface with phyName", () => {
    const state: IPRoute2NetnsState[] = [
      {
        ino: 4012345678,
        names: [""],
        addr: [
          {
            ifindex: 4,
            ifname: "wlan0",
            flags: ["BROADCAST", "MULTICAST"],
            mtu: 1500,
            operstate: "DOWN",
            link_type: "ether",
            address: "ae:98:ea:4f:32:51",
            broadcast: "ff:ff:ff:ff:ff:ff",
            "netns-immutable": true,
            parentbus: "pci",
            parentdev: "0000:00:14.3",
            addr_info: [],
          },
        ],
        route: [],
        iwDev:
          "phy#0\n\tInterface wlan0\n\tifindex 4\n\twdev 0x1\n\taddr ae:98:ea:4f:32:51\n\ttype managed\n\tchannel 1 (2412 MHz), width: 20 MHz, center1: 2412 MHz\n\ttxpower 20.00 dBm\n\tmulticast TXQ:\n\t\tqsz-byt qsz-pkt flows\t drops marks\toverlmt hashcol tx-bytes tx-packets\n\t\t0\t\t0\t\t0\t0\t\t0\t\t0\t0\t\t0\t\t\t0\t\t\t0",
      },
    ];

    const model = generateActualNetworkModel(state);
    expect(model.netnsByIno[model.namedNetns[""]].interfaces["wlan0"]).toMatchInlineSnapshot(`
			{
			  "addresses": [],
			  "altnames": [],
			  "hardwareBus": "pci",
			  "hardwareDevice": "0000:00:14.3",
			  "macAddress": "ae:98:ea:4f:32:51",
			  "mtu": 1500,
			  "netnsImmutable": true,
			  "phy": "phy0",
			  "type": "hardware",
			  "up": false,
			}
		`);
  });

  it("parses routes and skips kernel routes", () => {
    const state: IPRoute2NetnsState[] = [
      {
        names: [""],
        ino: 4012345678,
        addr: [],
        route: [
          {
            dst: "default",
            gateway: "192.168.1.1",
            dev: "eth0",
            protocol: "dhcp",
            scope: "global",
            prefsrc: "192.168.1.10",
            flags: [],
            metric: 100,
          },
          {
            dst: "192.168.1.0/24",
            gateway: "",
            dev: "eth0",
            protocol: "kernel",
            scope: "link",
            prefsrc: "192.168.1.10",
            flags: [],
          },
        ],
      },
    ];

    const model = generateActualNetworkModel(state);
    expect(model.netnsByIno[model.namedNetns[""]].routes).toEqual([
      {
        family: "ipv4",
        address: "0.0.0.0",
        prefixLength: 0,
        gateway: "192.168.1.1",
        iface: "eth0",
        metric: 100,
      },
    ]);
  });

  it("parses multiple namespaces", () => {
    const state: IPRoute2NetnsState[] = [
      {
        ino: 4012345677,
        names: [""],
        addr: [
          {
            ifindex: 1,
            ifname: "lo",
            flags: ["LOOPBACK", "UP", "LOWER_UP"],
            mtu: 65536,
            operstate: "UNKNOWN",
            link_type: "loopback",
            address: "00:00:00:00:00:00",
            broadcast: "00:00:00:00:00:00",
            addr_info: [],
          },
        ],
        route: [],
      },
      {
        ino: 4012345678,
        names: ["test-ns"],
        addr: [
          {
            ifindex: 1,
            ifname: "lo",
            flags: ["LOOPBACK", "UP", "LOWER_UP"],
            mtu: 65536,
            operstate: "UNKNOWN",
            link_type: "loopback",
            address: "00:00:00:00:00:00",
            broadcast: "00:00:00:00:00:00",
            addr_info: [],
          },
        ],
        route: [],
      },
    ];

    const model = generateActualNetworkModel(state);
    expect(Object.keys(model.namedNetns)).toEqual(["", "test-ns"]);
  });

  it("parses an interface with altnames", () => {
    const state: IPRoute2NetnsState[] = [
      {
        ino: 4012345678,
        names: [""],
        addr: [
          {
            ifindex: 2,
            ifname: "eth0",
            flags: ["BROADCAST", "MULTICAST", "UP", "LOWER_UP"],
            mtu: 1500,
            operstate: "UP",
            link_type: "ether",
            address: "00:11:22:33:44:55",
            broadcast: "ff:ff:ff:ff:ff:ff",
            altnames: ["eth0-alt", "enx001122334455"],
            addr_info: [],
          },
        ],
        route: [],
      },
    ];

    const model = generateActualNetworkModel(state);
    expect(model.netnsByIno[model.namedNetns[""]].interfaces["eth0"]).toMatchInlineSnapshot(`
			{
			  "addresses": [],
			  "altnames": [
			    "eth0-alt",
			    "enx001122334455",
			  ],
			  "hardwareBus": undefined,
			  "hardwareDevice": undefined,
			  "macAddress": "00:11:22:33:44:55",
			  "mtu": 1500,
			  "phy": undefined,
			  "type": "hardware",
			  "up": true,
			}
		`);
    expect(model.netnsByIno[model.namedNetns[""]].interfaces["eth0-alt"]).toMatchInlineSnapshot(`
			{
			  "iface": "eth0",
			  "type": "altname",
			}
		`);
    expect(model.netnsByIno[model.namedNetns[""]].interfaces["enx001122334455"]).toMatchInlineSnapshot(`
			{
			  "iface": "eth0",
			  "type": "altname",
			}
		`);
  });
});
