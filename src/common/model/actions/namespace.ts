import { Command } from "../commands";
import { NamespaceModel, NetworkModel } from "../networkModel";
import { checkNetnsExists } from "../utils";

export interface CreateNamespaceAction {
  type: "CreateNamespace";
  netns: string;
}

export interface DeleteNamespaceAction {
  type: "DeleteNamespace";
  netns: string;
}

export const newNetns = (names: string[] = []): NamespaceModel => ({
  names,
  interfaces: {
    lo: {
      type: "loopback",
      up: false,
      addresses: [],
      altnames: [],
      macAddress: "00:00:00:00:00:00",
      mtu: 65536,
      netnsImmutable: true,
    },
  },
  routes: [],
  listeningSockets: [],
});

let nextInode = 1;

export const newNetworkModel = (): NetworkModel => ({
  namedNetns: { "": 0 },
  netnsByIno: { 0: newNetns([""]) },
});

export const applyCreateNamespace = (model: NetworkModel, { netns }: CreateNamespaceAction) => {
  if (Object.hasOwn(model.namedNetns, netns)) {
    throw new Error(`Namespace ${netns} already exists`);
  }
  if (!netns) {
    // TODO: further check netns name
    throw new Error(`Invalid netns name: ${netns}`);
  }
  const inode = nextInode++;
  model.namedNetns[netns] = inode;
  model.netnsByIno[inode] = newNetns([netns]);
};

export const applyDeleteNamespace = (model: NetworkModel, { netns }: DeleteNamespaceAction) => {
  if (!netns) {
    throw new Error(`Cannot remove default netns`);
  }
  const ns = checkNetnsExists(model, netns);
  const inode = model.namedNetns[netns];
  for (const name of ns.names) {
    delete model.namedNetns[name];
  }
  delete model.netnsByIno[inode];
};

export const commandForCreateNamespace = ({ netns }: CreateNamespaceAction): Command => ({
  netns: "",
  args: [{ type: "netnsHelper" }, "create", netns],
});

export const commandForDeleteNamespace = ({ netns }: DeleteNamespaceAction): Command => ({
  netns: "",
  args: [{ type: "netnsHelper" }, "delete", netns],
});
