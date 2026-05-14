// Note that the action in this file is only intended to be used as a feature to create the correct desired state
// as there is obviously no command to open a socket

import { ListeningSocket, NetworkModel } from "../networkModel";
import { checkNetnsExists } from "../utils";

export interface OpenSocketAction {
  type: "OpenSocket";
  netns: string;
  socket: ListeningSocket;
}

export const applyOpenSocket = (model: NetworkModel, { netns, socket }: OpenSocketAction) => {
  const ns = checkNetnsExists(model, netns);
  const duplicate = ns.listeningSockets.find((s) => s.protocol === socket.protocol && s.host === socket.host && s.zone === socket.zone && s.port === socket.port);
  if (duplicate) {
    throw new Error(`Duplicate listening socket ${socket.protocol}/${socket.host}${socket.zone ? "%" + socket.zone : ""}:${socket.port} in namespace ${netns}`);
  }
  ns.listeningSockets.push(socket);
};

export const commandForOpenSocket = () => {
  throw new Error("There is no command to open a socket!");
};
