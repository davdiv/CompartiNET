import { BOOTP_HEADER_LENGTH, DHCP_MAGIC_COOKIE, DHCP_OPTION, MIN_DHCP_PACKET_SIZE } from "./constants";
import type { DhcpInputHeader, DhcpOption, DhcpOptionMap } from "./types";
import { ipToBytes } from "./ip";

const macStringToBytes = (buffer: Buffer, offset: number, mac: string): void => {
  const parts = mac.split(":");
  for (let i = 0; i < 16; i++) {
    buffer[offset + i] = i < parts.length ? parseInt(parts[i], 16) : 0;
  }
};

const writeNullTerminated = (buffer: Buffer, offset: number, str: string, maxLen: number): void => {
  const bytes = Buffer.from(str, "utf-8");
  const len = Math.min(bytes.length, maxLen - 1);
  bytes.copy(buffer, offset, 0, len);
  buffer[offset + len] = 0;
};

function encodeOptionValue(code: number, value: DhcpOption): Buffer {
  if (Array.isArray(value)) {
    if (value.length > 0 && typeof value[0] === "string") {
      const parts: Buffer[] = [];
      for (const ip of value as string[]) {
        const buf = Buffer.alloc(4);
        ipToBytes(buf, 0, ip);
        parts.push(buf);
      }
      return Buffer.concat(parts);
    }
    return Buffer.from(value as number[]);
  }

  switch (code) {
    case DHCP_OPTION.MESSAGE_TYPE: {
      const buf = Buffer.alloc(1);
      buf[0] = value as number;
      return buf;
    }
    case DHCP_OPTION.IP_ADDRESS_LEASE_TIME:
    case DHCP_OPTION.RENEWAL_TIME:
    case DHCP_OPTION.REBINDING_TIME: {
      const buf = Buffer.alloc(4);
      buf.writeUInt32BE(value as number, 0);
      return buf;
    }
    case DHCP_OPTION.SUBNET_MASK:
    case DHCP_OPTION.ROUTER:
    case DHCP_OPTION.SERVER_IDENTIFIER:
    case DHCP_OPTION.REQUESTED_IP_ADDRESS: {
      const buf = Buffer.alloc(4);
      ipToBytes(buf, 0, value as string);
      return buf;
    }
    case DHCP_OPTION.HOST_NAME: {
      return Buffer.from(value as string, "utf-8");
    }
    default:
      if (typeof value === "number") {
        const buf = Buffer.alloc(4);
        buf.writeUInt32BE(value, 0);
        return buf;
      }
      return Buffer.from(value as Uint8Array);
  }
}

function serializeOptions(options: DhcpOptionMap): Buffer {
  const fragments: Buffer[] = [];

  for (const codeStr of Object.keys(options)) {
    const code = parseInt(codeStr, 10);
    if (code === DHCP_OPTION.PAD || code === DHCP_OPTION.END) continue;
    if (!Object.hasOwn(options, code)) continue;

    const data = encodeOptionValue(code, options[code]);
    fragments.push(Buffer.from([code, data.length]));
    fragments.push(data);
  }

  fragments.push(Buffer.from([DHCP_OPTION.END]));
  return Buffer.concat(fragments);
}

export function formatDhcpPacket(input: DhcpInputHeader): Buffer {
  const magicCookie = input.magicCookie ?? DHCP_MAGIC_COOKIE;
  const optionsBuffer = serializeOptions(input.options);

  const totalLength = Math.max(BOOTP_HEADER_LENGTH + 4 + optionsBuffer.length, MIN_DHCP_PACKET_SIZE);
  const buffer = Buffer.alloc(totalLength);

  buffer[0] = input.op;
  buffer[1] = input.htype;
  buffer[2] = input.hlen;
  buffer[3] = input.hops;
  buffer.writeUInt32BE(input.xid, 4);
  buffer.writeUInt16BE(input.secs, 8);
  buffer.writeUInt16BE(input.flags, 10);
  ipToBytes(buffer, 12, input.ciaddr);
  ipToBytes(buffer, 16, input.yiaddr);
  ipToBytes(buffer, 20, input.siaddr);
  ipToBytes(buffer, 24, input.giaddr);
  macStringToBytes(buffer, 28, input.chaddr);
  writeNullTerminated(buffer, 44, input.sname, 64);
  writeNullTerminated(buffer, 108, input.bootFile, 128);
  buffer.writeUInt32BE(magicCookie, BOOTP_HEADER_LENGTH);
  optionsBuffer.copy(buffer, BOOTP_HEADER_LENGTH + 4);

  return buffer;
}
