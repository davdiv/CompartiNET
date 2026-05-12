import { Command } from "../commands";
import { NetworkModel } from "../networkModel";

export type ActionHandler<Action> = (model: NetworkModel, action: Action) => void;
export type ActionHandlerMap<Action extends { type: string }> = { [K in Action["type"]]: ActionHandler<Action & { type: K }> };
export type CommandForHandler<Action> = (action: Action) => Command;
export type CommandForHandlerMap<Action extends { type: string }> = { [K in Action["type"]]: CommandForHandler<Action & { type: K }> };
