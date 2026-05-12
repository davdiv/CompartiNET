import { afterEach, describe, it } from "vitest";
import { exec } from "../../../src/node/spawnUtils";
import { parseIpAddressModel } from "../../../src/common/model/ip";
import { cleanupState, runActionAndVerify } from "../harness";

describe("integration / wireguard actions", () => {
  afterEach(cleanupState);

  it("creates and deletes a wireguard interface", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "test-ns" });

    await runActionAndVerify({ type: "CreateWireguard", netns: "test-ns", iface: "wg0" });

    await runActionAndVerify({ type: "DeleteWireguard", netns: "test-ns", iface: "wg0" });
  });

  it("creates a wireguard interface and sets its config", async () => {
    await runActionAndVerify({ type: "CreateNamespace", netns: "test-ns" });

    await runActionAndVerify({ type: "CreateWireguard", netns: "test-ns", iface: "wg0" });

    const privateKey = (await exec(["wg", "genkey"])).toString("utf8").trim();

    await runActionAndVerify({
      type: "SetWireguardConfig",
      netns: "test-ns",
      iface: "wg0",
      config: {
        privateKey,
        listenPort: 51820,
        peers: [
          {
            publicKey: "xTIBA5rboUvnH4htodjb2e4AdTyHMzR7tPF1OdvP2WM=",
            allowedIPs: [parseIpAddressModel("10.0.0.1/32")],
            endpoint: "1.2.3.4:51820",
            persistentKeepalive: 25,
          },
        ],
      },
    });

    await runActionAndVerify({ type: "DeleteWireguard", netns: "test-ns", iface: "wg0" });
  });
});
