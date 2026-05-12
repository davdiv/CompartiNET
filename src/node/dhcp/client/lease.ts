import type { NetworkCreateAction } from "../../../common/model/actions";

export interface DhcpLease {
  ipAddress: string;
  subnetMask: string;
  prefixLength: number;
  router?: string;
  leaseTime: number;
  renewalTime: number;
  rebindingTime: number;
  serverIdentifier: string;
}

export function subnetMaskToPrefixLength(mask: string): number {
  const parts = mask.split(".").map((n) => parseInt(n, 10));
  let bits = 0;
  for (const part of parts) {
    bits += part.toString(2).split("1").length - 1;
  }
  return bits;
}

export function leaseToActions(lease: DhcpLease, netns: string, iface: string): NetworkCreateAction[] {
  const actions: NetworkCreateAction[] = [
    {
      type: "AddIpAddress",
      netns,
      iface,
      ip: {
        family: "ipv4",
        address: lease.ipAddress,
        prefixLength: lease.prefixLength,
      },
    },
  ];

  if (lease.router) {
    actions.push({
      type: "AddRoute",
      netns,
      route: {
        family: "ipv4",
        address: "0.0.0.0",
        prefixLength: 0,
        gateway: lease.router,
        iface,
      },
    });
  }

  return actions;
}
