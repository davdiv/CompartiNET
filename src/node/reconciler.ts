import { isDeepStrictEqual } from "node:util";
import { getContext, notifier, reactive, ReactiveFn, watcher } from "signalium";
import { MarkReloadable } from "../common/features/createFeatures";
import { commandForActions } from "../common/model/actions";
import { formatCommand } from "../common/model/commands";
import { applyRuntimeMeta, recordActionMeta, type InterfaceRuntimeMetaMap } from "../common/model/interfaceMeta";
import { reconcile } from "../common/reconcile";
import { collectState, getNs } from "./collectState";
import { createServicesManager, processFeatures, type Feature } from "./features";
import { runCommands } from "./spawnUtils";

export const createReconciler = (features: ReactiveFn<Promise<Feature[]> | Feature[], []>) => {
  const refreshState = notifier();
  const runtimeMeta: InterfaceRuntimeMetaMap = {};
  const currentState = reactive(
    async () => {
      refreshState.consume();
      getContext(MarkReloadable)();
      const model = await collectState();
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
      for (const action of actions) {
        const commands = commandForActions([action]);
        console.log(`Commands:\n - ${commands.map(formatCommand).join("\n - ")}`);
        await runCommands(commands);
        if (action.type === "CreateNamespace") {
          namedNetns[action.netns] = await getNs(action.netns);
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
