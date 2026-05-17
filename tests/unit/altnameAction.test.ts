import { describe, expect, it } from "vitest";
import { applyAction } from "../../src/common/model/actions";
import { applyAddAltname, applyRemoveAltname } from "../../src/common/model/actions/altname";
import { NetworkModel, RealInterfaceModel } from "../../src/common/model/networkModel";
import { createAltname, createTestModel, ns } from "./fixtures";

describe("AddAltname action", () => {
  it("adds an altname to an interface", () => {
    const model: NetworkModel = createTestModel({});
    applyAction(model, { type: "CreateNamespace", netns: "test-ns" });
    // ns creates a lo interface; set it up so it can receive an altname
    (ns(model, "test-ns").interfaces["lo"] as { up: boolean }).up = true;

    applyAddAltname(model, { type: "AddAltname", netns: "test-ns", iface: "lo", altname: "loopback0" });

    expect((ns(model, "test-ns").interfaces["lo"] as RealInterfaceModel).altnames).toContain("loopback0");
    expect(ns(model, "test-ns").interfaces["loopback0"]).toEqual({ type: "altname", iface: "lo" });
  });

  it("throws when adding an altname that already exists on the same interface", () => {
    const model: NetworkModel = createTestModel({});
    applyAction(model, { type: "CreateNamespace", netns: "test-ns" });
    (ns(model, "test-ns").interfaces["lo"] as { up: boolean }).up = true;
    (ns(model, "test-ns").interfaces["lo"] as RealInterfaceModel).altnames = ["loopback0"];
    ns(model, "test-ns").interfaces["loopback0"] = createAltname("lo");

    expect(() => applyAddAltname(model, { type: "AddAltname", netns: "test-ns", iface: "lo", altname: "loopback0" })).toThrow("Interface loopback0 already exists in namespace test-ns");
  });

  it("throws when adding an altname that conflicts with another interface", () => {
    const model: NetworkModel = createTestModel({});
    applyAction(model, { type: "CreateNamespace", netns: "test-ns" });
    applyAction(model, { type: "MatchHardware", netns: "test-ns", iface: "eth0", hardwareBus: "pci", hardwareDevice: "0000:00:1f.6" });

    expect(() => applyAddAltname(model, { type: "AddAltname", netns: "test-ns", iface: "lo", altname: "eth0" })).toThrow("Interface eth0 already exists in namespace test-ns");
  });
});

describe("RemoveAltname action", () => {
  it("removes an altname from an interface", () => {
    const model: NetworkModel = createTestModel({});
    applyAction(model, { type: "CreateNamespace", netns: "test-ns" });
    (ns(model, "test-ns").interfaces["lo"] as { up: boolean }).up = true;
    (ns(model, "test-ns").interfaces["lo"] as RealInterfaceModel).altnames = ["loopback0"];
    ns(model, "test-ns").interfaces["loopback0"] = createAltname("lo");

    applyRemoveAltname(model, { type: "RemoveAltname", netns: "test-ns", altname: "loopback0" });

    expect((ns(model, "test-ns").interfaces["lo"] as RealInterfaceModel).altnames).toEqual([]);
    expect(ns(model, "test-ns").interfaces["loopback0"]).toBeUndefined();
  });

  it("throws when removing an altname that does not exist on the interface", () => {
    const model: NetworkModel = createTestModel({});
    applyAction(model, { type: "CreateNamespace", netns: "test-ns" });
    (ns(model, "test-ns").interfaces["lo"] as { up: boolean }).up = true;

    expect(() => applyRemoveAltname(model, { type: "RemoveAltname", netns: "test-ns", altname: "loopback0" })).toThrow("Interface loopback0 does not exist in namespace test-ns");
  });
});
