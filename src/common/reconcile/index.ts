import { NetworkModel } from "../model/networkModel";
import { configureInterfaces } from "./configureInterfaces";
import { ReconcileContext } from "./context";
import { createInterfaces } from "./createInterfaces";
import { reconcileHardware } from "./hardware";
import { reconcileNamespaces } from "./namespaces";
import { removeUndesiredInterfaces } from "./removeInterfaces";
import { reconcileRoutes } from "./routes";
import { reconcileSockets } from "./reconcileSockets";

/**
 * Main reconciliation entry point.
 * Computes the difference between actual and desired state and generates a sequence of reconcile actions.
 * Returns the actions to be performed, the expected resulting network model and any errors encountered during the reconciliation process.
 */
export function reconcile(actual: NetworkModel, desired: NetworkModel) {
  const ctx = new ReconcileContext(actual, desired);

  const finishReconcileNamespaces = reconcileNamespaces(ctx);
  removeUndesiredInterfaces(ctx);
  reconcileHardware(ctx);
  createInterfaces(ctx);
  const finishReconcileRoutes = reconcileRoutes(ctx);
  configureInterfaces(ctx);
  finishReconcileNamespaces();
  finishReconcileRoutes();
  reconcileSockets(ctx);

  return {
    actions: ctx.actions,
    expectedModel: ctx.currentModel,
    errors: ctx.errors,
  };
}
