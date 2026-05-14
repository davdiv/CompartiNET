import { ListeningSocket } from "../model/networkModel";
import { ReconcileContext } from "./context";

function socketKey(s: ListeningSocket): string {
  return `${s.protocol}:${s.host}${s.zone ? "%" + s.zone : ""}:${s.port}`;
}

export function reconcileSockets(ctx: ReconcileContext): void {
  const namespaces = new Set([...Object.keys(ctx.currentModel.namedNetns), ...Object.keys(ctx.desiredModel.namedNetns)]);

  for (const netns of namespaces) {
    const { current, desired } = ctx.netns(netns);
    if (!current || !desired) continue;

    const desiredByKey = new Map<string, ListeningSocket>();
    for (const s of desired.listeningSockets) {
      desiredByKey.set(socketKey(s), s);
    }
    const currentByKey = new Map<string, ListeningSocket>();
    for (const s of current.listeningSockets) {
      currentByKey.set(socketKey(s), s);
    }

    for (const [key, desiredSocket] of desiredByKey) {
      const currentSocket = currentByKey.get(key);
      if (currentSocket && !currentSocket.serviceKey && desiredSocket.serviceKey) {
        ctx.addError(`Port conflict in namespace ${netns}: ${key} is in use by another process but needed by service "${desiredSocket.serviceKey}"`);
      }
    }
  }
}
