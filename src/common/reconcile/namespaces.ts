import { ReconcileContext } from "./context";
import { diffRecord } from "./diff";

export function reconcileNamespaces(ctx: ReconcileContext) {
  const nsDiff = diffRecord(ctx.currentModel.namedNetns, ctx.desiredModel.namedNetns);

  for (const netns of nsDiff.added) {
    if (!netns) continue;
    ctx.apply({ type: "CreateNamespace", netns });
  }

  return () => {
    for (const netns of nsDiff.removed) {
      if (!netns) continue;

      if (Object.hasOwn(ctx.currentModel.namedNetns, netns)) {
        ctx.apply({ type: "DeleteNamespace", netns });
      }
    }
  };
}
