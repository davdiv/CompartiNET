import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { generateActualNetworkModel } from "../common/model/actualModelGenerator";
import { getBridgeNetnsPrefix, getIpNetnsPrefix, getNetnsPrefix } from "../common/model/commands";
import { IPRoute2Interface, IPRoute2NetnsState } from "../common/model/iproute2";
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

const collectWireguard = async (addr: IPRoute2Interface[], prefix: string[]): Promise<Record<string, string>> => {
  const wgInterfaces = addr.filter(({ linkinfo }) => linkinfo?.info_kind === "wireguard");
  const entries = await Promise.all(wgInterfaces.map(async ({ ifname }): Promise<[string, string]> => [ifname, (await exec([...prefix, "wg", "showconf", ifname])).toString("utf8")]));
  return Object.fromEntries(entries);
};

const execOptional = async (args: string[]) => {
  try {
    return await exec(args);
  } catch (error) {
    // TODO: improve error reporting:
    console.error(`Error while running ${args.join(" ")}: ${error}`);
  }
};

export const collectRawStateForNetns = async (name: string, ino?: number): Promise<IPRoute2NetnsState> => {
  const ipPrefix = getIpNetnsPrefix(name);
  const prefix = getNetnsPrefix(name);
  const addr: IPRoute2Interface[] = (await execOutJson([...ipPrefix, "-j", "-d", "addr"])) ?? [];
  return {
    ino: ino ?? (await getNetnsIno(name)),
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
  // TODO: if collecting the state fails for some netns or some commands, don't break the full collection
  const netnsByName = Object.fromEntries(await Promise.all(["", ...(await getNamedNetnsList())].map(async (name) => [name, await getNetnsIno(name)] as const)));
  const netnsByIno = getReverseMap<string, number>(netnsByName);
  return await Promise.all(Object.entries(netnsByIno).map(async ([ns, names]) => ({ ...(await collectRawStateForNetns(names[0], +ns)), names })));
};

export const collectState = async () => generateActualNetworkModel(await collectRawState());
