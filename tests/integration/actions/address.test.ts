import { afterEach, describe, it } from "vitest";
import { cleanupState, runActionAndVerify } from "../harness";

describe("integration / address actions", () => {
  afterEach(cleanupState);

  it("adds and removes an IP address", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "test-ns" });

    // Add IP to the loopback interface inside the namespace
    await runActionAndVerify({ type: "AddIpAddress", netns: "test-ns", iface: "lo", ip: { family: "ipv4", address: "10.0.0.1", prefixLength: 32 } });

    await runActionAndVerify({ type: "RemoveIpAddress", netns: "test-ns", iface: "lo", ip: { family: "ipv4", address: "10.0.0.1", prefixLength: 32 } });
  });
});
