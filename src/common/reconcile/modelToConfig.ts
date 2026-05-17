import { WireguardFeature } from "../features/wireguard";
import { applyAction, ConfigNetworkCreateAction } from "../model/actions";
import { CreateNamespaceAction, newNetworkModel } from "../model/actions/namespace";
import { newWireguard } from "../model/actions/wireguard";
import { getHardwareMatchActions } from "../model/hardware";
import { NetworkModel } from "../model/networkModel";
import { reconcile } from "./index";

export const modelToConfig = (model: NetworkModel) => {
  const config: (ConfigNetworkCreateAction | WireguardFeature)[] = [];
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
  const wireguardFeatures: WireguardFeature[] = [];
  let lastWireguardFeature: WireguardFeature | undefined;
  for (const action of resolution.actions) {
    if (action.type === "CreateWireguard") {
      lastWireguardFeature = {
        type: "Wireguard",
        netns: action.netns,
        iface: action.iface,
        config: newWireguard().config,
      };
      config.push(lastWireguardFeature);
      wireguardFeatures.push(lastWireguardFeature);
    } else if (action.type === "MoveInterface" && action.oldNetns === lastWireguardFeature?.netns && action.oldIface === lastWireguardFeature?.iface) {
      // the reconciler always sends the MoveInterface action just after the corresponding CreateWireguard action
      lastWireguardFeature.birthNetns = lastWireguardFeature.birthNetns ?? lastWireguardFeature.netns;
      lastWireguardFeature.birthIface = lastWireguardFeature.birthIface ?? lastWireguardFeature.iface;
      lastWireguardFeature.netns = action.newNetns;
      lastWireguardFeature.iface = action.newIface;
      if (lastWireguardFeature.birthIface !== lastWireguardFeature.iface) {
        delete lastWireguardFeature.birthIface;
      }
    } else if (action.type === "SetWireguardConfig") {
      const feature = wireguardFeatures.find(({ netns, iface }) => action.netns === netns && action.iface === iface);
      if (!feature) {
        throw new Error("Assert failure: could not find wireguard interface");
      }
      feature.config = action.config;
    } else {
      config.push(action as ConfigNetworkCreateAction);
    }
  }
  return {
    config,
    errors: resolution.errors,
  };
};
