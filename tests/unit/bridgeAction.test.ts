import { describe, expect, it } from "vitest";
import {
  applyAddBridgePort,
  applyAddBridgePortVlan,
  applyCreateBridge,
  applyDeleteBridge,
  applyRemoveBridgePort,
  applyRemoveBridgePortVlan,
  applySetBridgeVlanFiltering,
} from "../../src/common/model/actions/bridge";
import { InterfaceModelBridge, NetworkModel, RealInterfaceModel } from "../../src/common/model/networkModel";
import { createBridge, createBridgeMember, createInterface, createNamespace, createTestModel, ns } from "./fixtures";

const getRealIface = (model: NetworkModel, netns: string, iface: string) => ns(model, netns).interfaces[iface] as RealInterfaceModel;

describe("CreateBridge action", () => {
  it("creates a bridge", () => {
    const model: NetworkModel = createTestModel({
      "test-ns": { interfaces: {}, routes: [], listeningSockets: [] },
    });
    applyCreateBridge(model, { type: "CreateBridge", netns: "test-ns", iface: "br0", vlanFiltering: true, stp: false });
    expect(ns(model, "test-ns").interfaces["br0"]).toMatchInlineSnapshot(`
			{
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
			}
		`);
  });

  it("throws when bridge already exists", () => {
    const model: NetworkModel = createTestModel({
      "test-ns": { interfaces: { br0: createBridge() }, routes: [], listeningSockets: [] },
    });
    expect(() => applyCreateBridge(model, { type: "CreateBridge", netns: "test-ns", iface: "br0" })).toThrow("already exists");
  });
});

describe("DeleteBridge action", () => {
  it("deletes a bridge", () => {
    const model: NetworkModel = createTestModel({
      "test-ns": { interfaces: { br0: createBridge() }, routes: [], listeningSockets: [] },
    });
    applyDeleteBridge(model, { type: "DeleteBridge", netns: "test-ns", iface: "br0" });
    expect(ns(model, "test-ns").interfaces["br0"]).toBeUndefined();
  });

  it("clears bridgeMember on member interfaces when deleting a bridge", () => {
    const model: NetworkModel = createTestModel({
      "test-ns": {
        interfaces: {
          br0: createBridge(),
          eth0: createInterface(false, [], createBridgeMember("br0")),
          eth1: createInterface(false, [], createBridgeMember("br0")),
        },
        routes: [],
        listeningSockets: [],
      },
    });
    applyDeleteBridge(model, { type: "DeleteBridge", netns: "test-ns", iface: "br0" });
    expect(ns(model, "test-ns").interfaces["br0"]).toBeUndefined();
    expect(getRealIface(model, "test-ns", "eth0").bridgeMember).toBeUndefined();
    expect(getRealIface(model, "test-ns", "eth1").bridgeMember).toBeUndefined();
  });

  it("throws when bridge does not exist", () => {
    const model: NetworkModel = createTestModel({
      "test-ns": { interfaces: {}, routes: [], listeningSockets: [] },
    });
    expect(() => applyDeleteBridge(model, { type: "DeleteBridge", netns: "test-ns", iface: "br0" })).toThrow("does not exist");
  });

  it("throws when interface is not a bridge", () => {
    const model: NetworkModel = createTestModel({
      "test-ns": { interfaces: { eth0: createInterface() }, routes: [], listeningSockets: [] },
    });
    expect(() => applyDeleteBridge(model, { type: "DeleteBridge", netns: "test-ns", iface: "eth0" })).toThrow("not a bridge");
  });
});

describe("AddBridgePort action", () => {
  it("adds an interface to a bridge", () => {
    const model: NetworkModel = createTestModel({
      "test-ns": createNamespace({ eth0: createInterface(false), br0: createBridge(true, [], false) }, []),
    });
    applyAddBridgePort(model, { type: "AddBridgePort", netns: "test-ns", iface: "eth0", bridge: "br0" });
    expect(getRealIface(model, "test-ns", "eth0").bridgeMember).toEqual({
      bridge: "br0",
      vlans: [{ vlanId: 1, untagged: true }],
      pvid: 1,
    });
  });

  it("throws when bridge does not exist", () => {
    const model: NetworkModel = createTestModel({
      "test-ns": { interfaces: { eth0: createInterface(false) }, routes: [], listeningSockets: [] },
    });
    expect(() => applyAddBridgePort(model, { type: "AddBridgePort", netns: "test-ns", iface: "eth0", bridge: "br0" })).toThrow("does not exist");
  });

  it("throws when target is not a bridge", () => {
    const model: NetworkModel = createTestModel({
      "test-ns": { interfaces: { eth0: createInterface(false), br0: createInterface(false) }, routes: [], listeningSockets: [] },
    });
    expect(() => applyAddBridgePort(model, { type: "AddBridgePort", netns: "test-ns", iface: "eth0", bridge: "br0" })).toThrow("not a bridge");
  });
});

describe("RemoveBridgePort action", () => {
  it("removes an interface from a bridge", () => {
    const model: NetworkModel = createTestModel({
      "test-ns": createNamespace({ eth0: createInterface(false, [], createBridgeMember("br0")) }, []),
    });
    applyRemoveBridgePort(model, { type: "RemoveBridgePort", netns: "test-ns", iface: "eth0" });
    expect(getRealIface(model, "test-ns", "eth0").bridgeMember).toBeUndefined();
  });
});

describe("SetBridgeVlanFiltering action", () => {
  it("sets vlan filtering on a bridge", () => {
    const model: NetworkModel = createTestModel({
      "test-ns": { interfaces: { br0: createBridge(true, [], false) }, routes: [], listeningSockets: [] },
    });
    applySetBridgeVlanFiltering(model, { type: "SetBridgeVlanFiltering", netns: "test-ns", iface: "br0", vlanFiltering: true });
    expect((ns(model, "test-ns").interfaces["br0"] as InterfaceModelBridge).vlanFiltering).toBe(true);
  });
});

describe("AddBridgePortVlan action", () => {
  it("adds a new tagged VLAN to a bridge port", () => {
    const model: NetworkModel = createTestModel({
      "test-ns": {
        interfaces: {
          eth0: createInterface(false, [], createBridgeMember("br0", [{ vlanId: 1, untagged: true }], 1)),
        },
        routes: [],
        listeningSockets: [],
      },
    });
    applyAddBridgePortVlan(model, { type: "AddBridgePortVlan", netns: "test-ns", iface: "eth0", vlanId: 10, untagged: false });
    expect(getRealIface(model, "test-ns", "eth0").bridgeMember!.vlans).toEqual([
      { vlanId: 1, untagged: true },
      { vlanId: 10, untagged: false },
    ]);
  });

  it("adds a new untagged VLAN with pvid", () => {
    const model: NetworkModel = createTestModel({
      "test-ns": {
        interfaces: {
          eth0: createInterface(false, [], createBridgeMember("br0", [{ vlanId: 1, untagged: true }], 1)),
        },
        routes: [],
        listeningSockets: [],
      },
    });
    applyAddBridgePortVlan(model, { type: "AddBridgePortVlan", netns: "test-ns", iface: "eth0", vlanId: 20, untagged: true, pvid: true });
    const bm = getRealIface(model, "test-ns", "eth0").bridgeMember!;
    expect(bm.vlans).toEqual([
      { vlanId: 1, untagged: true },
      { vlanId: 20, untagged: true },
    ]);
    expect(bm.pvid).toBe(20);
  });

  it("updates the tagged flag on an existing VLAN", () => {
    const model: NetworkModel = createTestModel({
      "test-ns": {
        interfaces: {
          eth0: createInterface(false, [], createBridgeMember("br0", [{ vlanId: 1, untagged: true }], 1)),
        },
        routes: [],
        listeningSockets: [],
      },
    });
    applyAddBridgePortVlan(model, { type: "AddBridgePortVlan", netns: "test-ns", iface: "eth0", vlanId: 1, untagged: false });
    const bm = getRealIface(model, "test-ns", "eth0").bridgeMember!;
    expect(bm.vlans).toEqual([{ vlanId: 1, untagged: false }]);
    expect(bm.pvid).toBeUndefined();
  });

  it("clears pvid when re-adding an existing VLAN without pvid flag", () => {
    const model: NetworkModel = createTestModel({
      "test-ns": {
        interfaces: {
          eth0: createInterface(false, [], createBridgeMember("br0", [{ vlanId: 20, untagged: true }], 20)),
        },
        routes: [],
        listeningSockets: [],
      },
    });
    applyAddBridgePortVlan(model, { type: "AddBridgePortVlan", netns: "test-ns", iface: "eth0", vlanId: 20, untagged: true });
    const bm = getRealIface(model, "test-ns", "eth0").bridgeMember!;
    expect(bm.vlans).toEqual([{ vlanId: 20, untagged: true }]);
    expect(bm.pvid).toBeUndefined();
  });

  it("throws when interface is not a bridge port", () => {
    const model: NetworkModel = createTestModel({
      "test-ns": createNamespace({ eth0: createInterface(false) }, []),
    });
    expect(() => applyAddBridgePortVlan(model, { type: "AddBridgePortVlan", netns: "test-ns", iface: "eth0", vlanId: 10, untagged: true })).toThrow("not a bridge port");
  });

  it("adds a tagged VLAN to a bridge self port", () => {
    const model: NetworkModel = createTestModel({
      "test-ns": createNamespace({ br0: createBridge(true, [], false) }, []),
    });
    applyAddBridgePortVlan(model, { type: "AddBridgePortVlan", netns: "test-ns", iface: "br0", vlanId: 10, untagged: false, self: true });
    const br = ns(model, "test-ns").interfaces["br0"] as InterfaceModelBridge;
    expect(br.self.vlans).toEqual([
      { vlanId: 1, untagged: true },
      { vlanId: 10, untagged: false },
    ]);
  });

  it("adds an untagged VLAN to a bridge self port with pvid", () => {
    const model: NetworkModel = createTestModel({
      "test-ns": createNamespace({ br0: createBridge(true, [], false) }, []),
    });
    applyAddBridgePortVlan(model, { type: "AddBridgePortVlan", netns: "test-ns", iface: "br0", vlanId: 20, untagged: true, pvid: true, self: true });
    const br = ns(model, "test-ns").interfaces["br0"] as InterfaceModelBridge;
    expect(br.self.vlans).toEqual([
      { vlanId: 1, untagged: true },
      { vlanId: 20, untagged: true },
    ]);
    expect(br.self.pvid).toBe(20);
  });

  it("throws when self is true but interface is not a bridge", () => {
    const model: NetworkModel = createTestModel({
      "test-ns": createNamespace({ eth0: createInterface(false) }, []),
    });
    expect(() => applyAddBridgePortVlan(model, { type: "AddBridgePortVlan", netns: "test-ns", iface: "eth0", vlanId: 10, untagged: true, self: true })).toThrow("not a bridge");
  });
});

describe("RemoveBridgePortVlan action", () => {
  it("removes a VLAN from a bridge port", () => {
    const model: NetworkModel = createTestModel({
      "test-ns": {
        interfaces: {
          eth0: createInterface(
            false,
            [],
            createBridgeMember(
              "br0",
              [
                { vlanId: 1, untagged: true },
                { vlanId: 10, untagged: false },
              ],
              1,
            ),
          ),
        },
        routes: [],
        listeningSockets: [],
      },
    });
    applyRemoveBridgePortVlan(model, { type: "RemoveBridgePortVlan", netns: "test-ns", iface: "eth0", vlanId: 10 });
    expect(getRealIface(model, "test-ns", "eth0").bridgeMember!.vlans).toEqual([{ vlanId: 1, untagged: true }]);
  });

  it("clears pvid when removing the PVID VLAN", () => {
    const model: NetworkModel = createTestModel({
      "test-ns": {
        interfaces: {
          eth0: createInterface(false, [], createBridgeMember("br0", [{ vlanId: 1, untagged: true }], 1)),
        },
        routes: [],
        listeningSockets: [],
      },
    });
    applyRemoveBridgePortVlan(model, { type: "RemoveBridgePortVlan", netns: "test-ns", iface: "eth0", vlanId: 1 });
    expect(getRealIface(model, "test-ns", "eth0").bridgeMember!.pvid).toBeUndefined();
  });

  it("does nothing when VLAN does not exist on the port", () => {
    const model: NetworkModel = createTestModel({
      "test-ns": {
        interfaces: {
          eth0: createInterface(false, [], createBridgeMember("br0", [{ vlanId: 1, untagged: true }], 1)),
        },
        routes: [],
        listeningSockets: [],
      },
    });
    applyRemoveBridgePortVlan(model, { type: "RemoveBridgePortVlan", netns: "test-ns", iface: "eth0", vlanId: 99 });
    expect(getRealIface(model, "test-ns", "eth0").bridgeMember!.vlans).toEqual([{ vlanId: 1, untagged: true }]);
    expect(getRealIface(model, "test-ns", "eth0").bridgeMember!.pvid).toBe(1);
  });

  it("throws when interface is not a bridge port", () => {
    const model: NetworkModel = createTestModel({
      "test-ns": createNamespace({ eth0: createInterface(false) }, []),
    });
    expect(() => applyRemoveBridgePortVlan(model, { type: "RemoveBridgePortVlan", netns: "test-ns", iface: "eth0", vlanId: 1 })).toThrow("not a bridge port");
  });

  it("removes a VLAN from a bridge self port", () => {
    const model: NetworkModel = createTestModel({
      "test-ns": createNamespace({ br0: createBridge(true, [], false) }, []),
    });
    applyRemoveBridgePortVlan(model, { type: "RemoveBridgePortVlan", netns: "test-ns", iface: "br0", vlanId: 1, self: true });
    const br = ns(model, "test-ns").interfaces["br0"] as InterfaceModelBridge;
    expect(br.self.vlans).toEqual([]);
    expect(br.self.pvid).toBeUndefined();
  });

  it("does nothing when self is true but VLAN does not exist", () => {
    const model: NetworkModel = createTestModel({
      "test-ns": createNamespace({ br0: createBridge(true, [], false) }, []),
    });
    applyRemoveBridgePortVlan(model, { type: "RemoveBridgePortVlan", netns: "test-ns", iface: "br0", vlanId: 99, self: true });
    const br = ns(model, "test-ns").interfaces["br0"] as InterfaceModelBridge;
    expect(br.self.vlans).toEqual([{ vlanId: 1, untagged: true }]);
    expect(br.self.pvid).toBe(1);
  });
});
