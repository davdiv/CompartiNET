import { afterEach, describe, it } from "vitest";
import { cleanupState, runActionAndVerify } from "../harness";

describe("integration / loopback auto addresses", () => {
  afterEach(cleanupState);

  it("adds auto addresses when loopback is brought up", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "test-ns" });

    await runActionAndVerify({ type: "SetInterfaceUp", netns: "test-ns", iface: "lo", up: true });
  });

  it("removes IPv6 addresses when loopback is brought down", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "test-ns" });

    await runActionAndVerify({ type: "SetInterfaceUp", netns: "test-ns", iface: "lo", up: true });

    await runActionAndVerify({ type: "SetInterfaceUp", netns: "test-ns", iface: "lo", up: false });
  });

  it("keeps custom IPv4 addresses alongside auto addresses when up", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "test-ns" });

    await runActionAndVerify({ type: "AddIpAddress", netns: "test-ns", iface: "lo", ip: { family: "ipv4", address: "10.0.0.1", prefixLength: 32 } });

    await runActionAndVerify({ type: "SetInterfaceUp", netns: "test-ns", iface: "lo", up: true });
  });

  it("preserves custom IPv4 addresses when loopback goes down and back up", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "test-ns" });

    await runActionAndVerify({ type: "AddIpAddress", netns: "test-ns", iface: "lo", ip: { family: "ipv4", address: "10.0.0.1", prefixLength: 32 } });

    await runActionAndVerify({ type: "SetInterfaceUp", netns: "test-ns", iface: "lo", up: true });

    await runActionAndVerify({ type: "SetInterfaceUp", netns: "test-ns", iface: "lo", up: false });

    await runActionAndVerify({ type: "SetInterfaceUp", netns: "test-ns", iface: "lo", up: true });
  });

  it("is idempotent when loopback is already up", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "test-ns" });

    await runActionAndVerify({ type: "SetInterfaceUp", netns: "test-ns", iface: "lo", up: true });

    await runActionAndVerify({ type: "SetInterfaceUp", netns: "test-ns", iface: "lo", up: true });
  });

  it("is idempotent when loopback is already down", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "test-ns" });

    await runActionAndVerify({ type: "SetInterfaceUp", netns: "test-ns", iface: "lo", up: false });
  });
});
