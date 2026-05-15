// Note that the action in this file is only intended to be used as a feature to create the correct desired state
// as there is obviously no command to open a socket

import { ListeningSocket, NetworkModel } from "../networkModel";
import { checkNetnsExists } from "../utils";

export interface OpenSocketAction {
  type: "OpenSocket";
  netns: string;
  socket: ListeningSocket;
}

export const sameSocketKey = (a: ListeningSocket, b: ListeningSocket) => a.protocol === b.protocol && a.host === b.host && a.zone === b.zone && a.port === b.port;

export const formatSocket = (s: ListeningSocket) => `${s.protocol}/${s.host}${s.zone ? "%" + s.zone : ""}:${s.port}`;

export const applyOpenSocket = (model: NetworkModel, { netns, socket }: OpenSocketAction) => {
  const ns = checkNetnsExists(model, netns);
  const duplicate = ns.listeningSockets.find((s) => sameSocketKey(s, socket));
  if (duplicate) {
    throw new Error(`Duplicate listening socket ${formatSocket(socket)} in namespace ${netns}`);
  }
  ns.listeningSockets.push(socket);
};

export const commandForOpenSocket = () => {
  throw new Error("There is no command to open a socket!");
};
