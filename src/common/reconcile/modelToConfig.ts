import { reconcile } from ".";
import { NetworkCreateAction } from "../model/actions";
import { newNetworkModel } from "../model/actions/namespace";
import { getHardwareMatchActions } from "../model/hardware";
import { NetworkModel } from "../model/networkModel";

export const modelToConfig = (model: NetworkModel) => {
  const resolution = reconcile(newNetworkModel(), model);
  return [...getHardwareMatchActions(model), ...(resolution.actions as NetworkCreateAction[])];
};
