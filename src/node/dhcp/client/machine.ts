import { randomInt } from "node:crypto";
import type { RemoteInfo, Socket } from "node:dgram";
import { reactive, relay } from "signalium";
import { BaseServiceSpec, ServiceHandler } from "../../../common/services/types";
import { onAbort } from "../../../common/utils/abort";
import { createNetnsWorker } from "../../netnsWorker/create";
import { BOOTP_OP, DHCP_MESSAGE_TYPE, DHCP_OPTION, DHCP_PORT, HARDWARE_TYPE } from "../protocol/constants";
import { formatDhcpPacket } from "../protocol/format";
import { parseDhcpPacket } from "../protocol/parse";
import type { DhcpInputHeader, DhcpOption } from "../protocol/types";
import { DhcpLease, subnetMaskToPrefixLength } from "./lease";

export interface DhcpClientServiceSpec extends BaseServiceSpec {
  serviceType: "DhcpClient";
  netns: string;
  iface: string;
  macAddress: string;
  hostname?: string;
}

const DEFAULT_REQUESTED_OPTIONS = [DHCP_OPTION.SUBNET_MASK, DHCP_OPTION.ROUTER, DHCP_OPTION.DOMAIN_NAME_SERVER];

export const createDhcpClientMachine = (config: DhcpClientServiceSpec, abortSignal: AbortSignal, onLeaseChange: (newLeae: DhcpLease | null) => void) => {
  let socket: Socket;
  let lease: DhcpLease | null = null;
  let renewTimer: ReturnType<typeof setTimeout> | null = null;
  let rebindTimer: ReturnType<typeof setTimeout> | null = null;
  let expireTimer: ReturnType<typeof setTimeout> | null = null;

  const emitLeaseChange = (newLease: DhcpLease | null) => {
    lease = newLease;
    onLeaseChange(newLease);
  };

  const clearTimers = () => {
    if (renewTimer) {
      clearTimeout(renewTimer);
      renewTimer = null;
    }
    if (rebindTimer) {
      clearTimeout(rebindTimer);
      rebindTimer = null;
    }
    if (expireTimer) {
      clearTimeout(expireTimer);
      expireTimer = null;
    }
  };

  const scheduleTimers = (l: DhcpLease) => {
    clearTimers();

    renewTimer = setTimeout(() => void handleRenew(), l.renewalTime * 1000);
    rebindTimer = setTimeout(() => void handleRebind(), l.rebindingTime * 1000);
    expireTimer = setTimeout(() => {
      emitLeaseChange(null);
    }, l.leaseTime * 1000);
  };

  const handleRenew = async () => {
    if (!lease) return;
    try {
      await sendRequest(lease.serverIdentifier, 10000, lease);
    } catch {
      // Wait for rebind
    }
  };

  const handleRebind = async () => {
    if (!lease) return;
    try {
      await sendRequest("255.255.255.255", 30000, lease);
    } catch {
      emitLeaseChange(null);
    }
  };

  const buildBaseHeader = (xid: number, ciaddr: string): Omit<DhcpInputHeader, "options"> => ({
    op: BOOTP_OP.BOOTREQUEST,
    htype: HARDWARE_TYPE.ETHERNET,
    hlen: 6,
    hops: 0,
    xid,
    secs: 0,
    flags: 0x8000,
    ciaddr,
    yiaddr: "0.0.0.0",
    siaddr: "0.0.0.0",
    giaddr: "0.0.0.0",
    chaddr: config.macAddress,
    sname: "",
    bootFile: "",
  });

  const waitForResponse = (xid: number, expectedTypes: number[], timeoutMs: number): Promise<{ header: ReturnType<typeof parseDhcpPacket>; rinfo: RemoteInfo }> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        removeAbort();
        socket.off("message", handler);
        reject(new Error(`DHCP response timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      const removeAbort = onAbort(abortSignal, () => {
        clearTimeout(timeout);
      });

      const handler = (msg: Buffer, rinfo: RemoteInfo) => {
        let parsed;
        try {
          parsed = parseDhcpPacket(msg);
        } catch {
          return;
        }
        if (parsed.xid !== xid) return;

        const msgType = parsed.options[DHCP_OPTION.MESSAGE_TYPE];
        if (msgType !== undefined && expectedTypes.includes(msgType as number)) {
          clearTimeout(timeout);
          removeAbort();
          socket.off("message", handler);
          resolve({ header: parsed, rinfo });
        }
      };

      socket.on("message", handler);
    });
  };

  const extractLease = (header: ReturnType<typeof parseDhcpPacket>): DhcpLease => {
    const subnetMask = (header.options[DHCP_OPTION.SUBNET_MASK] as string | undefined) ?? "255.255.255.0";
    const leaseTime = (header.options[DHCP_OPTION.IP_ADDRESS_LEASE_TIME] as number | undefined) ?? 86400;
    const renewalTime = (header.options[DHCP_OPTION.RENEWAL_TIME] as number) ?? leaseTime / 2;
    const rebindingTime = (header.options[DHCP_OPTION.REBINDING_TIME] as number) ?? (leaseTime * 7) / 8;
    const router = header.options[DHCP_OPTION.ROUTER] as string | undefined;
    const serverIdentifier = header.options[DHCP_OPTION.SERVER_IDENTIFIER] as string;

    return {
      ipAddress: header.yiaddr,
      subnetMask,
      prefixLength: subnetMaskToPrefixLength(subnetMask),
      router,
      leaseTime,
      renewalTime,
      rebindingTime,
      serverIdentifier,
    };
  };

  const sendRequest = async (destAddr: string, timeoutMs: number, currentLease: DhcpLease | null): Promise<DhcpLease> => {
    const xid = randomInt(0, 0xffffffff);
    const options: Record<number, DhcpOption> = {
      [DHCP_OPTION.MESSAGE_TYPE]: DHCP_MESSAGE_TYPE.DHCPREQUEST,
      [DHCP_OPTION.PARAMETER_REQUEST_LIST]: DEFAULT_REQUESTED_OPTIONS,
    };
    if (currentLease) {
      options[DHCP_OPTION.SERVER_IDENTIFIER] = currentLease.serverIdentifier;
      options[DHCP_OPTION.REQUESTED_IP_ADDRESS] = currentLease.ipAddress;
    }

    const requestPacket = formatDhcpPacket({
      ...buildBaseHeader(xid, currentLease?.ipAddress ?? "0.0.0.0"),
      options,
    });

    socket.send(requestPacket, DHCP_PORT.SERVER, destAddr);

    const { header } = await waitForResponse(xid, [DHCP_MESSAGE_TYPE.DHCPACK, DHCP_MESSAGE_TYPE.DHCPNAK], timeoutMs);

    const msgType = header.options[DHCP_OPTION.MESSAGE_TYPE] as number;
    if (msgType === DHCP_MESSAGE_TYPE.DHCPNAK) {
      throw new Error("DHCPNAK received");
    }

    const newLease = extractLease(header);
    emitLeaseChange(newLease);
    scheduleTimers(newLease);
    return newLease;
  };

  const createSocket = async () => {
    using worker = createNetnsWorker(config.netns);
    const socket = await worker.call<Socket>({
      type: "create-udp-socket",
      options: { type: "udp4", reuseAddr: true },
      host: "0.0.0.0",
      port: 68,
    });
    socket.setBroadcast(true);
    return socket;
  };

  const start = async (): Promise<DhcpLease> => {
    socket = await createSocket();
    const discoverXid = randomInt(0, 0xffffffff);
    const opts: Record<number, DhcpOption> = {
      [DHCP_OPTION.MESSAGE_TYPE]: DHCP_MESSAGE_TYPE.DHCPDISCOVER,
      [DHCP_OPTION.PARAMETER_REQUEST_LIST]: DEFAULT_REQUESTED_OPTIONS,
    };
    if (config.hostname) opts[DHCP_OPTION.HOST_NAME] = config.hostname;

    const discoverPacket = formatDhcpPacket({
      ...buildBaseHeader(discoverXid, "0.0.0.0"),
      options: opts,
    });
    socket.send(discoverPacket, DHCP_PORT.SERVER, "255.255.255.255");

    const offer = await waitForResponse(discoverXid, [DHCP_MESSAGE_TYPE.DHCPOFFER], 30000);

    const offeredLease = extractLease(offer.header);

    return await sendRequest("255.255.255.255", 30000, offeredLease);
  };

  // TODO: what if start throws an error ?
  void start();
  onAbort(abortSignal, () => {
    clearTimers();
    if (lease) {
      const releaseXid = randomInt(0, 0xffffffff);
      const releasePacket = formatDhcpPacket({
        ...buildBaseHeader(releaseXid, lease.ipAddress),
        options: {
          [DHCP_OPTION.MESSAGE_TYPE]: DHCP_MESSAGE_TYPE.DHCPRELEASE,
          [DHCP_OPTION.SERVER_IDENTIFIER]: lease.serverIdentifier,
        },
      });
      socket.send(releasePacket, DHCP_PORT.SERVER, lease.serverIdentifier);
      emitLeaseChange(null);
    }
    socket.close();
  });
};

export const dhcpClientServiceHandler: ServiceHandler<DhcpClientServiceSpec, DhcpLease | null> = reactive((config) =>
  relay<DhcpLease | null>((state) => {
    const abortController = new AbortController();
    createDhcpClientMachine(config, abortController.signal, (lease) => {
      state.value = lease;
    });
    return () => abortController.abort();
  }),
);
