export type DhcpOption = number | string | Uint8Array | number[] | string[];

export type DhcpOptionMap = Record<number, DhcpOption>;

export interface DhcpHeader {
  op: number;
  htype: number;
  hlen: number;
  hops: number;
  xid: number;
  secs: number;
  flags: number;
  ciaddr: string;
  yiaddr: string;
  siaddr: string;
  giaddr: string;
  chaddr: string;
  sname: string;
  bootFile: string;
  magicCookie: number;
  options: DhcpOptionMap;
}

export type DhcpInputHeader = Omit<DhcpHeader, "magicCookie"> & Partial<Pick<DhcpHeader, "magicCookie">>;
