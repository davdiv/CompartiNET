import { getIpNetnsPrefix } from "../commands";
import { NetworkModel } from "../networkModel";
import { checkIfaceExists, checkIfaceNotExists, inconsistentModelFailure } from "../utils";

export interface AddAltnameAction {
  type: "AddAltname";
  netns: string;
  iface: string;
  altname: string;
}

export interface RemoveAltnameAction {
  type: "RemoveAltname";
  netns: string;
  altname: string;
}

export const applyAddAltname = (model: NetworkModel, { netns, iface: ifaceOrAltname, altname }: AddAltnameAction) => {
  const { netnsModel: ns, ifaceModel, iface } = checkIfaceExists(model, netns, ifaceOrAltname);
  checkIfaceNotExists(ns, netns, altname);
  ifaceModel.altnames.push(altname);
  ns.interfaces[altname] = { type: "altname", iface };
};

export const applyRemoveAltname = (model: NetworkModel, { netns, altname }: RemoveAltnameAction) => {
  const { netnsModel: ns, iface, ifaceModel, altnameModel } = checkIfaceExists(model, netns, altname);
  if (!altnameModel) {
    throw new Error(`${altname} is not an altname in namespace ${netns}.`);
  }
  const idx = ifaceModel.altnames.indexOf(altname);
  if (idx === -1) {
    throw inconsistentModelFailure(`Missing altname ${altname} in interface ${iface} in namespace ${netns}`);
  }
  ifaceModel.altnames.splice(idx, 1);
  delete ns.interfaces[altname];
};

export const commandForAddAltname = ({ netns, iface, altname }: AddAltnameAction) => [...getIpNetnsPrefix(netns), "link", "property", "add", "dev", iface, "altname", altname];

export const commandForRemoveAltname = ({ netns, altname }: RemoveAltnameAction) => [...getIpNetnsPrefix(netns), "link", "property", "del", "dev", altname, "altname", altname];
