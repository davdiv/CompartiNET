import { reactive } from "signalium";
import type { FeatureHandler } from "../../common/features/createFeatures";
import type { OpenSocketAction } from "../../common/model/actions/socket";
import { leaseToActions, type DhcpLease } from "../dhcp/client/lease";
import { DhcpClientServiceSpec } from "../dhcp/client/machine";
import type { Feature } from "./index";

export interface DhcpClientFeature {
  type: "DhcpClient";
  netns: string;
  iface: string;
  macAddress: string;
  hostname?: string;
}

export const dhcpClientHandler: FeatureHandler<DhcpClientFeature, Feature> = reactive((feature: DhcpClientFeature, ctx) => {
  const serviceKey = `DhcpClient:${feature.netns}:${feature.iface}`;
  const lease = ctx.getServiceOutput<DhcpLease>(serviceKey);

  return [
    {
      type: "ServiceSpec",
      serviceType: "DhcpClient",
      serviceKey,
      netns: feature.netns,
      iface: feature.iface,
      macAddress: feature.macAddress,
      hostname: feature.hostname,
    } satisfies DhcpClientServiceSpec,
    // Temporary catch-all route to satisfy rp_filter for DHCP replies.
    // Without a route for the server's source IP, the kernel's reverse
    // path filter drops incoming DHCPOFFER/DHCPACK packets.  This route
    // is replaced by the proper default route (via the gateway) once a
    // lease is acquired.
    ...(lease
      ? []
      : [
          {
            type: "AddRoute" as const,
            netns: feature.netns,
            route: {
              iface: feature.iface,
              family: "ipv4" as const,
              address: "0.0.0.0",
              prefixLength: 0,
            },
          },
        ]),
    {
      type: "OpenSocket",
      netns: feature.netns,
      socket: { protocol: "udp4", host: "0.0.0.0", port: 68, serviceKey },
    } satisfies OpenSocketAction,
    ...(lease ? leaseToActions(lease, feature.netns, feature.iface) : []),
  ];
});
