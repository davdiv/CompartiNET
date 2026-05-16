import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { generateActualNetworkModel } from "../common/model/actualModelGenerator";
import { IPRoute2BridgeVlan, IPRoute2Interface, IPRoute2NetnsState, IPRoute2Route, LsnsNetNamespace } from "../common/model/iproute2";
import { NetworkModel } from "../common/model/networkModel";
import { getNetnsPath, namedNetnsPath } from "./netnsPath";
import { NetnsWorker, setupWorkerWithSysMount } from "./netnsWorker/create";
import { exec } from "./spawnUtils";
import { getReverseMap } from "../common/utils/reverseMap";

const LSNS_RETRIES = 3;
const LSNS_RETRY_DELAY_MS = 50;

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

const collectLsns = async (netnsWorker: NetnsWorker | null, errors: string[], description: string): Promise<LsnsNetNamespace[]> => {
  const args = ["lsns", "-J", "-t", "net", "-o", "NS,NETNSID"];
  let lastError: unknown;
  for (let attempt = 0; attempt < LSNS_RETRIES; attempt++) {
    try {
      const text = (netnsWorker ? await netnsWorker.call<Buffer>({ type: "exec", args }) : await exec(args)).toString("utf-8");
      const parsed = JSON.parse(text) as { namespaces?: LsnsNetNamespace[] };
      return parsed.namespaces ?? [];
    } catch (error) {
      lastError = error;
      if (attempt < LSNS_RETRIES - 1) {
        await delay(LSNS_RETRY_DELAY_MS);
      }
    }
  }
  errors.push(`Failed to collect ${description}: ${lastError}`);
  return [];
};

const collectRawStateForNetns = async (ino: number, names: string[]): Promise<{ state: IPRoute2NetnsState; errors: string[] }> => {
  const netns = names[0];
  using worker = netns ? await setupWorkerWithSysMount(netns) : null;

  const errors: string[] = [];

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

  const [addr, wireguard, route, lsns, bridgeVlans, iwDev, listeningSockets] = await Promise.all([
    addrPromise,
    wireguardPromise,
    tryCollect<IPRoute2Route[]>(worker, ["ip", "-j", "route", "list", "table", "all"], true, [], errors, "routes"),
    collectLsns(worker, errors, "netns IDs (lsns)"),
    tryCollect<IPRoute2BridgeVlan[]>(worker, ["bridge", "-j", "vlan", "show"], true, [], errors, "bridge VLANs"),
    tryCollect<string | undefined>(worker, ["iw", "dev"], false, undefined, errors, "iw dev"),
    tryCollect<string | undefined>(worker, ["ss", "-tuln", "-H"], false, undefined, errors, "listening sockets"),
  ]);

  return {
    state: {
      ino,
      names,
      addr,
      route,
      wireguard,
      lsns,
      bridgeVlans,
      iwDev,
      listeningSockets,
    },
    errors,
  };
};

export interface CollectStateOptions {
  netnsDirs?: string[];
}

const listNetns = async (netnsDirs: string[], errors: string[]) => {
  const names = [""];
  for (const dir of netnsDirs) {
    try {
      let entries = await readdir(dir);
      if (dir !== namedNetnsPath) {
        entries = entries.map((name) => join(dir, name));
      }
      names.push(...entries);
    } catch (e: any) {
      if (e?.code === "ENOENT") continue;
      errors.push(`Failed to list netns directory "${dir}": ${e}`);
      continue;
    }
  }
  const nameToIno = Object.fromEntries(
    (
      await Promise.all(
        names.map(async (name): Promise<[string, number][]> => {
          try {
            return [[name, await getNetnsIno(name)]];
          } catch (error) {
            errors.push(`Failed to get netns ino "${name}": ${error}`);
            return [];
          }
        }),
      )
    ).flat(),
  );
  return getReverseMap<string, number>(nameToIno);
};

export const collectRawState = async ({ netnsDirs = [namedNetnsPath] }: CollectStateOptions = {}): Promise<{ state: IPRoute2NetnsState[]; errors: string[] }> => {
  const errors: string[] = [];
  const inoToNames = await listNetns(netnsDirs, errors);

  const nsResults = await Promise.all(
    Object.entries(inoToNames).map(async ([ino, names]): Promise<{ state: IPRoute2NetnsState | null; errors: string[] }> => {
      try {
        return await collectRawStateForNetns(+ino, names);
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

export const collectState = async (options?: CollectStateOptions): Promise<{ state: NetworkModel; errors: string[] }> => {
  const { state, errors } = await collectRawState(options);
  return { state: generateActualNetworkModel(state), errors };
};
