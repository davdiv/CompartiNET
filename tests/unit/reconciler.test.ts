import { describe, expect, it } from "vitest";
import { applyAction, commandForAction } from "../../src/common/model/actions";
import { newNetns } from "../../src/common/model/actions/namespace";
import { formatCommand } from "../../src/common/model/commands";
import { InterfaceModelWireguard, NetworkModel } from "../../src/common/model/networkModel";
import { checkIfaceExists } from "../../src/common/model/utils";
import { reconcile } from "../../src/common/reconcile";
import { checkReproducibleFromScratch } from "../utils";
import { createAltname, createBridge, createInterface, createNamespace, createTestModel, ns } from "./fixtures";

describe("reconcile", () => {
  const getCommands = (actual: NetworkModel, desired: NetworkModel) => {
    const { actions } = reconcile(actual, desired);
    return actions.map(commandForAction).map(formatCommand).join("\n");
  };

  it("should generate command to create a namespace", () => {
    const actual = createTestModel({});
    const desired = createTestModel({
      "test-ns": createNamespace(),
    });

    const commands = getCommands(actual, desired);
    expect(commands).toMatchInlineSnapshot(`"ip netns add test-ns"`);
  });

  it("should generate command to remove a namespace", () => {
    const actual = createTestModel({
      "test-ns": createNamespace(),
    });
    const desired = createTestModel({});

    const commands = getCommands(actual, desired);
    expect(commands).toMatchInlineSnapshot(`"ip netns del test-ns"`);
  });

  it("should not generate command to add the default namespace", () => {
    const actual = createTestModel({});
    const desired = createTestModel({
      "": createNamespace(),
    });

    const commands = getCommands(actual, desired);
    expect(commands).toMatchInlineSnapshot(`""`);
  });

  it("should not generate command to remove the default namespace", () => {
    const actual = createTestModel({
      "": createNamespace(),
    });
    const desired = createTestModel({});

    const commands = getCommands(actual, desired);
    expect(commands).toMatchInlineSnapshot(`""`);
  });

  it("should generate command to add a missing IP address", () => {
    const actual = createTestModel({
      "test-ns": createNamespace({
        eth0: createInterface(true, []),
      }),
    });
    const desired = createTestModel({
      "test-ns": createNamespace({
        eth0: createInterface(true, ["192.168.1.10/24"]),
      }),
    });

    const commands = getCommands(actual, desired);
    expect(commands).toMatchInlineSnapshot(`"ip -n test-ns addr add 192.168.1.10/24 dev eth0"`);
  });

  it("should generate command to remove an unwanted IP address", () => {
    const actual = createTestModel({
      "test-ns": createNamespace({
        eth0: createInterface(true, ["192.168.1.10/24"]),
      }),
    });
    const desired = createTestModel({
      "test-ns": createNamespace({
        eth0: createInterface(true, []),
      }),
    });

    const commands = getCommands(actual, desired);
    expect(commands).toMatchInlineSnapshot(`"ip -n test-ns addr del 192.168.1.10/24 dev eth0"`);
  });

  it("should atomically migrate interface namespace and name", () => {
    const actual: NetworkModel = createTestModel({
      ns1: {
        interfaces: {
          eth0: {
            type: "hardware",
            up: true,
            altnames: [],
            addresses: [],
            hardwareBus: "pci",
            hardwareDevice: "0000:00:1f.6",
          },
        },
        routes: [],
        listeningSockets: [],
      },
    });
    const desired: NetworkModel = createTestModel({
      ns2: {
        interfaces: {
          wan0: {
            type: "hardware",
            up: true,
            altnames: [],
            addresses: [],
            hardwareBus: "pci",
            hardwareDevice: "0000:00:1f.6",
          },
        },
        routes: [],
        listeningSockets: [],
      },
    });

    const commands = getCommands(actual, desired);
    expect(commands).toMatchInlineSnapshot(`
      "ip netns add ns2
      ip -n ns1 link set eth0 down
      ip -n ns1 link set eth0 name wan0 netns ns2
      ip -n ns2 link set wan0 up
      ip netns del ns1"
    `);
  });

  it("should move interface back to default netns", () => {
    const actual: NetworkModel = createTestModel({
      "": newNetns(),
      ns1: {
        interfaces: {
          eth0: {
            type: "hardware",
            up: false,
            addresses: [],
            altnames: [],
            hardwareBus: "pci",
            hardwareDevice: "0000:00:1f.6",
          },
        },
        routes: [],
        listeningSockets: [],
      },
    });
    const desired: NetworkModel = createTestModel({
      "": {
        interfaces: {
          eth0: {
            type: "hardware",
            up: false,
            addresses: [],
            altnames: [],
            hardwareBus: "pci",
            hardwareDevice: "0000:00:1f.6",
          },
        },
        routes: [],
        listeningSockets: [],
      },
    });

    const commands = getCommands(actual, desired);
    expect(commands).toMatchInlineSnapshot(`
      "ip -n ns1 link set eth0 name eth0 netns $$
      ip netns del ns1"
    `);
  });

  it("should handle interface move without renaming", () => {
    const actual: NetworkModel = createTestModel({
      ns1: {
        interfaces: {
          eth0: {
            type: "hardware",
            up: true,
            addresses: [],
            altnames: [],
            hardwareBus: "pci",
            hardwareDevice: "0000:00:1f.6",
          },
        },
        routes: [],
        listeningSockets: [],
      },
    });
    const desired: NetworkModel = createTestModel({
      ns2: {
        interfaces: {
          eth0: {
            type: "hardware",
            up: true,
            addresses: [],
            altnames: [],
            hardwareBus: "pci",
            hardwareDevice: "0000:00:1f.6",
          },
        },
        routes: [],
        listeningSockets: [],
      },
    });

    const commands = getCommands(actual, desired);
    expect(commands).toMatchInlineSnapshot(`
      "ip netns add ns2
      ip -n ns1 link set eth0 down
      ip -n ns1 link set eth0 name eth0 netns ns2
      ip -n ns2 link set eth0 up
      ip netns del ns1"
    `);
  });

  it("should handle interface renaming without move", () => {
    const actual: NetworkModel = createTestModel({
      ns1: {
        interfaces: {
          eth0: {
            type: "hardware",
            up: true,
            addresses: [],
            altnames: [],
            hardwareBus: "pci",
            hardwareDevice: "0000:00:1f.6",
          },
        },
        routes: [],
        listeningSockets: [],
      },
    });
    const desired: NetworkModel = createTestModel({
      ns1: {
        interfaces: {
          wan0: {
            type: "hardware",
            up: true,
            addresses: [],
            altnames: [],
            hardwareBus: "pci",
            hardwareDevice: "0000:00:1f.6",
          },
        },
        routes: [],
        listeningSockets: [],
      },
    });

    const commands = getCommands(actual, desired);
    expect(commands).toMatchInlineSnapshot(`
      "ip -n ns1 link set eth0 down
      ip -n ns1 link set eth0 name wan0
      ip -n ns1 link set wan0 up"
    `);
  });

  it("should handle swapping two interface names", () => {
    const actual: NetworkModel = createTestModel({
      ns1: {
        interfaces: {
          eth0: {
            type: "hardware",
            up: true,
            addresses: [],
            altnames: [],
            hardwareBus: "pci",
            hardwareDevice: "0000:00:1f.6",
          },
          eth1: {
            type: "hardware",
            up: true,
            addresses: [],
            altnames: [],
            hardwareBus: "pci",
            hardwareDevice: "0000:00:1g.6",
          },
        },
        routes: [],
        listeningSockets: [],
      },
    });
    const desired: NetworkModel = createTestModel({
      ns1: {
        interfaces: {
          eth1: {
            type: "hardware",
            up: true,
            addresses: [],
            altnames: [],
            hardwareBus: "pci",
            hardwareDevice: "0000:00:1f.6",
          },
          eth0: {
            type: "hardware",
            up: true,
            addresses: [],
            altnames: [],
            hardwareBus: "pci",
            hardwareDevice: "0000:00:1g.6",
          },
        },
        routes: [],
        listeningSockets: [],
      },
    });

    const commands = getCommands(actual, desired);
    expect(commands).toMatchInlineSnapshot(`
      "ip -n ns1 link set eth0 down
      ip -n ns1 link set eth0 name cnrm0
      ip -n ns1 link set eth1 down
      ip -n ns1 link set eth1 name cnrm1
      ip -n ns1 link set cnrm0 name eth1
      ip -n ns1 link set cnrm1 name eth0
      ip -n ns1 link set eth1 up
      ip -n ns1 link set eth0 up"
    `);
  });

  it("should apply AddBridgePort and set bridgeMember", () => {
    const model: NetworkModel = createTestModel({
      "test-ns": {
        interfaces: {
          eth0: createInterface(),
          br0: createBridge(),
        },
        routes: [],
        listeningSockets: [],
      },
    });
    applyAction(model, { type: "AddBridgePort", netns: "test-ns", iface: "eth0", bridge: "br0" });
    expect((ns(model, "test-ns").interfaces["eth0"] as import("../../src/common/model/networkModel").RealInterfaceModel).bridgeMember).toEqual({
      bridge: "br0",
      vlans: [{ vlanId: 1, untagged: true }],
      pvid: 1,
    });
  });

  it("should apply RemoveBridgePort and clear bridgeMember", () => {
    const model: NetworkModel = createTestModel({
      "test-ns": {
        interfaces: {
          eth0: createInterface(true, [], { bridge: "br0", vlans: [{ vlanId: 1, untagged: true }], pvid: 1 }),
        },
        routes: [],
        listeningSockets: [],
      },
    });
    applyAction(model, { type: "RemoveBridgePort", netns: "test-ns", iface: "eth0" });
    expect((ns(model, "test-ns").interfaces["eth0"] as import("../../src/common/model/networkModel").RealInterfaceModel).bridgeMember).toBeUndefined();
  });

  it("should generate command to clear PVID from a VLAN while keeping the VLAN", () => {
    const actual: NetworkModel = createTestModel({
      "test-ns": {
        interfaces: {
          eth0: createInterface(true, [], { bridge: "br0", vlans: [{ vlanId: 20, untagged: true }], pvid: 20 }),
          br0: createBridge(true, [], true),
        },
        routes: [],
        listeningSockets: [],
      },
    });
    const desired: NetworkModel = createTestModel({
      "test-ns": {
        interfaces: {
          eth0: createInterface(true, [], { bridge: "br0", vlans: [{ vlanId: 20, untagged: true }] }),
          br0: createBridge(true, [], true),
        },
        routes: [],
        listeningSockets: [],
      },
    });

    const commands = getCommands(actual, desired);
    expect(commands).toMatchInlineSnapshot(`"bridge -n test-ns vlan add dev eth0 vid 20 untagged"`);
    expect(commands).not.toContain("pvid");
  });

  it("should create wireguard in birthNetns and move to target netns", async () => {
    const actual: NetworkModel = createTestModel({
      "": newNetns(),
      ns1: newNetns(),
      ns2: newNetns(),
    });
    const desired: NetworkModel = createTestModel({
      "": newNetns(),
      ns1: newNetns(),
      ns2: {
        interfaces: {
          lo: newNetns().interfaces.lo,
          wg0: {
            type: "wireguard",
            up: false,
            mtu: 1420,
            addresses: [],
            altnames: [],
            birthNetns: undefined,
            config: { peers: [] },
          },
        },
        routes: [],
        listeningSockets: [],
      },
    });
    (ns(desired, "ns2").interfaces["wg0"] as InterfaceModelWireguard).birthNetns = desired.namedNetns.ns1;

    const commands = getCommands(actual, desired);
    expect(commands).toMatchInlineSnapshot(`
      "ip -n ns1 link add wg0 type wireguard
      ip -n ns1 link set wg0 name wg0 netns ns2"
    `);
    await checkReproducibleFromScratch(desired);
  });

  it("should create wireguard directly in target netns when birthNetns matches", () => {
    const actual: NetworkModel = createTestModel({
      "": {
        interfaces: {},
        routes: [],
        listeningSockets: [],
      },
    });
    const desired: NetworkModel = createTestModel({
      "": {
        interfaces: {
          wg0: {
            type: "wireguard",
            up: false,
            addresses: [],
            altnames: [],
            birthNetns: undefined,
            config: { peers: [] },
          },
        },
        routes: [],
        listeningSockets: [],
      },
    });
    (ns(desired, "").interfaces["wg0"] as InterfaceModelWireguard).birthNetns = desired.namedNetns[""];

    const commands = getCommands(actual, desired);
    expect(commands).toMatchInlineSnapshot(`"ip link add wg0 type wireguard"`);
  });

  it("should generate MoveWirelessPhy for netns-immutable wireless hardware", () => {
    const actual: NetworkModel = createTestModel({
      ns1: {
        interfaces: {
          wlan0: {
            type: "hardware",
            up: false,
            addresses: [],
            altnames: [],
            hardwareBus: "pci",
            hardwareDevice: "0000:00:14.3",
            phy: "phy0",
            netnsImmutable: true,
          },
        },
        routes: [],
        listeningSockets: [],
      },
    });
    const desired: NetworkModel = createTestModel({
      ns2: {
        interfaces: {
          wlan0: {
            type: "hardware",
            up: false,
            addresses: [],
            altnames: [],
            hardwareBus: "pci",
            hardwareDevice: "0000:00:14.3",
            phy: "phy0",
            netnsImmutable: true,
          },
        },
        routes: [],
        listeningSockets: [],
      },
    });

    const commands = getCommands(actual, desired);
    expect(commands).toMatchInlineSnapshot(`
			"ip netns add ns2
			ip netns exec ns1 iw phy phy0 set netns name ns2
			ip netns del ns1"
		`);
  });

  it("should generate MoveWirelessPhy with rename for wireless hardware", () => {
    const actual: NetworkModel = createTestModel({
      ns1: {
        interfaces: {
          wlan0: {
            type: "hardware",
            up: false,
            addresses: [],
            altnames: [],
            hardwareBus: "pci",
            hardwareDevice: "0000:00:14.3",
            phy: "phy0",
            netnsImmutable: true,
          },
        },
        routes: [],
        listeningSockets: [],
      },
    });
    const desired: NetworkModel = createTestModel({
      ns2: {
        interfaces: {
          wifi0: {
            type: "hardware",
            up: false,
            addresses: [],
            altnames: [],
            hardwareBus: "pci",
            hardwareDevice: "0000:00:14.3",
            phy: "phy0",
            netnsImmutable: true,
          },
        },
        routes: [],
        listeningSockets: [],
      },
    });

    const commands = getCommands(actual, desired);
    expect(commands).toMatchInlineSnapshot(`
      "ip netns add ns2
      ip netns exec ns1 iw phy phy0 set netns name ns2
      ip -n ns2 link set wlan0 name wifi0
      ip netns del ns1"
    `);
  });

  it("should error when desired state places interfaces from the same phy in different namespaces", () => {
    const actual: NetworkModel = createTestModel({
      ns1: {
        interfaces: {
          wlan0: {
            type: "hardware",
            up: false,
            addresses: [],
            altnames: [],
            hardwareBus: "pci",
            hardwareDevice: "0000:00:14.3",
            phy: "phy0",
            netnsImmutable: true,
          },
          wlan1: {
            type: "hardware",
            up: false,
            addresses: [],
            altnames: [],
            hardwareBus: "pci",
            hardwareDevice: "0000:00:14.3",
            phy: "phy0",
            netnsImmutable: true,
          },
        },
        routes: [],
        listeningSockets: [],
      },
    });
    const desired: NetworkModel = createTestModel({
      ns1: {
        interfaces: {
          wlan0: {
            type: "hardware",
            up: false,
            addresses: [],
            altnames: [],
            hardwareBus: "pci",
            hardwareDevice: "0000:00:14.3",
            phy: "phy0",
            netnsImmutable: true,
          },
        },
        routes: [],
        listeningSockets: [],
      },
      ns2: {
        interfaces: {
          wlan1: {
            type: "hardware",
            up: false,
            addresses: [],
            altnames: [],
            hardwareBus: "pci",
            hardwareDevice: "0000:00:14.3",
            phy: "phy0",
            netnsImmutable: true,
          },
        },
        routes: [],
        listeningSockets: [],
      },
    });

    const { actions, errors } = reconcile(actual, desired);
    expect(errors.length).toBeGreaterThan(0);
    // Even with errors, namespace creation/deletion actions may still be generated
    expect(actions).toEqual(expect.arrayContaining([{ type: "CreateNamespace", netns: "ns2" }]));
  });

  it("should generate AddAltname and RemoveAltname commands", () => {
    const actual: NetworkModel = createTestModel({
      "test-ns": {
        interfaces: {
          eth0: createInterface(true, [], undefined, ["eth0-old"]),
          "eth0-old": createAltname("eth0"),
        },
        routes: [],
        listeningSockets: [],
      },
    });
    const desired: NetworkModel = createTestModel({
      "test-ns": {
        interfaces: {
          eth0: createInterface(true, [], undefined, ["eth0-new"]),
          "eth0-new": createAltname("eth0"),
        },
        routes: [],
        listeningSockets: [],
      },
    });

    const commands = getCommands(actual, desired);
    expect(commands).toMatchInlineSnapshot(`
      "ip -n test-ns link property del dev eth0-old altname eth0-old
      ip -n test-ns link property add dev eth0 altname eth0-new"
    `);
  });

  it("should resolve altname via checkIfaceExists", () => {
    const model: NetworkModel = createTestModel({
      "test-ns": {
        interfaces: {
          eth0: createInterface(true, [], undefined, ["eth0-alt"]),
          "eth0-alt": createAltname("eth0"),
        },
        routes: [],
        listeningSockets: [],
      },
    });
    const { ifaceModel } = checkIfaceExists(model, "test-ns", "eth0-alt");
    expect(ifaceModel.type).toBe("unknown");
  });

  it("should migrate altnames when moving interface across namespaces", () => {
    const model: NetworkModel = createTestModel({
      ns1: {
        interfaces: {
          eth0: createInterface(false, [], undefined, ["eth0-alt"]),
          "eth0-alt": createAltname("eth0"),
        },
        routes: [],
        listeningSockets: [],
      },
      ns2: {
        interfaces: {},
        routes: [],
        listeningSockets: [],
      },
    });
    applyAction(model, { type: "MoveInterface", oldNetns: "ns1", oldIface: "eth0", newNetns: "ns2", newIface: "eth0" });
    expect(ns(model, "ns1").interfaces["eth0"]).toBeUndefined();
    expect(ns(model, "ns1").interfaces["eth0-alt"]).toBeUndefined();
    expect(ns(model, "ns2").interfaces["eth0"]).toBeDefined();
    expect(ns(model, "ns2").interfaces["eth0-alt"]).toEqual({ type: "altname", iface: "eth0" });
  });

  it("should update altname references when renaming interface", () => {
    const model: NetworkModel = createTestModel({
      ns1: {
        interfaces: {
          eth0: createInterface(false, [], undefined, ["eth0-alt"]),
          "eth0-alt": createAltname("eth0"),
        },
        routes: [],
        listeningSockets: [],
      },
    });
    applyAction(model, { type: "MoveInterface", oldNetns: "ns1", oldIface: "eth0", newNetns: "ns1", newIface: "wan0" });
    expect(ns(model, "ns1").interfaces["eth0"]).toBeUndefined();
    expect(ns(model, "ns1").interfaces["wan0"]).toBeDefined();
    expect(ns(model, "ns1").interfaces["eth0-alt"]).toEqual({ type: "altname", iface: "wan0" });
  });
});
