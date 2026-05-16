import { Command } from "../commands";
import { formatIpAddressModel } from "../ip";
import { NetworkModel, RouteModel } from "../networkModel";
import { checkIfaceExists, checkNetnsExists } from "../utils";

export interface AddRouteAction {
  type: "AddRoute";
  netns: string;
  route: RouteModel;
}

export interface RemoveRouteAction {
  type: "RemoveRoute";
  netns: string;
  route: RouteModel;
}

export const applyAddRoute = (model: NetworkModel, { netns, route }: AddRouteAction) => {
  const ns = checkNetnsExists(model, netns);
  // TODO: fully validate route
  const { ifaceModel, iface } = checkIfaceExists(model, netns, route.iface);
  if (!ifaceModel.up) {
    throw new Error(`Device is down.`);
  }
  if (ns.routes.some((r) => r.address === route.address && r.prefixLength === route.prefixLength)) {
    throw new Error(`Incompatible route already exists for address ${route.address} in namespace ${netns}`);
  }
  // TODO: raise "nexthop has invalid gateway" errors when relevant
  ns.routes.push({ ...route, iface });
};

export const applyRemoveRoute = (model: NetworkModel, { netns, route }: RemoveRouteAction) => {
  const ns = checkNetnsExists(model, netns);
  const routeIndex = ns.routes.findIndex((r) => r.address === route.address && r.prefixLength === route.prefixLength);
  if (routeIndex === -1) {
    throw new Error(`Route ${route.address}/${route.prefixLength} does not exist in namespace ${netns}`);
  }
  ns.routes.splice(routeIndex, 1);
};

const getRouteParam = (route: RouteModel) => [formatIpAddressModel(route), ...(route.gateway ? ["via", route.gateway] : []), "dev", route.iface, ...(route.onlink ? ["onlink"] : [])];

export const commandForAddRoute = ({ netns, route }: AddRouteAction): Command => ({
  netns,
  args: ["ip", "route", "add", ...getRouteParam(route)],
});

export const commandForRemoveRoute = ({ netns, route }: RemoveRouteAction): Command => ({
  netns,
  args: ["ip", "route", "del", ...getRouteParam(route)],
});
