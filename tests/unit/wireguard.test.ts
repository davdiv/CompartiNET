import { describe, expect, it } from "vitest";
import { parseWgConfig } from "../../src/common/model/wg/parser";
import { formatWgConfig } from "../../src/common/model/wg/formatter";
import { isWgConfigEqual } from "../../src/common/model/wg/compare";
import { WireguardConfig } from "../../src/common/model/networkModel";
import { parseIpAddressModel } from "../../src/common/model/ip";

const checkWgConfig = (strConfig: string, wgConfig: WireguardConfig) => {
  expect(parseWgConfig(strConfig)).toEqual(wgConfig);
  expect(formatWgConfig(wgConfig)).toBe(strConfig);
};

it("format and parse wireguard config", () => {
  checkWgConfig(`[Interface]\n`, { peers: [] });
  checkWgConfig(`[Interface]\nListenPort = 5000\n`, { listenPort: 5000, peers: [] });
  checkWgConfig(
    `[Interface]\nListenPort = 5000\nPrivateKey = KHk8Kq+gKJUNWIi2RCZowJ0vACQaNmymQgUv0NTkGFo=\n\n[Peer]\nPublicKey = 2e4aAH9IjInXYcobkC/FlAMATxjsX72Kqv8qT7H6jUU=\nAllowedIPs = 10.1.2.1/32\nAllowedIPs = 10.1.3.1/24\n`,
    {
      privateKey: "KHk8Kq+gKJUNWIi2RCZowJ0vACQaNmymQgUv0NTkGFo=",
      listenPort: 5000,
      peers: [
        {
          allowedIPs: [parseIpAddressModel("10.1.2.1/32"), parseIpAddressModel("10.1.3.1/24")],
          publicKey: "2e4aAH9IjInXYcobkC/FlAMATxjsX72Kqv8qT7H6jUU=",
        },
      ],
    },
  );
});

describe("parseWgConfig", () => {
  it("parses an empty config", () => {
    const config = parseWgConfig("");
    expect(config).toEqual({ peers: [] });
  });

  it("parses a minimal interface config", () => {
    const config = parseWgConfig(`[Interface]\nPrivateKey = abc123\nListenPort = 51820`);
    expect(config).toEqual({
      privateKey: "abc123",
      listenPort: 51820,
      peers: [],
    });
  });

  it("parses a full config with multiple peers", () => {
    const config = parseWgConfig(`
[Interface]
PrivateKey = dGhpcyBpcyBqdXN0IGFuIGV4YW1wbGU=
ListenPort = 51820

[Peer]
PublicKey = peer1pubkey
PresharedKey = peer1psk
AllowedIPs = 10.0.0.1/32, 10.0.0.2/32
Endpoint = 192.168.1.1:51820
PersistentKeepalive = 25

[Peer]
PublicKey = peer2pubkey
AllowedIPs = 10.0.0.3/32
`);
    expect(config).toEqual({
      privateKey: "dGhpcyBpcyBqdXN0IGFuIGV4YW1wbGU=",
      listenPort: 51820,
      peers: [
        {
          publicKey: "peer1pubkey",
          presharedKey: "peer1psk",
          allowedIPs: [parseIpAddressModel("10.0.0.1/32"), parseIpAddressModel("10.0.0.2/32")],
          endpoint: "192.168.1.1:51820",
          persistentKeepalive: 25,
        },
        {
          publicKey: "peer2pubkey",
          allowedIPs: [parseIpAddressModel("10.0.0.3/32")],
        },
      ],
    });
  });

  describe("isWgConfigEqual", () => {
    const base: WireguardConfig = { peers: [] };

    it("same object is equal", () => {
      expect(isWgConfigEqual(base, base)).toBe(true);
    });

    it("identical configs are equal", () => {
      expect(isWgConfigEqual(base, { peers: [] })).toBe(true);
    });

    it("privateKey difference", () => {
      expect(isWgConfigEqual(base, { ...base, privateKey: "abc" })).toBe(false);
    });

    it("listenPort difference", () => {
      expect(isWgConfigEqual(base, { ...base, listenPort: 51820 })).toBe(false);
    });

    it("fwMark difference", () => {
      expect(isWgConfigEqual(base, { ...base, fwMark: 1234 })).toBe(false);
    });

    it("peer count difference", () => {
      const a: WireguardConfig = { peers: [{ publicKey: "k1", allowedIPs: [] }] };
      const b: WireguardConfig = { peers: [] };
      expect(isWgConfigEqual(a, b)).toBe(false);
    });

    it("peer publicKey difference", () => {
      const a: WireguardConfig = { peers: [{ publicKey: "k1", allowedIPs: [] }] };
      const b: WireguardConfig = { peers: [{ publicKey: "k2", allowedIPs: [] }] };
      expect(isWgConfigEqual(a, b)).toBe(false);
    });

    it("peer property difference", () => {
      const a: WireguardConfig = { peers: [{ publicKey: "k1", endpoint: "e1:1", allowedIPs: [] }] };
      const b: WireguardConfig = { peers: [{ publicKey: "k1", endpoint: "e2:2", allowedIPs: [] }] };
      expect(isWgConfigEqual(a, b)).toBe(false);
    });

    it("same peers in different order are equal", () => {
      const a: WireguardConfig = {
        privateKey: "sk",
        listenPort: 51820,
        peers: [
          { publicKey: "k1", allowedIPs: [parseIpAddressModel("10.0.0.1/32")] },
          { publicKey: "k2", allowedIPs: [parseIpAddressModel("10.0.0.2/32")] },
        ],
      };
      const b: WireguardConfig = {
        privateKey: "sk",
        listenPort: 51820,
        peers: [
          { publicKey: "k2", allowedIPs: [parseIpAddressModel("10.0.0.2/32")] },
          { publicKey: "k1", allowedIPs: [parseIpAddressModel("10.0.0.1/32")] },
        ],
      };
      expect(isWgConfigEqual(a, b)).toBe(true);
    });

    it("same peers but allowedIPs in different order are not equal", () => {
      const a: WireguardConfig = {
        peers: [{ publicKey: "k1", allowedIPs: [parseIpAddressModel("10.0.0.1/32"), parseIpAddressModel("10.0.0.2/32")] }],
      };
      const b: WireguardConfig = {
        peers: [{ publicKey: "k1", allowedIPs: [parseIpAddressModel("10.0.0.2/32"), parseIpAddressModel("10.0.0.1/32")] }],
      };
      expect(isWgConfigEqual(a, b)).toBe(false);
    });

    it("empty configs are equal", () => {
      expect(isWgConfigEqual({ peers: [] }, { peers: [] })).toBe(true);
    });
  });

  it("ignores comments and blank lines", () => {
    const config = parseWgConfig(`
# This is a comment
[Interface]
PrivateKey = key

# another comment
ListenPort = 1234

[Peer]
# peer comment
PublicKey = pub
AllowedIPs = 1.2.3.4/32
`);
    expect(config).toEqual({
      privateKey: "key",
      listenPort: 1234,
      peers: [
        {
          publicKey: "pub",
          allowedIPs: [parseIpAddressModel("1.2.3.4/32")],
        },
      ],
    });
  });
});
