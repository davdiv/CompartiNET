import { reactive } from "signalium";
import { type FeatureHandler } from "../../common/features/createFeatures";
import { NetworkCreateAction } from "../model/actions";
import { WireguardConfig } from "../model/networkModel";

export interface WireguardFeature {
  type: "Wireguard";
  netns: string;
  iface: string;
  birthNetns?: string;
  birthIface?: string;
  config: WireguardConfig;
  autoRoute?: boolean;
}

export const wireguardHandler: FeatureHandler<WireguardFeature, NetworkCreateAction> = reactive(({ birthNetns, birthIface, netns, iface, config, autoRoute }: WireguardFeature) => {
  const res: NetworkCreateAction[] = [];
  if (!birthNetns || birthNetns === netns) {
    res.push({ type: "CreateWireguard", netns, iface });
  } else {
    res.push({ type: "CreateWireguard", netns: birthNetns, iface: birthIface ?? iface }, { type: "MoveInterface", oldNetns: birthNetns, newNetns: netns, oldIface: iface, newIface: iface });
  }
  res.push({ type: "SetWireguardConfig", netns, iface, config });
  if (autoRoute) {
    res.push({ type: "SetInterfaceUp", netns, iface, up: true });
    for (const peer of config.peers) {
      for (const allowedIp of peer.allowedIPs) {
        res.push({
          type: "AddRoute",
          netns,
          route: {
            ...allowedIp,
            iface,
          },
        });
      }
    }
  }
  return res;
});
