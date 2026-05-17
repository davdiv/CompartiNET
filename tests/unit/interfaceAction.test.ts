import { describe, expect, it } from "vitest";
import { applyMoveInterface, applySetInterfaceUp } from "../../src/common/model/actions/interface";
import { newVeth } from "../../src/common/model/actions/veth";
import { InterfaceModelVeth, NetworkModel, RealInterfaceModel } from "../../src/common/model/networkModel";
import { createBridge, createBridgeMember, createInterface, createNamespace, createTestModel, getRealIface, ns } from "./fixtures";

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
      ns1: createNamespace({ eth0: createInterface(false) }),
      ns2: createNamespace({}),
    });
    applyMoveInterface(model, { type: "MoveInterface", oldNetns: "ns1", oldIface: "eth0", newNetns: "ns2", newIface: "eth0" });
    expect(ns(model, "ns1").interfaces["eth0"]).toBeUndefined();
    expect(ns(model, "ns2").interfaces["eth0"]).toBeDefined();
  });

  it("renames an interface within the same namespace", () => {
    const model: NetworkModel = createTestModel({
      ns1: createNamespace({ eth0: createInterface(false) }),
    });
    applyMoveInterface(model, { type: "MoveInterface", oldNetns: "ns1", oldIface: "eth0", newNetns: "ns1", newIface: "wan0" });
    expect(ns(model, "ns1").interfaces["eth0"]).toBeUndefined();
    expect(ns(model, "ns1").interfaces["wan0"]).toBeDefined();
  });

  it("moves an up interface between namespaces and brings it down", () => {
    const model: NetworkModel = createTestModel({
      ns1: createNamespace({ eth0: createInterface(true) }),
      ns2: createNamespace({}),
    });
    applyMoveInterface(model, { type: "MoveInterface", oldNetns: "ns1", oldIface: "eth0", newNetns: "ns2", newIface: "eth0" });
    expect(ns(model, "ns1").interfaces["eth0"]).toBeUndefined();
    expect(ns(model, "ns2").interfaces["eth0"]).toBeDefined();
    expect(getRealIface(model, "ns2", "eth0").up).toBe(false);
  });

  it("renames an up interface within the same namespace and preserves its state", () => {
    const model: NetworkModel = createTestModel({
      ns1: createNamespace({ eth0: createInterface(true) }),
    });
    applyMoveInterface(model, { type: "MoveInterface", oldNetns: "ns1", oldIface: "eth0", newNetns: "ns1", newIface: "wan0" });
    expect(ns(model, "ns1").interfaces["eth0"]).toBeUndefined();
    expect(ns(model, "ns1").interfaces["wan0"]).toBeDefined();
    expect(getRealIface(model, "ns1", "wan0").up).toBe(true);
  });

  it("brings only the moved veth end down", () => {
    const model: NetworkModel = createTestModel({
      ns1: createNamespace({
        veth0: { ...newVeth(0, "veth1"), up: true },
        veth1: { ...newVeth(0, "veth0"), up: true },
      }),
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
      ns1: createNamespace({ eth0: { ...createInterface(false), netnsImmutable: true } as RealInterfaceModel }),
      ns2: createNamespace({}),
    });
    expect(() => applyMoveInterface(model, { type: "MoveInterface", oldNetns: "ns1", oldIface: "eth0", newNetns: "ns2", newIface: "eth0" })).toThrow("cannot be moved to another namespace");
  });

  it("allows moving a netns-immutable interface within the same namespace", () => {
    const model: NetworkModel = createTestModel({
      ns1: createNamespace({ eth0: { ...createInterface(false), netnsImmutable: true } as RealInterfaceModel }),
    });
    applyMoveInterface(model, { type: "MoveInterface", oldNetns: "ns1", oldIface: "eth0", newNetns: "ns1", newIface: "wan0" });
    expect(ns(model, "ns1").interfaces["eth0"]).toBeUndefined();
    expect(ns(model, "ns1").interfaces["wan0"]).toBeDefined();
  });

  it("moves a bridge member between namespaces", () => {
    const model: NetworkModel = createTestModel({
      ns1: createNamespace({
        eth0: createInterface(false, [], createBridgeMember("br0")),
        br0: createBridge(),
      }),
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
      ns1: createNamespace({
        eth0: createInterface(false, [], createBridgeMember("br0")),
        br0: createBridge(),
      }),
    });
    applyMoveInterface(model, { type: "MoveInterface", oldNetns: "ns1", oldIface: "eth0", newNetns: "ns1", newIface: "wan0" });
    const renamed = ns(model, "ns1").interfaces["wan0"];
    expect(renamed).toBeDefined();
    expect(getRealIface(model, "ns1", "wan0").bridgeMember).toEqual(createBridgeMember("br0"));
  });

  it("throws when target interface already exists", () => {
    const model: NetworkModel = createTestModel({
      ns1: createNamespace({ eth0: createInterface(false), eth1: createInterface(false) }),
    });
    expect(() => applyMoveInterface(model, { type: "MoveInterface", oldNetns: "ns1", oldIface: "eth0", newNetns: "ns1", newIface: "eth1" })).toThrow("already exists");
  });
});
