import { formatIpAddressModel } from "../ip";
import { WireguardConfig } from "../networkModel";

const basicFormatter = <T>(a: T) => `${a}`;
const formatProperty = <T>(property: string, value: T | null | undefined, formatter: (value: T) => string = basicFormatter) => {
  if (value != null) {
    const formattedValue = formatter(value);
    return `${property} = ${formattedValue}\n`;
  }
  return "";
};

export const formatWgConfig = (config: WireguardConfig) => {
  let output = `[Interface]\n`;
  output += formatProperty("ListenPort", config.listenPort);
  output += formatProperty("FwMark", config.fwMark);
  output += formatProperty("PrivateKey", config.privateKey);
  for (const peer of config.peers ?? []) {
    output += "\n[Peer]\n";
    output += formatProperty("PublicKey", peer.publicKey);
    output += formatProperty("PresharedKey", peer.presharedKey);
    for (const cidr of peer.allowedIPs ?? []) {
      output += formatProperty("AllowedIPs", cidr, formatIpAddressModel);
    }
    output += formatProperty("Endpoint", peer.endpoint);
    output += formatProperty("PersistentKeepalive", peer.persistentKeepalive);
  }
  return output;
};
