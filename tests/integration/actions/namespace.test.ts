import { afterEach, describe, it } from "vitest";
import { cleanupState, runActionAndVerify } from "../harness";

describe("integration / namespace actions", () => {
  afterEach(cleanupState);

  it("creates and deletes a namespace", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "test-ns" });

    await runActionAndVerify({ type: "DeleteNamespace", netns: "test-ns" });
  });
});
