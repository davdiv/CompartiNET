import { afterEach, describe, it } from "vitest";
import { cleanupState, runActionAndVerify } from "../harness";

describe("integration / altname actions", () => {
  afterEach(cleanupState);

  it("adds and removes an altname", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "test-ns" });

    // Bring lo up so it can have an altname
    await runActionAndVerify({ type: "SetInterfaceUp", netns: "test-ns", iface: "lo", up: true });

    // Add an altname to lo
    await runActionAndVerify({ type: "AddAltname", netns: "test-ns", iface: "lo", altname: "lo-alt" });

    // Remove the altname
    await runActionAndVerify({ type: "RemoveAltname", netns: "test-ns", altname: "lo-alt" });
  });
});
