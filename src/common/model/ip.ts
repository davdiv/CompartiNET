import { IpAddressModel } from "./networkModel";
import { parse, parseCIDR } from "ipaddr.js";

export const parseIpAddressModel = (ip: string): IpAddressModel => {
  if (ip.includes("/")) {
    const [ipObject, prefixLength] = parseCIDR(ip);
    return {
      family: ipObject.kind(),
      address: ipObject.toNormalizedString(),
      prefixLength: prefixLength,
    };
  } else {
    const ipObject = parse(ip);
    return {
      family: ipObject.kind(),
      address: ipObject.toNormalizedString(),
      prefixLength: ipObject.kind() === "ipv6" ? 128 : 32,
    };
  }
};

export const formatIpAddressModel = (ip: IpAddressModel) => `${ip.address}/${ip.prefixLength}`;
