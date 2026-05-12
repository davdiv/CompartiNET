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

    const { host, port } = parseLocalAddress(local);
    sockets.push({ protocol, host, port });
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

function parseLocalAddress(local: string): { host: string; port: number } {
  let host: string;
  let portStr: string;

  if (local.startsWith("[")) {
    // IPv6: [::]:80 or [::1]:5353
    const bracketEnd = local.lastIndexOf("]");
    host = local.slice(1, bracketEnd);
    portStr = local.slice(bracketEnd + 2); // skip "]:"
  } else {
    // IPv4: 0.0.0.0:68 or *:5353
    const lastColon = local.lastIndexOf(":");
    host = local.slice(0, lastColon);
    portStr = local.slice(lastColon + 1);
  }

  return { host, port: parseInt(portStr, 10) };
}
