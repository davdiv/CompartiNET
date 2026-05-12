import { afterEach, describe, it } from "vitest";
import { cleanupState, runActionAndVerify } from "../harness";

describe("integration / veth actions", () => {
  afterEach(cleanupState);

  it("creates a veth pair across namespaces", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "ns1" });
    await runActionAndVerify({ type: "CreateNamespace", netns: "ns2" });

    await runActionAndVerify({ type: "CreateVeth", netns: "ns1", iface: "veth0", peerNetns: "ns2", peerIface: "veth1" });
  });

  it("deletes a veth pair", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "ns1" });

    await runActionAndVerify({ type: "CreateVeth", netns: "ns1", iface: "veth0", peerNetns: "ns1", peerIface: "veth1" });

    await runActionAndVerify({ type: "DeleteVeth", netns: "ns1", iface: "veth0" });
  });
});
