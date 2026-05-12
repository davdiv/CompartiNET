import { NamespaceModel, NetnsInode, NetworkModel } from "./networkModel";

export const inconsistentModelFailure = (error: string) => new Error(error);

export const getNetnsName = (model: NetworkModel, id: NetnsInode): string | undefined => {
  for (const [name, inode] of Object.entries(model.namedNetns)) {
    if (inode === id) return name;
  }
  return undefined;
};

export const requireNetnsName = (model: NetworkModel, id: NetnsInode): string => getNetnsName(model, id) ?? `<unknown-netns:${id}>`;

export const getNetns = (model: NetworkModel, name: string): NamespaceModel | undefined => {
  const inode = model.namedNetns[name];
  if (inode === undefined) return undefined;
  return Object.hasOwn(model.netnsById, inode) ? model.netnsById[inode] : undefined;
};

export const getIface = (netnsModel: NamespaceModel, iface: string) => (Object.hasOwn(netnsModel.interfaces, iface) ? netnsModel.interfaces[iface] : undefined);

export const checkNetnsExists = (model: NetworkModel, name: string): NamespaceModel => {
  const netnsModel = getNetns(model, name);
  if (!netnsModel) {
    throw new Error(`Namespace ${name} does not exist`);
  }
  return netnsModel;
};

export const checkIfaceExists = (model: NetworkModel, netns: string, altname: string, throwOnAltname = false) => {
  const netnsModel = checkNetnsExists(model, netns);
  let ifaceModel = getIface(netnsModel, altname);
  if (!ifaceModel) {
    throw new Error(`Interface ${altname} does not exist in namespace ${netns}`);
  }
  let iface = altname;
  let altnameModel = undefined;
  if (ifaceModel.type === "altname") {
    if (throwOnAltname) {
      throw new Error(`Interface ${altname} in namespace ${netns} is an altname`);
    }
    iface = ifaceModel.iface;
    altnameModel = ifaceModel;
    ifaceModel = getIface(netnsModel, iface);
    if (!ifaceModel) {
      throw inconsistentModelFailure(`Altname ${altname} in namespace ${netns} points to missing interface ${iface}`);
    }
    if (ifaceModel.type === "altname") {
      throw inconsistentModelFailure(`Altname ${altname} in namespace ${netns} points to altname-typed interface ${iface}`);
    }
  }
  return { netnsModel, iface, ifaceModel, altnameModel };
};

export const checkIfaceNotExists = (netnsModel: NamespaceModel, netns: string, iface: string) => {
  if (Object.hasOwn(netnsModel.interfaces, iface)) {
    throw new Error(`Interface ${iface} already exists in namespace ${netns}`);
  }
};
