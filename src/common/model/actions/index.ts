import { NetworkModel } from "../networkModel";
import { AddIpAddressAction, RemoveIpAddressAction, applyAddIpAddress, applyRemoveIpAddress, commandForAddIpAddress, commandForRemoveIpAddress } from "./address";
import { AddAltnameAction, RemoveAltnameAction, applyAddAltname, applyRemoveAltname, commandForAddAltname, commandForRemoveAltname } from "./altname";
import {
  AddBridgePortAction,
  AddBridgePortVlanAction,
  CreateBridgeAction,
  DeleteBridgeAction,
  RemoveBridgePortAction,
  RemoveBridgePortVlanAction,
  SetBridgeVlanFilteringAction,
  applyAddBridgePort,
  applyAddBridgePortVlan,
  applyCreateBridge,
  applyDeleteBridge,
  applyRemoveBridgePort,
  applyRemoveBridgePortVlan,
  applySetBridgeVlanFiltering,
  commandForAddBridgePort,
  commandForAddBridgePortVlan,
  commandForCreateBridge,
  commandForDeleteBridge,
  commandForRemoveBridgePort,
  commandForRemoveBridgePortVlan,
  commandForSetBridgeVlanFiltering,
} from "./bridge";
import { MatchHardwareAction, applyMatchHardware, commandForMatchHardware } from "./hardware";
import { MoveInterfaceAction, SetInterfaceUpAction, applyMoveInterface, applySetInterfaceUp, commandForMoveInterface, commandForSetInterfaceUp } from "./interface";
import { CreateNamespaceAction, DeleteNamespaceAction, applyCreateNamespace, applyDeleteNamespace, commandForCreateNamespace, commandForDeleteNamespace } from "./namespace";
import { AddRouteAction, RemoveRouteAction, applyAddRoute, applyRemoveRoute, commandForAddRoute, commandForRemoveRoute } from "./route";
import { OpenSocketAction, applyOpenSocket, commandForOpenSocket } from "./socket";
import { ActionHandler, ActionHandlerMap, CommandForHandler, CommandForHandlerMap } from "./types";
import { CreateVethAction, DeleteVethAction, applyCreateVeth, applyDeleteVeth, commandForCreateVeth, commandForDeleteVeth } from "./veth";
import {
  CreateWireguardAction,
  DeleteWireguardAction,
  SetWireguardConfigAction,
  applyCreateWireguard,
  applyDeleteWireguard,
  applySetWireguardConfig,
  commandForCreateWireguard,
  commandForDeleteWireguard,
  commandForSetWireguardConfig,
} from "./wireguard";
import { MoveWirelessPhyAction, applyMoveWirelessPhy, commandForMoveWirelessPhy } from "./wireless";

export type ConfigNetworkCreateAction =
  | CreateNamespaceAction
  | MatchHardwareAction
  | CreateVethAction
  | CreateBridgeAction
  | AddAltnameAction
  | AddBridgePortAction
  | AddBridgePortVlanAction
  | AddIpAddressAction
  | SetInterfaceUpAction
  | AddRouteAction;

export type NetworkCreateAction = ConfigNetworkCreateAction | OpenSocketAction | CreateWireguardAction | MoveInterfaceAction | SetWireguardConfigAction;

const applyNetworkCreateHandlers: ActionHandlerMap<NetworkCreateAction> = {
  CreateNamespace: applyCreateNamespace,
  OpenSocket: applyOpenSocket,
  CreateWireguard: applyCreateWireguard,
  MoveInterface: applyMoveInterface,
  MatchHardware: applyMatchHardware,
  CreateVeth: applyCreateVeth,
  CreateBridge: applyCreateBridge,
  AddAltname: applyAddAltname,
  AddBridgePort: applyAddBridgePort,
  AddBridgePortVlan: applyAddBridgePortVlan,
  SetWireguardConfig: applySetWireguardConfig,
  AddIpAddress: applyAddIpAddress,
  SetInterfaceUp: applySetInterfaceUp,
  AddRoute: applyAddRoute,
};

const createActionsOrder = Object.fromEntries(Object.keys(applyNetworkCreateHandlers).map((key, index) => [key, index]));
export const compareCreateActions = (a: NetworkCreateAction, b: NetworkCreateAction) => {
  return createActionsOrder[a.type] - createActionsOrder[b.type];
};
export const sortCreateActions = (actions: NetworkCreateAction[]): NetworkCreateAction[] => {
  actions.sort(compareCreateActions);
  return actions;
};

export type NetworkDeleteAction =
  | DeleteNamespaceAction
  | MoveWirelessPhyAction
  | RemoveIpAddressAction
  | RemoveRouteAction
  | DeleteBridgeAction
  | RemoveBridgePortAction
  | RemoveBridgePortVlanAction
  | SetBridgeVlanFilteringAction
  | DeleteVethAction
  | DeleteWireguardAction
  | RemoveAltnameAction;

export type NetworkAction = NetworkCreateAction | NetworkDeleteAction;

const applyHandlers: ActionHandlerMap<NetworkAction> = {
  ...applyNetworkCreateHandlers,
  DeleteNamespace: applyDeleteNamespace,
  MoveWirelessPhy: applyMoveWirelessPhy,
  RemoveIpAddress: applyRemoveIpAddress,
  RemoveRoute: applyRemoveRoute,
  DeleteBridge: applyDeleteBridge,
  RemoveBridgePort: applyRemoveBridgePort,
  RemoveBridgePortVlan: applyRemoveBridgePortVlan,
  SetBridgeVlanFiltering: applySetBridgeVlanFiltering,
  DeleteVeth: applyDeleteVeth,
  DeleteWireguard: applyDeleteWireguard,
  RemoveAltname: applyRemoveAltname,
};

const commandForHandlers: CommandForHandlerMap<NetworkAction> = {
  CreateNamespace: commandForCreateNamespace,
  DeleteNamespace: commandForDeleteNamespace,
  OpenSocket: commandForOpenSocket,
  MatchHardware: commandForMatchHardware,
  MoveInterface: commandForMoveInterface,
  MoveWirelessPhy: commandForMoveWirelessPhy,
  SetInterfaceUp: commandForSetInterfaceUp,
  AddIpAddress: commandForAddIpAddress,
  RemoveIpAddress: commandForRemoveIpAddress,
  AddRoute: commandForAddRoute,
  RemoveRoute: commandForRemoveRoute,
  CreateBridge: commandForCreateBridge,
  DeleteBridge: commandForDeleteBridge,
  AddBridgePort: commandForAddBridgePort,
  AddBridgePortVlan: commandForAddBridgePortVlan,
  RemoveBridgePort: commandForRemoveBridgePort,
  RemoveBridgePortVlan: commandForRemoveBridgePortVlan,
  SetBridgeVlanFiltering: commandForSetBridgeVlanFiltering,
  CreateVeth: commandForCreateVeth,
  DeleteVeth: commandForDeleteVeth,
  CreateWireguard: commandForCreateWireguard,
  DeleteWireguard: commandForDeleteWireguard,
  SetWireguardConfig: commandForSetWireguardConfig,
  AddAltname: commandForAddAltname,
  RemoveAltname: commandForRemoveAltname,
};

/**
 * Applies a NetworkAction to a NetworkModel and returns the modified model.
 * This function mutates the provided model.
 */
export function applyAction(model: NetworkModel, action: NetworkAction): NetworkModel {
  const handler = applyHandlers[action.type] as ActionHandler<typeof action>;
  handler(model, action);
  return model;
}

export const commandForAction = (action: NetworkAction) => {
  const handler = commandForHandlers[action.type] as CommandForHandler<typeof action>;
  return handler(action);
};
