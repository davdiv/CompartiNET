import { describe, expect, it } from "vitest";
import { applyMoveInterface, applySetInterfaceUp, commandForMoveInterface, commandForSetInterfaceUp } from "../../src/common/model/actions/interface";
import { InterfaceModelVeth, NetworkModel, RealInterfaceModel } from "../../src/common/model/networkModel";
import { createInterface, createBridge, createBridgeMember, createNamespace } from "./fixtures";
import { createTestModel, ns } from "./fixtures";

const getRealIface = (model: NetworkModel, netns: string, iface: string) => ns(model, netns).interfaces[iface] as RealInterfaceModel;

describe("SetInterfaceUp action", () => {
  it("sets interface state", () => {
    const model: NetworkModel = createTestModel({
      "test-ns": createNamespace({ eth0: createInterface(false) }, []),
    });
    applySetInterfaceUp(model, { type: "SetInterfaceUp", netns: "test-ns", iface: "eth0", up: true });
    expect(getRealIface(model, "test-ns", "eth0").up).toBe(true);
  });
});

describe("MoveInterface action", () => {
  it("moves an interface between namespaces", () => {
    const model: NetworkModel = createTestModel({
      ns1: {
        interfaces: { eth0: createInterface(false) },
        routes: [],
        listeningSockets: [],
      },
      ns2: createNamespace({}),
    });
    applyMoveInterface(model, { type: "MoveInterface", oldNetns: "ns1", oldIface: "eth0", newNetns: "ns2", newIface: "eth0" });
    expect(ns(model, "ns1").interfaces["eth0"]).toBeUndefined();
    expect(ns(model, "ns2").interfaces["eth0"]).toBeDefined();
  });

  it("renames an interface within the same namespace", () => {
    const model: NetworkModel = createTestModel({
      ns1: {
        interfaces: { eth0: createInterface(false) },
        routes: [],
        listeningSockets: [],
      },
    });
    applyMoveInterface(model, { type: "MoveInterface", oldNetns: "ns1", oldIface: "eth0", newNetns: "ns1", newIface: "wan0" });
    expect(ns(model, "ns1").interfaces["eth0"]).toBeUndefined();
    expect(ns(model, "ns1").interfaces["wan0"]).toBeDefined();
  });

  it("moves an up interface between namespaces and brings it down", () => {
    const model: NetworkModel = createTestModel({
      ns1: {
        interfaces: { eth0: createInterface(true) },
        routes: [],
        listeningSockets: [],
      },
      ns2: createNamespace({}),
    });
    applyMoveInterface(model, { type: "MoveInterface", oldNetns: "ns1", oldIface: "eth0", newNetns: "ns2", newIface: "eth0" });
    expect(ns(model, "ns1").interfaces["eth0"]).toBeUndefined();
    expect(ns(model, "ns2").interfaces["eth0"]).toBeDefined();
    expect(getRealIface(model, "ns2", "eth0").up).toBe(false);
  });

  it("renames an up interface within the same namespace and preserves its state", () => {
    const model: NetworkModel = createTestModel({
      ns1: {
        interfaces: { eth0: createInterface(true) },
        routes: [],
        listeningSockets: [],
      },
    });
    applyMoveInterface(model, { type: "MoveInterface", oldNetns: "ns1", oldIface: "eth0", newNetns: "ns1", newIface: "wan0" });
    expect(ns(model, "ns1").interfaces["eth0"]).toBeUndefined();
    expect(ns(model, "ns1").interfaces["wan0"]).toBeDefined();
    expect(getRealIface(model, "ns1", "wan0").up).toBe(true);
  });

  it("brings only the moved veth end down", () => {
    const model: NetworkModel = createTestModel({
      ns1: {
        interfaces: {
          veth0: { type: "veth", up: true, addresses: [], altnames: [], peerNetns: 0, peerIface: "veth1" },
          veth1: { type: "veth", up: true, addresses: [], altnames: [], peerNetns: 0, peerIface: "veth0" },
        },
        routes: [],
        listeningSockets: [],
      },
      ns2: createNamespace({}),
    });
    const ns1Inode = model.namedNetns.ns1;
    (getRealIface(model, "ns1", "veth0") as InterfaceModelVeth).peerNetns = ns1Inode;
    (getRealIface(model, "ns1", "veth1") as InterfaceModelVeth).peerNetns = ns1Inode;
    applyMoveInterface(model, { type: "MoveInterface", oldNetns: "ns1", oldIface: "veth1", newNetns: "ns2", newIface: "veth1" });
    expect(getRealIface(model, "ns2", "veth1").up).toBe(false);
    expect(getRealIface(model, "ns1", "veth0").up).toBe(true);
  });

  it("throws when moving a netns-immutable interface to another namespace", () => {
    const model: NetworkModel = createTestModel({
      ns1: {
        interfaces: { eth0: { ...createInterface(false), netnsImmutable: true } as RealInterfaceModel },
        routes: [],
        listeningSockets: [],
      },
      ns2: createNamespace({}),
    });
    expect(() => applyMoveInterface(model, { type: "MoveInterface", oldNetns: "ns1", oldIface: "eth0", newNetns: "ns2", newIface: "eth0" })).toThrow("cannot be moved to another namespace");
  });

  it("allows moving a netns-immutable interface within the same namespace", () => {
    const model: NetworkModel = createTestModel({
      ns1: {
        interfaces: { eth0: { ...createInterface(false), netnsImmutable: true } as RealInterfaceModel },
        routes: [],
        listeningSockets: [],
      },
    });
    applyMoveInterface(model, { type: "MoveInterface", oldNetns: "ns1", oldIface: "eth0", newNetns: "ns1", newIface: "wan0" });
    expect(ns(model, "ns1").interfaces["eth0"]).toBeUndefined();
    expect(ns(model, "ns1").interfaces["wan0"]).toBeDefined();
  });

  it("moves a bridge member between namespaces", () => {
    const model: NetworkModel = createTestModel({
      ns1: {
        interfaces: {
          eth0: createInterface(false, [], createBridgeMember("br0")),
          br0: createBridge(),
        },
        routes: [],
        listeningSockets: [],
      },
      ns2: createNamespace({}),
    });
    applyMoveInterface(model, { type: "MoveInterface", oldNetns: "ns1", oldIface: "eth0", newNetns: "ns2", newIface: "eth0" });
    expect(ns(model, "ns1").interfaces["eth0"]).toBeUndefined();
    const moved = ns(model, "ns2").interfaces["eth0"];
    expect(moved).toBeDefined();
    expect(getRealIface(model, "ns2", "eth0").bridgeMember).toBeUndefined();
  });

  it("preserves bridgeMember when renaming an interface within a namespace", () => {
    const model: NetworkModel = createTestModel({
      ns1: {
        interfaces: {
          eth0: createInterface(false, [], createBridgeMember("br0")),
          br0: createBridge(),
        },
        routes: [],
        listeningSockets: [],
      },
    });
    applyMoveInterface(model, { type: "MoveInterface", oldNetns: "ns1", oldIface: "eth0", newNetns: "ns1", newIface: "wan0" });
    const renamed = ns(model, "ns1").interfaces["wan0"];
    expect(renamed).toBeDefined();
    expect(getRealIface(model, "ns1", "wan0").bridgeMember).toEqual(createBridgeMember("br0"));
  });

  it("throws when target interface already exists", () => {
    const model: NetworkModel = createTestModel({
      ns1: {
        interfaces: { eth0: createInterface(false), eth1: createInterface(false) },
        routes: [],
        listeningSockets: [],
      },
    });
    expect(() => applyMoveInterface(model, { type: "MoveInterface", oldNetns: "ns1", oldIface: "eth0", newNetns: "ns1", newIface: "eth1" })).toThrow("already exists");
  });
});

describe("commandForMoveInterface", () => {
  it("generates ip link set netns and name command", () => {
    const cmd = commandForMoveInterface({ type: "MoveInterface", oldNetns: "ns1", oldIface: "eth0", newNetns: "ns2", newIface: "wan0" });
    expect(cmd).toEqual(["ip", "netns", "exec", "ns1", "ip", "link", "set", "eth0", "name", "wan0", "netns", "ns2"]);
  });

  it("generates ip link set name only when staying in the same namespace", () => {
    const cmd = commandForMoveInterface({ type: "MoveInterface", oldNetns: "ns1", oldIface: "eth0", newNetns: "ns1", newIface: "wan0" });
    expect(cmd).toEqual(["ip", "netns", "exec", "ns1", "ip", "link", "set", "eth0", "name", "wan0"]);
  });

  it("generates processPid when moving to the default namespace", () => {
    const cmd = commandForMoveInterface({ type: "MoveInterface", oldNetns: "ns1", oldIface: "eth0", newNetns: "", newIface: "eth0" });
    expect(cmd).toEqual(["ip", "netns", "exec", "ns1", "ip", "link", "set", "eth0", "name", "eth0", "netns", { type: "processPid" }]);
  });

  it("handles move from default namespace to named namespace", () => {
    const cmd = commandForMoveInterface({ type: "MoveInterface", oldNetns: "", oldIface: "eth0", newNetns: "ns1", newIface: "eth0" });
    expect(cmd).toEqual(["ip", "link", "set", "eth0", "name", "eth0", "netns", "ns1"]);
  });
});

describe("commandForSetInterfaceUp", () => {
  it("generates ip link set state command", () => {
    const cmd = commandForSetInterfaceUp({ type: "SetInterfaceUp", netns: "test-ns", iface: "eth0", up: true });
    expect(cmd).toEqual(["ip", "netns", "exec", "test-ns", "ip", "link", "set", "eth0", "up"]);
  });
});
