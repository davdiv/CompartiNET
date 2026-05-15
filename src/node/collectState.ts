import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { generateActualNetworkModel } from "../common/model/actualModelGenerator";
import { getBridgeNetnsPrefix, getIpNetnsPrefix, getNetnsPrefix } from "../common/model/commands";
import { IPRoute2Interface, IPRoute2NetnsState } from "../common/model/iproute2";
import { exec, execOutJson } from "./spawnUtils";

export const namedNetnsPath = "/var/run/netns";

const collectWireguard = async (addr: IPRoute2Interface[], prefix: string[]): Promise<Record<string, string>> => {
  const wgInterfaces = addr.filter(({ linkinfo }) => linkinfo?.info_kind === "wireguard");
  const entries = await Promise.all(wgInterfaces.map(async ({ ifname }): Promise<[string, string]> => [ifname, (await exec([...prefix, "wg", "showconf", ifname])).toString("utf8")]));
  return Object.fromEntries(entries);
};

export const getNs = async (name: string) => {
  const statRes = await stat(join(namedNetnsPath, name));
  return statRes.ino;
};

export const collectNetnsMap = async () => {
  const result: Record<number, string[]> = {};
  const defaultNetns = (await stat("/proc/self/ns/net")).ino;
  result[defaultNetns] = [""];
  try {
    const netnsNames = await readdir(namedNetnsPath);
    const ns = await Promise.all(netnsNames.map(getNs));
    for (let i = 0, l = netnsNames.length; i < l; i++) {
      const curNs = ns[i];
      let curNames = result[curNs];
      if (!curNames) {
        curNames = [];
        result[curNs] = curNames;
      }
      curNames.push(netnsNames[i]);
    }
  } catch {
    // TODO: handle errors
  }
  return result;
};

const execOptional = async (args: string[]) => {
  try {
    return await exec(args);
  } catch (error) {
    // TODO: improve error reporting:
    console.error(`Error while running ${args.join(" ")}: ${error}`);
  }
};

export const collectRawStateForNetns = async (name: string, ns?: number): Promise<IPRoute2NetnsState> => {
  const ipPrefix = getIpNetnsPrefix(name);
  const prefix = getNetnsPrefix(name);
  const addr: IPRoute2Interface[] = (await execOutJson([...ipPrefix, "-j", "-d", "addr"])) ?? [];
  return {
    ns: ns ?? (await getNs(name)),
    name: [name],
    addr,
    route: (await execOutJson([...ipPrefix, "-j", "route", "list", "table", "all"])) ?? [],
    wireguard: await collectWireguard(addr, prefix),
    netnsIds: (await execOutJson([...ipPrefix, "-j", "netns", "list-id"])) ?? [],
    bridgeVlans: (await execOutJson([...getBridgeNetnsPrefix(name), "-j", "vlan", "show"])) ?? [],
    iwDev: (await execOptional([...prefix, "iw", "dev"]))?.toString("utf8"),
    listeningSockets: (await exec([...prefix, "ss", "-tuln", "-H"])).toString("utf8"),
  };
};

export const collectRawState = async () => {
  // TODO: if collecting the state fails for some netns, don't break the full collection
  const netnsMap = await collectNetnsMap();
  const netnsStates = await Promise.all(Object.entries(netnsMap).map(async ([ns, names]) => ({ ...(await collectRawStateForNetns(names[0], +ns)), names })));
  return netnsStates;
};

export const collectState = async () => generateActualNetworkModel(await collectRawState());
