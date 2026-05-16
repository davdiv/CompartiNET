import { reconcile } from ".";
import { applyAction, NetworkCreateAction } from "../model/actions";
import { CreateNamespaceAction, newNetworkModel } from "../model/actions/namespace";
import { getHardwareMatchActions } from "../model/hardware";
import { NetworkModel } from "../model/networkModel";

export const modelToConfig = (model: NetworkModel) => {
  const config: NetworkCreateAction[] = [];
  const baseModel = newNetworkModel();
  const hardwareMatchActions = getHardwareMatchActions(model);
  const hardwareNetns = new Set<string>();
  for (const { netns } of hardwareMatchActions) {
    hardwareNetns.add(netns);
  }
  hardwareNetns.delete(""); // never create the default netns
  for (const netns of hardwareNetns) {
    const action: CreateNamespaceAction = { type: "CreateNamespace", netns };
    config.push(action);
    applyAction(baseModel, action);
  }
  config.push(...hardwareMatchActions);
  for (const hardwareAction of hardwareMatchActions) {
    applyAction(baseModel, hardwareAction);
  }
  const resolution = reconcile(baseModel, model);
  config.push(...(resolution.actions as NetworkCreateAction[]));
  return {
    config,
    errors: resolution.errors,
  };
};
