import { requireNetnsName } from "../model/utils";
import { ReconcileContext } from "./context";
import { diffRecord } from "./diff";

export const createInterfaces = (ctx: ReconcileContext) => {
  for (const netns of Object.keys(ctx.desiredModel.namedNetns)) {
    const { current, desired } = ctx.netns(netns);
    if (!current || !desired) continue;

    const diff = diffRecord(current.interfaces, desired.interfaces);

    for (const iface of diff.added) {
      const { current: currentIface, desired: desiredIface } = ctx.iface(netns, iface);
      if (currentIface) continue; // this may happen for veth for example (two are created at once)
      switch (desiredIface?.type) {
        case "bridge":
          ctx.apply({ type: "CreateBridge", netns, iface, stp: desiredIface.stp, vlanFiltering: desiredIface.vlanFiltering });
          break;
        case "veth": {
          if (desiredIface.peerNetns == null || desiredIface.peerIface == null) {
            ctx.addError(`Veth ${iface} in namespace ${netns} has unknown peer, skipping creation`);
            break;
          }
          ctx.apply({ type: "CreateVeth", netns, iface, peerNetns: requireNetnsName(ctx.desiredModel, desiredIface.peerNetns), peerIface: desiredIface.peerIface });
          break;
        }
        case "wireguard": {
          const birthNetnsName = desiredIface.birthNetns != null ? requireNetnsName(ctx.desiredModel, desiredIface.birthNetns) : netns;
          if (birthNetnsName !== netns) {
            const birthIface = ctx.findUnusedIfaceName([birthNetnsName], [iface]);
            ctx.apply({ type: "CreateWireguard", netns: birthNetnsName, iface: birthIface });
            ctx.apply({ type: "MoveInterface", oldNetns: birthNetnsName, oldIface: birthIface, newNetns: netns, newIface: iface });
          } else {
            ctx.apply({ type: "CreateWireguard", netns, iface });
          }
          break;
        }
      }
    }
  }
};
