import { describe, expect, it } from "vitest";
import { BOOTP_HEADER_LENGTH, DHCP_MAGIC_COOKIE, DHCP_MESSAGE_TYPE, DHCP_OPTION, MIN_DHCP_PACKET_SIZE } from "../../../src/node/dhcp/protocol/constants";
import { formatDhcpPacket } from "../../../src/node/dhcp/protocol/format";
import { parseDhcpPacket } from "../../../src/node/dhcp/protocol/parse";
import type { DhcpInputHeader } from "../../../src/node/dhcp/protocol/types";

function buildDhcpOfferPacket(): Buffer {
  const buf = Buffer.alloc(300);

  // Fixed BOOTP header
  buf[0] = 2; // op: BOOTREPLY
  buf[1] = 1; // htype: Ethernet
  buf[2] = 6; // hlen
  buf[3] = 0; // hops
  buf.writeUInt32BE(0x12345678, 4); // xid
  buf.writeUInt16BE(0, 8); // secs
  buf.writeUInt16BE(0x8000, 10); // flags: broadcast
  // ciaddr: 0.0.0.0 (already zeroed)
  buf[16] = 192;
  buf[17] = 168;
  buf[18] = 1;
  buf[19] = 100; // yiaddr: 192.168.1.100
  buf[20] = 192;
  buf[21] = 168;
  buf[22] = 1;
  buf[23] = 1; // siaddr: 192.168.1.1
  // giaddr: 0.0.0.0 (already zeroed)
  // chaddr: 00:11:22:33:44:55 (first 6 bytes of the 16-byte field)
  buf[28] = 0x00;
  buf[29] = 0x11;
  buf[30] = 0x22;
  buf[31] = 0x33;
  buf[32] = 0x44;
  buf[33] = 0x55;
  // sname: "dhcpserver" at offset 44
  Buffer.from("dhcpserver").copy(buf, 44);

  // Magic cookie at offset 236
  buf.writeUInt32BE(DHCP_MAGIC_COOKIE, BOOTP_HEADER_LENGTH);

  // Options at offset 240
  let o = BOOTP_HEADER_LENGTH + 4;
  // Option 53: DHCPOFFER (2)
  buf[o] = DHCP_OPTION.MESSAGE_TYPE;
  buf[o + 1] = 1;
  buf[o + 2] = DHCP_MESSAGE_TYPE.DHCPOFFER;
  o += 3;
  // Option 54: Server Identifier 192.168.1.1
  buf[o] = DHCP_OPTION.SERVER_IDENTIFIER;
  buf[o + 1] = 4;
  buf[o + 2] = 192;
  buf[o + 3] = 168;
  buf[o + 4] = 1;
  buf[o + 5] = 1;
  o += 6;
  // Option 51: Lease time 86400
  buf[o] = DHCP_OPTION.IP_ADDRESS_LEASE_TIME;
  buf[o + 1] = 4;
  buf.writeUInt32BE(86400, o + 2);
  o += 6;
  // Option 1: Subnet mask 255.255.255.0
  buf[o] = DHCP_OPTION.SUBNET_MASK;
  buf[o + 1] = 4;
  buf[o + 2] = 255;
  buf[o + 3] = 255;
  buf[o + 4] = 255;
  buf[o + 5] = 0;
  o += 6;
  // Option 3: Router 192.168.1.1
  buf[o] = DHCP_OPTION.ROUTER;
  buf[o + 1] = 4;
  buf[o + 2] = 192;
  buf[o + 3] = 168;
  buf[o + 4] = 1;
  buf[o + 5] = 1;
  o += 6;
  // Option 6: DNS servers 192.168.1.1, 8.8.8.8
  buf[o] = DHCP_OPTION.DOMAIN_NAME_SERVER;
  buf[o + 1] = 8;
  buf[o + 2] = 192;
  buf[o + 3] = 168;
  buf[o + 4] = 1;
  buf[o + 5] = 1;
  buf[o + 6] = 8;
  buf[o + 7] = 8;
  buf[o + 8] = 8;
  buf[o + 9] = 8;
  o += 10;
  // Option 255: End
  buf[o] = DHCP_OPTION.END;

  return buf;
}

describe("parseDhcpPacket", () => {
  it("parses a DHCPOFFER packet correctly", () => {
    const packet = buildDhcpOfferPacket();
    const result = parseDhcpPacket(packet);

    expect(result.op).toBe(2);
    expect(result.htype).toBe(1);
    expect(result.hlen).toBe(6);
    expect(result.hops).toBe(0);
    expect(result.xid).toBe(0x12345678);
    expect(result.secs).toBe(0);
    expect(result.flags).toBe(0x8000);
    expect(result.ciaddr).toBe("0.0.0.0");
    expect(result.yiaddr).toBe("192.168.1.100");
    expect(result.siaddr).toBe("192.168.1.1");
    expect(result.giaddr).toBe("0.0.0.0");
    expect(result.chaddr).toBe("00:11:22:33:44:55");
    expect(result.sname).toBe("dhcpserver");
    expect(result.bootFile).toBe("");

    expect(result.options[DHCP_OPTION.MESSAGE_TYPE]).toBe(DHCP_MESSAGE_TYPE.DHCPOFFER);
    expect(result.options[DHCP_OPTION.SERVER_IDENTIFIER]).toBe("192.168.1.1");
    expect(result.options[DHCP_OPTION.IP_ADDRESS_LEASE_TIME]).toBe(86400);
    expect(result.options[DHCP_OPTION.SUBNET_MASK]).toBe("255.255.255.0");
    expect(result.options[DHCP_OPTION.ROUTER]).toBe("192.168.1.1");
    expect(result.options[DHCP_OPTION.DOMAIN_NAME_SERVER]).toEqual(["192.168.1.1", "8.8.8.8"]);
  });

  it("throws on buffer too small", () => {
    expect(() => parseDhcpPacket(Buffer.alloc(10))).toThrow("Buffer too small");
  });

  it("throws on invalid magic cookie", () => {
    const buf = Buffer.alloc(300);
    expect(() => parseDhcpPacket(buf)).toThrow("Invalid DHCP magic cookie");
  });
});

describe("formatDhcpPacket", () => {
  const minimalInput: DhcpInputHeader = {
    op: 1,
    htype: 1,
    hlen: 6,
    hops: 0,
    xid: 0xabcdef01,
    secs: 0,
    flags: 0x8000,
    ciaddr: "0.0.0.0",
    yiaddr: "0.0.0.0",
    siaddr: "0.0.0.0",
    giaddr: "0.0.0.0",
    chaddr: "aa:bb:cc:dd:ee:ff",
    sname: "",
    bootFile: "",
    options: {
      [DHCP_OPTION.MESSAGE_TYPE]: DHCP_MESSAGE_TYPE.DHCPDISCOVER,
      [DHCP_OPTION.PARAMETER_REQUEST_LIST]: [1, 3, 6, 15],
    },
  };

  it("produces a packet at least MIN_DHCP_PACKET_SIZE bytes", () => {
    const buf = formatDhcpPacket(minimalInput);
    expect(buf.length).toBeGreaterThanOrEqual(MIN_DHCP_PACKET_SIZE);
  });

  it("round-trips through parse", () => {
    const buf = formatDhcpPacket(minimalInput);
    const parsed = parseDhcpPacket(buf);

    expect(parsed.op).toBe(minimalInput.op);
    expect(parsed.htype).toBe(minimalInput.htype);
    expect(parsed.hlen).toBe(minimalInput.hlen);
    expect(parsed.xid).toBe(minimalInput.xid);
    expect(parsed.flags).toBe(minimalInput.flags);
    expect(parsed.chaddr).toBe(minimalInput.chaddr);
    expect(parsed.options[DHCP_OPTION.MESSAGE_TYPE]).toBe(DHCP_MESSAGE_TYPE.DHCPDISCOVER);
    expect(parsed.options[DHCP_OPTION.PARAMETER_REQUEST_LIST]).toEqual([1, 3, 6, 15]);
  });

  it("round-trips a full DHCPOFFER", () => {
    const input: DhcpInputHeader = {
      op: 2,
      htype: 1,
      hlen: 6,
      hops: 0,
      xid: 0x11112222,
      secs: 0,
      flags: 0x8000,
      ciaddr: "0.0.0.0",
      yiaddr: "10.0.0.50",
      siaddr: "10.0.0.1",
      giaddr: "0.0.0.0",
      chaddr: "00:11:22:33:44:55",
      sname: "server1",
      bootFile: "",
      options: {
        [DHCP_OPTION.MESSAGE_TYPE]: DHCP_MESSAGE_TYPE.DHCPOFFER,
        [DHCP_OPTION.SERVER_IDENTIFIER]: "10.0.0.1",
        [DHCP_OPTION.IP_ADDRESS_LEASE_TIME]: 7200,
        [DHCP_OPTION.SUBNET_MASK]: "255.255.255.0",
        [DHCP_OPTION.ROUTER]: "10.0.0.1",
        [DHCP_OPTION.DOMAIN_NAME_SERVER]: ["10.0.0.1", "1.1.1.1"],
      },
    };

    const buf = formatDhcpPacket(input);
    const parsed = parseDhcpPacket(buf);

    expect(parsed.yiaddr).toBe("10.0.0.50");
    expect(parsed.siaddr).toBe("10.0.0.1");
    expect(parsed.sname).toBe("server1");
    expect(parsed.options[DHCP_OPTION.MESSAGE_TYPE]).toBe(DHCP_MESSAGE_TYPE.DHCPOFFER);
    expect(parsed.options[DHCP_OPTION.SERVER_IDENTIFIER]).toBe("10.0.0.1");
    expect(parsed.options[DHCP_OPTION.IP_ADDRESS_LEASE_TIME]).toBe(7200);
    expect(parsed.options[DHCP_OPTION.SUBNET_MASK]).toBe("255.255.255.0");
    expect(parsed.options[DHCP_OPTION.ROUTER]).toBe("10.0.0.1");
    expect(parsed.options[DHCP_OPTION.DOMAIN_NAME_SERVER]).toEqual(["10.0.0.1", "1.1.1.1"]);
  });
});
