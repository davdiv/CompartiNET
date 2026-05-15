import { afterEach, describe, it } from "vitest";
import { cleanupState, runActionAndVerify } from "../harness";

describe("integration / address actions", () => {
  afterEach(cleanupState);

  it("adds and removes an IP v4 address", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "test-ns" });
    await runActionAndVerify({ type: "SetInterfaceUp", netns: "test-ns", iface: "lo", up: true });
    await runActionAndVerify({ type: "AddIpAddress", netns: "test-ns", iface: "lo", ip: { family: "ipv4", address: "10.0.0.1", prefixLength: 32 } });
    await runActionAndVerify({ type: "RemoveIpAddress", netns: "test-ns", iface: "lo", ip: { family: "ipv4", address: "10.0.0.1", prefixLength: 32 } });
  });

  it("adds and removes an IP v6 address", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "test-ns" });
    await runActionAndVerify({ type: "SetInterfaceUp", netns: "test-ns", iface: "lo", up: true });
    await runActionAndVerify({ type: "AddIpAddress", netns: "test-ns", iface: "lo", ip: { family: "ipv6", address: "fe80::2", prefixLength: 64 } });
    await runActionAndVerify({ type: "RemoveIpAddress", netns: "test-ns", iface: "lo", ip: { family: "ipv6", address: "fe80::2", prefixLength: 64 } });
  });
});
