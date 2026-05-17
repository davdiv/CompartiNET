import { BOOTP_HEADER_LENGTH, DHCP_MAGIC_COOKIE, DHCP_OPTION } from "./constants";
import type { DhcpHeader, DhcpOptionMap, DhcpOption } from "./types";
import { bytesToIp } from "./ip";
import { formatMacAddress } from "../../../common/utils/mac";

const readString = (buffer: Buffer, offset: number, length: number): string => {
  const end = buffer.indexOf(0, offset);
  if (end !== -1 && end < offset + length) {
    return buffer.toString("utf-8", offset, end);
  }
  return buffer.toString("utf-8", offset, offset + length).replace(/\0/g, "");
};

function parseOptions(buffer: Buffer, offset: number): DhcpOptionMap {
  const options: DhcpOptionMap = {};
  let pos = offset;

  while (pos < buffer.length) {
    const code = buffer[pos];
    pos++;

    if (code === DHCP_OPTION.PAD) {
      continue;
    }
    if (code === DHCP_OPTION.END) {
      break;
    }

    if (pos >= buffer.length) break;
    const length = buffer[pos];
    pos++;

    if (pos + length > buffer.length) break;
    const data = buffer.subarray(pos, pos + length);
    pos += length;

    options[code] = decodeOptionValue(code, data);
  }

  return options;
}

function decodeOptionValue(code: number, data: Buffer): DhcpOption {
  switch (code) {
    case DHCP_OPTION.SUBNET_MASK:
    case DHCP_OPTION.ROUTER:
    case DHCP_OPTION.SERVER_IDENTIFIER:
    case DHCP_OPTION.REQUESTED_IP_ADDRESS:
      return bytesToIp(data, 0);

    case DHCP_OPTION.DOMAIN_NAME_SERVER: {
      const servers: string[] = [];
      for (let i = 0; i < data.length; i += 4) {
        servers.push(bytesToIp(data, i));
      }
      return servers;
    }

    case DHCP_OPTION.MESSAGE_TYPE:
      return data[0];

    case DHCP_OPTION.IP_ADDRESS_LEASE_TIME:
    case DHCP_OPTION.RENEWAL_TIME:
    case DHCP_OPTION.REBINDING_TIME:
      return data.readUInt32BE(0);

    case DHCP_OPTION.PARAMETER_REQUEST_LIST:
      return Array.from(data);

    case DHCP_OPTION.HOST_NAME:
      return data.toString("utf-8");

    default:
      return new Uint8Array(data);
  }
}

const HEADER_READERS = {
  op: (b: Buffer) => b[0],
  htype: (b: Buffer) => b[1],
  hlen: (b: Buffer) => b[2],
  hops: (b: Buffer) => b[3],
  xid: (b: Buffer) => b.readUInt32BE(4),
  secs: (b: Buffer) => b.readUInt16BE(8),
  flags: (b: Buffer) => b.readUInt16BE(10),
  ciaddr: (b: Buffer) => bytesToIp(b, 12),
  yiaddr: (b: Buffer) => bytesToIp(b, 16),
  siaddr: (b: Buffer) => bytesToIp(b, 20),
  giaddr: (b: Buffer) => bytesToIp(b, 24),
} as const;

export function parseDhcpPacket(buffer: Buffer): DhcpHeader {
  if (buffer.length < BOOTP_HEADER_LENGTH + 4) {
    throw new Error("Buffer too small for DHCP packet");
  }

  const magicCookie = buffer.readUInt32BE(BOOTP_HEADER_LENGTH);
  if (magicCookie !== DHCP_MAGIC_COOKIE) {
    throw new Error(`Invalid DHCP magic cookie: 0x${magicCookie.toString(16)}`);
  }

  const hlen = buffer[2];
  const options = parseOptions(buffer, BOOTP_HEADER_LENGTH + 4);

  return {
    op: HEADER_READERS.op(buffer),
    htype: HEADER_READERS.htype(buffer),
    hlen,
    hops: HEADER_READERS.hops(buffer),
    xid: HEADER_READERS.xid(buffer),
    secs: HEADER_READERS.secs(buffer),
    flags: HEADER_READERS.flags(buffer),
    ciaddr: HEADER_READERS.ciaddr(buffer),
    yiaddr: HEADER_READERS.yiaddr(buffer),
    siaddr: HEADER_READERS.siaddr(buffer),
    giaddr: HEADER_READERS.giaddr(buffer),
    chaddr: formatMacAddress(buffer, 28, hlen),
    sname: readString(buffer, 44, 64),
    bootFile: readString(buffer, 108, 128),
    magicCookie,
    options,
  };
}
