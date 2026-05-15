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

export const newNetns = (): NamespaceModel => ({
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
  netnsByIno: { 0: newNetns() },
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
  model.netnsByIno[inode] = newNetns();
};

export const applyDeleteNamespace = (model: NetworkModel, { netns }: DeleteNamespaceAction) => {
  if (!netns) {
    throw new Error(`Cannot remove default netns`);
  }
  checkNetnsExists(model, netns);
  const inode = model.namedNetns[netns];
  delete model.netnsByIno[inode];
  delete model.namedNetns[netns];
};

export const commandForCreateNamespace = ({ netns }: CreateNamespaceAction) => ["ip", "netns", "add", netns];

export const commandForDeleteNamespace = ({ netns }: DeleteNamespaceAction) => ["ip", "netns", "del", netns];
