import { NetworkAction, applyAction } from "../model/actions";
import { InterfaceModel, NamespaceModel, NetworkModel } from "../model/networkModel";
import { getIface, getNetns } from "../model/utils";

const baseNewIfName = "cnrm";

export class ReconcileContext {
  public readonly actions: NetworkAction[] = [];
  public readonly errors: string[] = [];
  public readonly currentModel: NetworkModel;
  private counter = 0;

  constructor(
    currentModel: NetworkModel,
    public readonly desiredModel: NetworkModel,
  ) {
    this.currentModel = structuredClone(currentModel);
  }

  netns(netns: string) {
    return {
      current: getNetns(this.currentModel, netns),
      desired: getNetns(this.desiredModel, netns),
    };
  }

  iface(netns: string, iface: string) {
    const { current, desired } = this.netns(netns);
    return {
      current: current ? getIface(current, iface) : undefined,
      desired: desired ? getIface(desired, iface) : undefined,
    };
  }

  findUnusedIfaceName(netns: string[], candidateNames: string[] = [], allowedIfaceModels: InterfaceModel[] = []) {
    const checkNetnsModels: NamespaceModel[] = [];
    for (const n of netns) {
      const { current, desired } = this.netns(n);
      if (current) checkNetnsModels.push(current);
      if (desired) checkNetnsModels.push(desired);
    }
    const isFree = (iface: string) =>
      checkNetnsModels.every((netnsModel) => {
        const ifaceModel = getIface(netnsModel, iface);
        return !ifaceModel || allowedIfaceModels.includes(ifaceModel);
      });
    let iface = candidateNames.find(isFree);
    if (!iface) {
      do {
        iface = `${baseNewIfName}${this.counter}`;
        this.counter++;
      } while (!isFree(iface));
    }
    return iface;
  }

  apply(action: NetworkAction) {
    this.actions.push(action);
    applyAction(this.currentModel, action);
  }

  addError(error: string) {
    this.errors.push(error);
  }
}
