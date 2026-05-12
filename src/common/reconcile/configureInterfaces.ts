import { BridgeMemberModel, IpAddressModel } from "../model/networkModel";
import { isWgConfigEqual } from "../model/wg/compare";
import { ReconcileContext } from "./context";
import { diffArrays, diffRecord } from "./diff";
import { isDifferent } from "./removeInterfaces";

const addressKey = (a: IpAddressModel) => `${a.family}/${a.address}/${a.prefixLength}`;
const stringKey = (s: string) => s;

const reconcileBridgeVlans = (ctx: ReconcileContext, netns: string, iface: string, current: Omit<BridgeMemberModel, "bridge">, desired: Omit<BridgeMemberModel, "bridge">, self?: boolean) => {
  const vlanDiff = diffArrays(current.vlans, desired.vlans, (v) => String(v.vlanId));

  for (const vlan of vlanDiff.removed) {
    ctx.apply({ type: "RemoveBridgePortVlan", netns, iface, vlanId: vlan.vlanId, ...(self ? { self } : {}) });
  }

  for (const vlan of vlanDiff.added) {
    const isPvid = desired.pvid === vlan.vlanId;
    ctx.apply({ type: "AddBridgePortVlan", netns, iface, vlanId: vlan.vlanId, untagged: vlan.untagged, pvid: isPvid || undefined, ...(self ? { self } : {}) });
  }

  for (const vlan of vlanDiff.same) {
    const curVlan = current.vlans.find((v) => v.vlanId === vlan.vlanId);
    const desVlan = desired.vlans.find((v) => v.vlanId === vlan.vlanId);
    if (!curVlan || !desVlan) continue;

    const untaggedChanged = curVlan.untagged !== desVlan.untagged;
    const becamePvid = desired.pvid === desVlan.vlanId && current.pvid !== desVlan.vlanId;
    const lostPvid = current.pvid === curVlan.vlanId && desired.pvid !== curVlan.vlanId;
    const isPvid = desired.pvid === desVlan.vlanId;

    if (untaggedChanged || becamePvid || lostPvid) {
      ctx.apply({ type: "AddBridgePortVlan", netns, iface, vlanId: desVlan.vlanId, untagged: desVlan.untagged, pvid: isPvid || undefined, ...(self ? { self } : {}) });
    }
  }
};

export const configureInterfaces = (ctx: ReconcileContext) => {
  for (const netns of Object.keys(ctx.desiredModel.namedNetns)) {
    const { current, desired } = ctx.netns(netns);
    if (!current || !desired) continue;

    const diff = diffRecord(current.interfaces, desired.interfaces);

    for (const iface of diff.same) {
      const ifaceInfo = ctx.iface(netns, iface);
      const { desired: desiredIface, current: currentIface } = ifaceInfo;
      if (isDifferent(ifaceInfo, ctx.currentModel, ctx.desiredModel) || !desiredIface || !currentIface || currentIface.type === "altname" || desiredIface.type === "altname") {
        continue;
      }

      if (currentIface.up && !desiredIface.up) {
        ctx.apply({ type: "SetInterfaceUp", netns, iface, up: false });
      }

      const addrDiff = diffArrays(currentIface.addresses, desiredIface.addresses, addressKey);
      for (const ip of addrDiff.removed) {
        ctx.apply({ type: "RemoveIpAddress", netns, iface, ip });
      }

      const altnameDiff = diffArrays(currentIface.altnames, desiredIface.altnames, stringKey);
      for (const altname of altnameDiff.removed) {
        ctx.apply({ type: "RemoveAltname", netns, altname });
      }

      const desBM = desiredIface.bridgeMember;
      if (currentIface.bridgeMember?.bridge !== desBM?.bridge) {
        if (currentIface.bridgeMember) {
          ctx.apply({ type: "RemoveBridgePort", netns, iface });
        }
        if (desBM) {
          ctx.apply({ type: "AddBridgePort", netns, iface, bridge: desBM.bridge });
        }
      }

      // Bridge port VLAN configuration
      const curBM = currentIface.bridgeMember;
      if (curBM && desBM && curBM.bridge === desBM.bridge) {
        reconcileBridgeVlans(ctx, netns, iface, curBM, desBM);
      }

      if (currentIface.type === "bridge" && desiredIface.type === "bridge") {
        if (currentIface.vlanFiltering !== desiredIface.vlanFiltering) {
          ctx.apply({ type: "SetBridgeVlanFiltering", netns, iface, vlanFiltering: desiredIface.vlanFiltering });
        }

        // Bridge self VLAN configuration
        reconcileBridgeVlans(ctx, netns, iface, currentIface.self, desiredIface.self, true);
      }

      if (currentIface.type === "wireguard" && desiredIface.type === "wireguard") {
        const curCfg = currentIface.config;
        const desCfg = desiredIface.config;
        if (!isWgConfigEqual(curCfg, desCfg)) {
          ctx.apply({ type: "SetWireguardConfig", netns, iface, config: desCfg });
        }
      }

      for (const ip of addrDiff.added) {
        ctx.apply({ type: "AddIpAddress", netns, iface, ip });
      }

      for (const altname of altnameDiff.added) {
        ctx.apply({ type: "AddAltname", netns, iface, altname });
      }

      if (!currentIface.up && desiredIface.up) {
        ctx.apply({ type: "SetInterfaceUp", netns, iface, up: true });
      }
    }
  }
};
