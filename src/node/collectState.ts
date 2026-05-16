import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { generateActualNetworkModel } from "../common/model/actualModelGenerator";
import { getBridgeNetnsPrefix, getIpNetnsPrefix, getNetnsPrefix } from "../common/model/commands";
import { IPRoute2BridgeVlan, IPRoute2Interface, IPRoute2NetnsId, IPRoute2NetnsState, IPRoute2Route } from "../common/model/iproute2";
import { NetworkModel } from "../common/model/networkModel";
import { getReverseMap } from "../common/utils/reverseMap";
import { exec, execOutJson } from "./spawnUtils";

export const namedNetnsPath = "/var/run/netns";

export const getNamedNetnsList = async () => {
  try {
    return await readdir(namedNetnsPath);
  } catch (e: any) {
    if (e.code === "ENOENT") {
      return [];
    }
    throw e;
  }
};

export const getNetnsPath = (id: string) => {
  if (id === "") {
    return `/proc/${process.pid}/ns/net`;
  } else if (id.startsWith("/")) {
    return id;
  } else {
    return join(namedNetnsPath, id);
  }
};

export const getNetnsIno = async (id: string) => (await stat(getNetnsPath(id))).ino;

const tryCollect = async <T>(description: string, netnsName: string, fn: () => Promise<T>, defaultValue: T, errors: string[]): Promise<T> => {
  try {
    return (await fn()) ?? defaultValue;
  } catch (error) {
    errors.push(`Failed to collect ${description} for namespace "${netnsName}": ${error}`);
    return defaultValue;
  }
};

export const collectRawStateForNetns = async (name: string, ino: number): Promise<{ state: IPRoute2NetnsState; errors: string[] }> => {
  const ipPrefix = getIpNetnsPrefix(name);
  const prefix = getNetnsPrefix(name);
  const errors: string[] = [];

  const addrPromise = tryCollect<IPRoute2Interface[]>("addresses", name, () => execOutJson([...ipPrefix, "-j", "-d", "addr"]), [], errors);

  const wireguardPromise = (async (): Promise<Record<string, string>> => {
    const addr = await addrPromise;
    const entries = await Promise.all(
      addr
        .filter(({ linkinfo }) => linkinfo?.info_kind === "wireguard")
        .map(async (iface): Promise<readonly [string, string] | null> => {
          const config = await tryCollect<string | undefined>(
            `WireGuard config for ${iface.ifname}`,
            name,
            async () => (await exec([...prefix, "wg", "showconf", iface.ifname])).toString("utf8"),
            undefined,
            errors,
          );
          return config !== undefined ? ([iface.ifname, config] as const) : null;
        }),
    );
    return Object.fromEntries(entries.filter((e): e is readonly [string, string] => e !== null));
  })();

  const [addr, wireguard, route, netnsIds, bridgeVlans, iwDev, listeningSockets] = await Promise.all([
    addrPromise,
    wireguardPromise,
    tryCollect<IPRoute2Route[]>("routes", name, () => execOutJson([...ipPrefix, "-j", "route", "list", "table", "all"]), [], errors),
    tryCollect<IPRoute2NetnsId[]>("netns IDs", name, () => execOutJson([...ipPrefix, "-j", "netns", "list-id"]), [], errors),
    tryCollect<IPRoute2BridgeVlan[]>("bridge VLANs", name, () => execOutJson([...getBridgeNetnsPrefix(name), "-j", "vlan", "show"]), [], errors),
    tryCollect<string | undefined>("iw dev", name, async () => (await exec([...prefix, "iw", "dev"])).toString("utf8"), undefined, errors),
    tryCollect<string | undefined>("listening sockets", name, async () => (await exec([...prefix, "ss", "-tuln", "-H"])).toString("utf8"), undefined, errors),
  ]);

  return {
    state: {
      ino,
      name: [name],
      addr,
      route,
      wireguard,
      netnsIds,
      bridgeVlans,
      iwDev,
      listeningSockets,
    },
    errors,
  };
};

export const collectRawState = async (): Promise<{ state: IPRoute2NetnsState[]; errors: string[] }> => {
  const errors: string[] = [];
  const netnsNames = ["", ...(await getNamedNetnsList())];

  const nameInoPairs = await Promise.all(
    netnsNames.map(async (name): Promise<[string, number] | null> => {
      try {
        return [name, await getNetnsIno(name)];
      } catch (error) {
        errors.push(`Failed to get inode for namespace "${name}": ${error}`);
        return null;
      }
    }),
  );

  const netnsByName = Object.fromEntries(nameInoPairs.filter((pair): pair is [string, number] => pair !== null));
  const netnsByIno = getReverseMap<string, number>(netnsByName);

  const nsResults = await Promise.all(Object.entries(netnsByIno).map(async ([ns, names]) => await collectRawStateForNetns(names[0], +ns)));

  return {
    state: nsResults.map((r) => r.state),
    errors: [...errors, ...nsResults.flatMap((r) => r.errors)],
  };
};

export const collectState = async (): Promise<{ state: NetworkModel; errors: string[] }> => {
  const { state, errors } = await collectRawState();
  return { state: generateActualNetworkModel(state), errors };
};
