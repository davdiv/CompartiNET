import { parseArgs } from "node:util";
import { notifier, reactive, withContexts } from "signalium";
import { MarkReloadable } from "../../../common/features/createFeatures";
import { waitAbortSignal } from "../../../common/utils/abort";
import { createReconciler } from "../../reconciler";
import { sdNotifyReady } from "./sdNotify";

const main = async () => {
  const {
    values: { config },
  } = parseArgs({
    options: {
      config: {
        type: "string",
        short: "c",
        default: "/etc/compartinet/config.d",
      },
    },
  });

  console.log("compartinet-manager: starting");

  const abortController = new AbortController();
  process.on("SIGINT", () => abortController.abort());
  process.on("SIGTERM", () => abortController.abort());
  const reloadNotifier = notifier();
  process.on("SIGHUP", () => {
    console.log("compartinet-manager: reloading config");
    reloadNotifier.notify();
  });

  const reconciler = withContexts([[MarkReloadable, () => reloadNotifier.consume()]], () => createReconciler(reactive(() => [{ type: "ConfigDirectory", path: config }])));

  using _interval = setInterval(() => {
    reconciler.refreshState();
  }, 30000);
  const promiseAbort = waitAbortSignal(abortController.signal);

  const unsub = reconciler.watcher.addListener(() => {});

  await Promise.race([reconciler.applyReconciliation(), promiseAbort]);

  if (reconciler.watcher.value) {
    console.log("compartinet-manager: started");
    await sdNotifyReady();
  }

  await waitAbortSignal(abortController.signal);
  unsub();
  console.log("compartinet-manager: stopped");
};

await main();
