import { InterfaceModel, NetworkModel, RealInterfaceModel } from "../model/networkModel";
import { requireNetnsName } from "../model/utils";
import { ReconcileContext } from "./context";

export const removeAllAltnames = (ctx: ReconcileContext, netns: string, { altnames }: RealInterfaceModel) => {
  for (const altname of altnames) {
    ctx.apply({ type: "RemoveAltname", netns, altname });
  }
};

export const isDifferent = ({ current, desired }: { current?: InterfaceModel; desired?: InterfaceModel }, currentModel?: NetworkModel, desiredModel?: NetworkModel) => {
  if (!current || !desired || current.type !== desired.type) {
    return true;
  }
  if (current.type === "hardware") {
    return desired.type !== "hardware" || current.hardwareBus !== desired.hardwareBus || current.hardwareDevice !== desired.hardwareDevice;
  }
  if (current.type === "wireguard") {
    if (desired.type !== "wireguard") return true;
    if (desired.birthNetns == null) return false;
    if (current.birthNetns == null) return true;
    if (!currentModel || !desiredModel) return current.birthNetns !== desired.birthNetns;
    return requireNetnsName(currentModel, current.birthNetns) !== requireNetnsName(desiredModel, desired.birthNetns);
  }
  if (current.type === "veth") {
    if (desired.type !== "veth") return true;
    const peerIfaceDiff = current.peerIface !== desired.peerIface;
    if (!currentModel || !desiredModel) return peerIfaceDiff || current.peerNetns !== desired.peerNetns;
    return peerIfaceDiff || requireNetnsName(currentModel, current.peerNetns) !== requireNetnsName(desiredModel, desired.peerNetns);
  }
  if (current.type === "altname") {
    return desired.type !== "altname" || current.iface !== desired.iface;
  }
  return false;
};

const removeInterface = (ctx: ReconcileContext, netns: string, iface: string) => {
  const currentIface = ctx.iface(netns, iface).current;
  if (!currentIface) return true;
  if (currentIface.type != "altname" && currentIface.up) {
    ctx.apply({ type: "SetInterfaceUp", netns, iface, up: false });
  }
  switch (currentIface.type) {
    case "altname":
      ctx.apply({ type: "RemoveAltname", netns, altname: iface });
      return true;
    case "bridge":
      ctx.apply({ type: "DeleteBridge", netns, iface });
      return true;
    case "veth":
      ctx.apply({ type: "DeleteVeth", netns, iface });
      return true;
    case "wireguard":
      ctx.apply({ type: "DeleteWireguard", netns, iface });
      return true;
  }
  return false;
};

export const removeUndesiredInterfaces = (ctx: ReconcileContext) => {
  for (const netns of Object.keys(ctx.desiredModel.namedNetns)) {
    const { current, desired } = ctx.netns(netns);
    if (!current || !desired) continue;

    for (const iface of Object.keys(current.interfaces)) {
      const ifaceInfo = ctx.iface(netns, iface);
      if (ifaceInfo.current && isDifferent(ifaceInfo, ctx.currentModel, ctx.desiredModel)) {
        if (!removeInterface(ctx, netns, iface)) {
          // if an undesired interface cannot be removed:
          // remove all its altnames
          if (ifaceInfo.current.type !== "altname") {
            removeAllAltnames(ctx, netns, ifaceInfo.current);
          }
          // if the name collides with another name, rename the interface:
          if (ifaceInfo.desired) {
            const newIface = ctx.findUnusedIfaceName([netns]);
            ctx.apply({ type: "MoveInterface", oldNetns: netns, newNetns: netns, oldIface: iface, newIface });
          }
        }
      }
    }
  }
};
