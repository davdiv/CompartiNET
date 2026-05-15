import { describe, expect, it } from "vitest";
import { createFeatureSystem } from "../../src/common/features";
import { NetworkCreateAction } from "../../src/common/model/actions";
import { parseIpAddressModel } from "../../src/common/model/ip";

const processedFeatures = createFeatureSystem({});

describe("desiredModelFromFeatures", () => {
  it("should create a basic namespace with a hardware interface", async () => {
    const features: NetworkCreateAction[] = [
      { type: "CreateNamespace", netns: "test-ns" },
      { type: "MatchHardware", netns: "test-ns", iface: "eth0", hardwareBus: "pci", hardwareDevice: "0000:00:1f.6" },
    ];

    const { desiredState: model } = await processedFeatures(features, null!);
    expect(model).toMatchInlineSnapshot(`
      {
        "namedNetns": {
          "": 0,
          "test-ns": 1,
        },
        "netnsByIno": {
          "0": {
            "interfaces": {
              "lo": {
                "addresses": [],
                "altnames": [],
                "macAddress": "00:00:00:00:00:00",
                "mtu": 65536,
                "netnsImmutable": true,
                "type": "loopback",
                "up": false,
              },
            },
            "listeningSockets": [],
            "routes": [],
          },
          "1": {
            "interfaces": {
              "eth0": {
                "addresses": [],
                "altnames": [],
                "hardwareBus": "pci",
                "hardwareDevice": "0000:00:1f.6",
                "netnsImmutable": false,
                "phy": undefined,
                "type": "hardware",
                "up": false,
              },
              "lo": {
                "addresses": [],
                "altnames": [],
                "macAddress": "00:00:00:00:00:00",
                "mtu": 65536,
                "netnsImmutable": true,
                "type": "loopback",
                "up": false,
              },
            },
            "listeningSockets": [],
            "routes": [],
          },
        },
      }
    `);
  });

  it("should add an IP address to an existing interface", async () => {
    const features: NetworkCreateAction[] = [
      { type: "CreateNamespace", netns: "test-ns" },
      { type: "MatchHardware", netns: "test-ns", iface: "eth0", hardwareBus: "pci", hardwareDevice: "0000:00:1f.6" },
      { type: "AddIpAddress", netns: "test-ns", iface: "eth0", ip: parseIpAddressModel("192.168.1.10/24") },
    ];

    const { desiredState: model } = await processedFeatures(features, null!);
    expect(model).toMatchInlineSnapshot(`
      {
        "namedNetns": {
          "": 0,
          "test-ns": 2,
        },
        "netnsByIno": {
          "0": {
            "interfaces": {
              "lo": {
                "addresses": [],
                "altnames": [],
                "macAddress": "00:00:00:00:00:00",
                "mtu": 65536,
                "netnsImmutable": true,
                "type": "loopback",
                "up": false,
              },
            },
            "listeningSockets": [],
            "routes": [],
          },
          "2": {
            "interfaces": {
              "eth0": {
                "addresses": [
                  {
                    "address": "192.168.1.10",
                    "family": "ipv4",
                    "prefixLength": 24,
                  },
                ],
                "altnames": [],
                "hardwareBus": "pci",
                "hardwareDevice": "0000:00:1f.6",
                "netnsImmutable": false,
                "phy": undefined,
                "type": "hardware",
                "up": false,
              },
              "lo": {
                "addresses": [],
                "altnames": [],
                "macAddress": "00:00:00:00:00:00",
                "mtu": 65536,
                "netnsImmutable": true,
                "type": "loopback",
                "up": false,
              },
            },
            "listeningSockets": [],
            "routes": [],
          },
        },
      }
    `);
  });

  it("should add a route to an interface that is up", async () => {
    const features: NetworkCreateAction[] = [
      { type: "CreateNamespace", netns: "test-ns" },
      { type: "MatchHardware", netns: "test-ns", iface: "eth0", hardwareBus: "pci", hardwareDevice: "0000:00:1f.6" },
      { type: "SetInterfaceUp", netns: "test-ns", iface: "eth0", up: true },
      { type: "AddRoute", netns: "test-ns", route: { ...parseIpAddressModel("0.0.0.0/0"), gateway: "192.168.1.1", iface: "eth0" } },
    ];

    const { desiredState: model } = await processedFeatures(features, null!);
    expect(model).toMatchInlineSnapshot(`
      {
        "namedNetns": {
          "": 0,
          "test-ns": 3,
        },
        "netnsByIno": {
          "0": {
            "interfaces": {
              "lo": {
                "addresses": [],
                "altnames": [],
                "macAddress": "00:00:00:00:00:00",
                "mtu": 65536,
                "netnsImmutable": true,
                "type": "loopback",
                "up": false,
              },
            },
            "listeningSockets": [],
            "routes": [],
          },
          "3": {
            "interfaces": {
              "eth0": {
                "addresses": [],
                "altnames": [],
                "hardwareBus": "pci",
                "hardwareDevice": "0000:00:1f.6",
                "netnsImmutable": false,
                "phy": undefined,
                "type": "hardware",
                "up": true,
              },
              "lo": {
                "addresses": [],
                "altnames": [],
                "macAddress": "00:00:00:00:00:00",
                "mtu": 65536,
                "netnsImmutable": true,
                "type": "loopback",
                "up": false,
              },
            },
            "listeningSockets": [],
            "routes": [
              {
                "address": "0.0.0.0",
                "family": "ipv4",
                "gateway": "192.168.1.1",
                "iface": "eth0",
                "prefixLength": 0,
              },
            ],
          },
        },
      }
    `);
  });

  it("should configure a bridge", async () => {
    const features: NetworkCreateAction[] = [
      { type: "CreateNamespace", netns: "test-ns" },
      { type: "CreateBridge", netns: "test-ns", iface: "br0", vlanFiltering: true, stp: false },
    ];

    const { desiredState: model } = await processedFeatures(features, null!);
    expect(model).toMatchInlineSnapshot(`
      {
        "namedNetns": {
          "": 0,
          "test-ns": 4,
        },
        "netnsByIno": {
          "0": {
            "interfaces": {
              "lo": {
                "addresses": [],
                "altnames": [],
                "macAddress": "00:00:00:00:00:00",
                "mtu": 65536,
                "netnsImmutable": true,
                "type": "loopback",
                "up": false,
              },
            },
            "listeningSockets": [],
            "routes": [],
          },
          "4": {
            "interfaces": {
              "br0": {
                "addresses": [],
                "altnames": [],
                "mtu": 1500,
                "netnsImmutable": true,
                "self": {
                  "pvid": 1,
                  "vlans": [
                    {
                      "untagged": true,
                      "vlanId": 1,
                    },
                  ],
                },
                "stp": false,
                "type": "bridge",
                "up": false,
                "vlanFiltering": true,
              },
              "lo": {
                "addresses": [],
                "altnames": [],
                "macAddress": "00:00:00:00:00:00",
                "mtu": 65536,
                "netnsImmutable": true,
                "type": "loopback",
                "up": false,
              },
            },
            "listeningSockets": [],
            "routes": [],
          },
        },
      }
    `);
  });

  it("should configure a veth pair across two namespaces", async () => {
    const features: NetworkCreateAction[] = [
      { type: "CreateNamespace", netns: "ns1" },
      { type: "CreateNamespace", netns: "ns2" },
      { type: "CreateVeth", netns: "ns1", iface: "veth0", peerNetns: "ns2", peerIface: "veth1" },
    ];

    const { desiredState: model } = await processedFeatures(features, null!);
    expect(model).toMatchInlineSnapshot(`
      {
        "namedNetns": {
          "": 0,
          "ns1": 5,
          "ns2": 6,
        },
        "netnsByIno": {
          "0": {
            "interfaces": {
              "lo": {
                "addresses": [],
                "altnames": [],
                "macAddress": "00:00:00:00:00:00",
                "mtu": 65536,
                "netnsImmutable": true,
                "type": "loopback",
                "up": false,
              },
            },
            "listeningSockets": [],
            "routes": [],
          },
          "5": {
            "interfaces": {
              "lo": {
                "addresses": [],
                "altnames": [],
                "macAddress": "00:00:00:00:00:00",
                "mtu": 65536,
                "netnsImmutable": true,
                "type": "loopback",
                "up": false,
              },
              "veth0": {
                "addresses": [],
                "altnames": [],
                "mtu": 1500,
                "peerIface": "veth1",
                "peerNetns": 6,
                "type": "veth",
                "up": false,
              },
            },
            "listeningSockets": [],
            "routes": [],
          },
          "6": {
            "interfaces": {
              "lo": {
                "addresses": [],
                "altnames": [],
                "macAddress": "00:00:00:00:00:00",
                "mtu": 65536,
                "netnsImmutable": true,
                "type": "loopback",
                "up": false,
              },
              "veth1": {
                "addresses": [],
                "altnames": [],
                "mtu": 1500,
                "peerIface": "veth0",
                "peerNetns": 5,
                "type": "veth",
                "up": false,
              },
            },
            "listeningSockets": [],
            "routes": [],
          },
        },
      }
    `);
  });

  it("should configure a wireguard interface", async () => {
    const features: NetworkCreateAction[] = [
      { type: "CreateNamespace", netns: "test-ns" },
      { type: "CreateWireguard", netns: "test-ns", iface: "wg0" },
      {
        type: "SetWireguardConfig",
        netns: "test-ns",
        iface: "wg0",
        config: {
          privateKey: "abc123",
          listenPort: 51820,
          peers: [
            {
              publicKey: "peerKey1",
              allowedIPs: [parseIpAddressModel("10.0.0.2/32")],
              endpoint: "192.168.1.2:51820",
              persistentKeepalive: 25,
            },
          ],
        },
      },
    ];

    const { desiredState: model } = await processedFeatures(features, null!);
    expect(model).toMatchInlineSnapshot(`
      {
        "namedNetns": {
          "": 0,
          "test-ns": 7,
        },
        "netnsByIno": {
          "0": {
            "interfaces": {
              "lo": {
                "addresses": [],
                "altnames": [],
                "macAddress": "00:00:00:00:00:00",
                "mtu": 65536,
                "netnsImmutable": true,
                "type": "loopback",
                "up": false,
              },
            },
            "listeningSockets": [],
            "routes": [],
          },
          "7": {
            "interfaces": {
              "lo": {
                "addresses": [],
                "altnames": [],
                "macAddress": "00:00:00:00:00:00",
                "mtu": 65536,
                "netnsImmutable": true,
                "type": "loopback",
                "up": false,
              },
              "wg0": {
                "addresses": [],
                "altnames": [],
                "birthNetns": 7,
                "config": {
                  "listenPort": 51820,
                  "peers": [
                    {
                      "allowedIPs": [
                        {
                          "address": "10.0.0.2",
                          "family": "ipv4",
                          "prefixLength": 32,
                        },
                      ],
                      "endpoint": "192.168.1.2:51820",
                      "persistentKeepalive": 25,
                      "publicKey": "peerKey1",
                    },
                  ],
                  "privateKey": "abc123",
                },
                "mtu": 1420,
                "type": "wireguard",
                "up": false,
              },
            },
            "listeningSockets": [],
            "routes": [],
          },
        },
      }
    `);
  });
});
