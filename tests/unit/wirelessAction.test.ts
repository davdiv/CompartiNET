import { describe, expect, it } from "vitest";
import { createTestModel, ns } from "./fixtures";
import { applyMoveWirelessPhy, commandForMoveWirelessPhy } from "../../src/common/model/actions/wireless";
import { applyAction } from "../../src/common/model/actions";
import { InterfaceModelHardware, NetworkModel, RealInterfaceModel } from "../../src/common/model/networkModel";

describe("MoveWirelessPhy action", () => {
  it("moves a wireless interface to another namespace", () => {
    const model: NetworkModel = createTestModel({});
    applyAction(model, { type: "CreateNamespace", netns: "ns1" });
    applyAction(model, { type: "CreateNamespace", netns: "ns2" });
    applyAction(model, { type: "MatchHardware", netns: "ns1", iface: "wlan0", hardwareBus: "pci", hardwareDevice: "0000:00:14.3" });
    (ns(model, "ns1").interfaces["wlan0"] as InterfaceModelHardware).phy = "phy0";
    (ns(model, "ns1").interfaces["wlan0"] as RealInterfaceModel).up = false;

    applyMoveWirelessPhy(model, {
      type: "MoveWirelessPhy",
      phy: "phy0",
      oldNetns: "ns1",
      newNetns: "ns2",
    });

    expect(ns(model, "ns1").interfaces["wlan0"]).toBeUndefined();
    expect(ns(model, "ns2").interfaces["wlan0"]).toBeDefined();
    expect((ns(model, "ns2").interfaces["wlan0"] as InterfaceModelHardware).phy).toBe("phy0");
  });

  it("moves all interfaces on the same phy", () => {
    const model: NetworkModel = createTestModel({});
    applyAction(model, { type: "CreateNamespace", netns: "ns1" });
    applyAction(model, { type: "CreateNamespace", netns: "ns2" });
    applyAction(model, { type: "MatchHardware", netns: "ns1", iface: "wlan0", hardwareBus: "pci", hardwareDevice: "0000:00:14.3" });
    applyAction(model, { type: "MatchHardware", netns: "ns1", iface: "wlan1", hardwareBus: "pci", hardwareDevice: "0000:00:14.3" });
    (ns(model, "ns1").interfaces["wlan0"] as InterfaceModelHardware).phy = "phy0";
    (ns(model, "ns1").interfaces["wlan0"] as RealInterfaceModel).up = false;
    (ns(model, "ns1").interfaces["wlan1"] as InterfaceModelHardware).phy = "phy0";
    (ns(model, "ns1").interfaces["wlan1"] as RealInterfaceModel).up = false;

    applyMoveWirelessPhy(model, {
      type: "MoveWirelessPhy",
      phy: "phy0",
      oldNetns: "ns1",
      newNetns: "ns2",
    });

    expect(ns(model, "ns1").interfaces["wlan0"]).toBeUndefined();
    expect(ns(model, "ns1").interfaces["wlan1"]).toBeUndefined();
    expect(ns(model, "ns2").interfaces["wlan0"]).toBeDefined();
    expect(ns(model, "ns2").interfaces["wlan1"]).toBeDefined();
  });
});

describe("commandForMoveWirelessPhy", () => {
  it("generates iw set netns for cross-namespace move", () => {
    const cmds = commandForMoveWirelessPhy({
      type: "MoveWirelessPhy",
      phy: "phy0",
      oldNetns: "ns1",
      newNetns: "ns2",
    });
    expect(cmds).toEqual(["ip", "netns", "exec", "ns1", "iw", "phy", "phy0", "set", "netns", "name", "ns2"]);
  });
});
