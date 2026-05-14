import { ListeningSocket } from "./networkModel";

/**
 * Parses the output of `ss -tuln -H` into ListeningSocket objects.
 *
 * Expected format (columns: Netid, State, Recv-Q, Send-Q, Local Address:Port, Peer Address:Port):
 *   udp   UNCONN  0  0  0.0.0.0:68  0.0.0.0:*
 *   tcp   LISTEN  0  0  0.0.0.0:22  0.0.0.0:*
 *   tcp   LISTEN  0  0  [::]:80     [::]:*
 */
export function parseSsOutput(output: string): ListeningSocket[] {
  const sockets: ListeningSocket[] = [];
  for (const line of output.split("\n")) {
    const fields = line.trim().split(/\s+/);
    if (fields.length < 5) continue;

    const netid = fields[0];
    const local = fields[4];

    const protocol = netidToProtocol(netid, local);
    if (!protocol) continue;

    const { host, zone, port } = parseLocalAddress(local);
    sockets.push({ protocol, host, port, ...(zone ? { zone } : {}) });
  }
  return sockets;
}

function netidToProtocol(netid: string, local: string): ListeningSocket["protocol"] | null {
  const isV6 = local.startsWith("[");
  switch (netid) {
    case "udp":
      return isV6 ? "udp6" : "udp4";
    case "tcp":
      return isV6 ? "tcp6" : "tcp4";
    default:
      return null;
  }
}

function parseLocalAddress(local: string): { host: string; port: number; zone?: string } {
  // Port is always after the last colon
  const lastColon = local.lastIndexOf(":");
  const hostWithBrackets = local.slice(0, lastColon);
  const portStr = local.slice(lastColon + 1);

  let host: string;
  let zone: string | undefined;

  if (hostWithBrackets.startsWith("[")) {
    // IPv6: [::]:80 or [fe80::1]:546 or [fe80::1%eth0]:546 or [fe80::1]%eth0:546
    const bracketEnd = hostWithBrackets.indexOf("]");
    const inner = hostWithBrackets.slice(1, bracketEnd);
    const afterBracket = hostWithBrackets.slice(bracketEnd + 1);
    const zoneIdx = inner.indexOf("%");
    if (zoneIdx !== -1) {
      host = inner.slice(0, zoneIdx);
      zone = inner.slice(zoneIdx + 1);
    } else if (afterBracket.startsWith("%")) {
      host = inner;
      zone = afterBracket.slice(1);
    } else {
      host = inner;
    }
  } else {
    host = hostWithBrackets;
  }

  return { host, zone, port: parseInt(portStr, 10) };
}
