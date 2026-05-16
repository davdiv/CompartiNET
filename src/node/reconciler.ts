import { isDeepStrictEqual } from "node:util";
import { getContext, notifier, reactive, ReactiveFn, watcher } from "signalium";
import { MarkReloadable } from "../common/features/createFeatures";
import { commandForAction } from "../common/model/actions";
import { formatCommand } from "../common/model/commands";
import { applyRuntimeMeta, recordActionMeta, type InterfaceRuntimeMetaMap } from "../common/model/interfaceMeta";
import { reconcile } from "../common/reconcile";
import { collectState, getNetnsIno, type CollectStateOptions } from "./collectState";
import { createServicesManager, processFeatures, type Feature } from "./features";
import { createNetnsWorkerPool } from "./netnsWorker/pool";
import { runCommand } from "./spawnUtils";

export interface ReconcilerOptions {
  netnsDirs?: string[];
}

export const createReconciler = (features: ReactiveFn<Promise<Feature[]> | Feature[], []>, options: ReconcilerOptions = {}) => {
  const collectStateOptions: CollectStateOptions = { netnsDirs: options.netnsDirs };
  const refreshState = notifier();
  const runtimeMeta: InterfaceRuntimeMetaMap = {};
  const currentState = reactive(
    async () => {
      refreshState.consume();
      getContext(MarkReloadable)();
      const { state: model, errors } = await collectState(collectStateOptions);
      if (errors.length > 0) {
        console.error("State collection errors:", errors);
      }
      applyRuntimeMeta(model, runtimeMeta);
      serviceManager.applySocketMeta(model);
      return model;
    },
    {
      equals: isDeepStrictEqual,
    },
  );
  const processedFeatures = reactive(async () => await processFeatures(await features(), serviceManager.context));
  const desiredState = reactive(async () => (await processedFeatures()).desiredState, { equals: isDeepStrictEqual });
  const desiredServices = reactive(async () => (await processedFeatures()).desiredServices, { equals: isDeepStrictEqual });
  const serviceManager = createServicesManager(desiredServices);
  const reconciliationResults = reactive(
    async () => {
      const [current, desired] = await Promise.all([currentState(), desiredState()]);
      const { actions, errors } = reconcile(current, desired);
      return { actions, errors, namedNetns: current.namedNetns };
    },
    {
      equals: isDeepStrictEqual,
    },
  );
  const applyReconciliation = reactive(async () => {
    const { actions, errors, namedNetns: currentNamedNetns } = await reconciliationResults();
    if (errors.length > 0) {
      console.log(`Errors:\n - ${errors.join("\n - ")}`);
    }
    if (actions.length > 0) {
      const namedNetns = { ...currentNamedNetns };
      using pool = createNetnsWorkerPool();
      for (const action of actions) {
        const command = commandForAction(action);
        console.log(formatCommand(command));
        await runCommand(command, pool);
        if (action.type === "CreateNamespace") {
          namedNetns[action.netns] = await getNetnsIno(action.netns);
        }
        recordActionMeta(runtimeMeta, action, namedNetns);
      }
    }
    await serviceManager.run();
    if (actions.length > 0) {
      setTimeout(() => refreshState.notify());
    }
  });
  const watcherInstance = watcher(() => applyReconciliation().isSettled);
  return {
    currentState,
    desiredState,
    reconciliationResults,
    applyReconciliation,
    refreshState: () => refreshState.notify(),
    watcher: watcherInstance,
  };
};
