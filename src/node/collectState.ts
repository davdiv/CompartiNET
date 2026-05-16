import { readdir, stat } from "node:fs/promises";
import { generateActualNetworkModel } from "../common/model/actualModelGenerator";
import { IPRoute2BridgeVlan, IPRoute2Interface, IPRoute2NetnsId, IPRoute2NetnsState, IPRoute2Route } from "../common/model/iproute2";
import { NetworkModel } from "../common/model/networkModel";
import { getReverseMap } from "../common/utils/reverseMap";
import { getNetnsPath, namedNetnsPath } from "./netnsPath";
import { createNetnsWorker, NetnsWorker } from "./netnsWorker/create";
import { exec } from "./spawnUtils";

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

export const getNetnsIno = async (id: string) => (await stat(getNetnsPath(id))).ino;

const tryCollect = async <T>(netnsWorker: NetnsWorker | null, args: string[], json: boolean, defaultValue: T, errors: string[], description: string): Promise<T> => {
  try {
    const text = (netnsWorker ? await netnsWorker.call<Buffer>({ type: "exec", args }) : await exec(args)).toString("utf-8");
    if (!text) {
      return defaultValue;
    }
    return (json ? JSON.parse(text) : text) ?? defaultValue;
  } catch (error) {
    errors.push(`Failed to collect ${description}: ${error}`);
    return defaultValue;
  }
};

const setupWorker = async (name: string): Promise<NetnsWorker | null> => {
  if (name === "") {
    return null;
  }
  const worker = await createNetnsWorker(name);
  try {
    await worker.setupMount();
  } catch (error) {
    worker.close();
    throw error;
  }
  return worker;
};

export const collectRawStateForNetns = async (name: string, ino: number): Promise<{ state: IPRoute2NetnsState; errors: string[] }> => {
  const errors: string[] = [];
  using worker = await setupWorker(name);

  const addrPromise = tryCollect<IPRoute2Interface[]>(worker, ["ip", "-j", "-d", "addr"], true, [], errors, "addresses");

  const wireguardPromise = (async (): Promise<Record<string, string>> => {
    const addr = await addrPromise;
    const entries = await Promise.all(
      addr
        .filter(({ linkinfo }) => linkinfo?.info_kind === "wireguard")
        .map(async (iface): Promise<readonly [string, string] | null> => {
          const config = await tryCollect<string | undefined>(worker, ["wg", "showconf", iface.ifname], false, undefined, errors, `WireGuard config for ${iface.ifname}`);
          return config !== undefined ? ([iface.ifname, config] as const) : null;
        }),
    );
    return Object.fromEntries(entries.filter((e): e is readonly [string, string] => e !== null));
  })();

  const [addr, wireguard, route, netnsIds, bridgeVlans, iwDev, listeningSockets] = await Promise.all([
    addrPromise,
    wireguardPromise,
    tryCollect<IPRoute2Route[]>(worker, ["ip", "-j", "route", "list", "table", "all"], true, [], errors, "routes"),
    tryCollect<IPRoute2NetnsId[]>(worker, ["ip", "-j", "netns", "list-id"], true, [], errors, "netns IDs"),
    tryCollect<IPRoute2BridgeVlan[]>(worker, ["bridge", "-j", "vlan", "show"], true, [], errors, "bridge VLANs"),
    tryCollect<string | undefined>(worker, ["iw", "dev"], false, undefined, errors, "iw dev"),
    tryCollect<string | undefined>(worker, ["ss", "-tuln", "-H"], false, undefined, errors, "listening sockets"),
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

  const nsResults = await Promise.all(
    Object.entries(netnsByIno).map(async ([ns, names]): Promise<{ state: IPRoute2NetnsState | null; errors: string[] }> => {
      try {
        return await collectRawStateForNetns(names[0], +ns);
      } catch (error) {
        return { state: null, errors: [`Failed to collect state for namespace "${names[0]}": ${error}`] };
      }
    }),
  );

  return {
    state: nsResults.flatMap((r) => (r.state ? [r.state] : [])),
    errors: [...errors, ...nsResults.flatMap((r) => r.errors)],
  };
};

export const collectState = async (): Promise<{ state: NetworkModel; errors: string[] }> => {
  const { state, errors } = await collectRawState();
  return { state: generateActualNetworkModel(state), errors };
};
