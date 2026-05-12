import { RouteModel } from "../model/networkModel";
import { ReconcileContext } from "./context";
import { diffArrays } from "./diff";

const routeKey = ({ family, address, prefixLength, iface, gateway, metric, onlink }: RouteModel) =>
  `${family}/${address}/${prefixLength}/${iface ?? ""}/${gateway ?? ""}/${metric ?? ""}/${onlink ?? false}`;

export function reconcileRoutes(ctx: ReconcileContext) {
  for (const netns of Object.keys(ctx.desiredModel.namedNetns)) {
    const { current, desired } = ctx.netns(netns);
    if (!current || !desired) continue;
    const diff = diffArrays(current.routes, desired.routes, routeKey);

    for (const route of diff.removed) {
      ctx.apply({
        type: "RemoveRoute",
        netns,
        route,
      });
    }
  }
  return () => {
    for (const netns of Object.keys(ctx.desiredModel.namedNetns)) {
      const { current, desired } = ctx.netns(netns);
      if (!current || !desired) continue;
      const diff = diffArrays(current.routes, desired.routes, routeKey);

      for (const route of diff.added) {
        ctx.apply({
          type: "AddRoute",
          netns,
          route,
        });
      }
    }
  };
}
