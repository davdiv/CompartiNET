import { isDeepStrictEqual } from "node:util";
import { WireguardConfig } from "../networkModel";

/**
 * Deeply compares two WireguardConfigs, matching peers by publicKey so that peer order does not matter.
 */
export const isWgConfigEqual = (a: WireguardConfig, b: WireguardConfig): boolean => {
  if (a.privateKey !== b.privateKey) return false;
  if (a.listenPort !== b.listenPort) return false;
  if (a.fwMark !== b.fwMark) return false;
  if (a.peers.length !== b.peers.length) return false;

  const bPeersByKey = new Map(b.peers.map((p) => [p.publicKey, p]));

  for (const aPeer of a.peers) {
    const bPeer = bPeersByKey.get(aPeer.publicKey);
    if (!bPeer || !isDeepStrictEqual(aPeer, bPeer)) return false;
  }

  return true;
};
