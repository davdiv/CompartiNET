import { reactive } from "signalium";
import { applyAction, NetworkCreateAction, sortCreateActions } from "../model/actions";
import { newNetworkModel } from "../model/actions/namespace";
import { createFeaturesFactory, FeatureHandlerMap } from "./createFeatures";
import { ServiceContext } from "../services/types";

export { type FeatureHandler, type FeatureHandlerMap } from "./createFeatures";

export const createDesiredModelFromBasicFeatures = (basicFeatures: NetworkCreateAction[]) => {
  const sorted = sortCreateActions([...basicFeatures]);
  // TODO: maybe deduplicate basic actions ?
  const model = newNetworkModel();
  for (const action of sorted) {
    applyAction(model, action);
  }
  return model;
};

export const createFeatureSystem = <ExpandableFeature extends { type: string }, ServiceSpec extends { type: "ServiceSpec" }>(
  featureHandlers: FeatureHandlerMap<ExpandableFeature, ExpandableFeature | NetworkCreateAction | ServiceSpec>,
) => {
  const isExpandableFeature = (feature: ExpandableFeature | NetworkCreateAction | ServiceSpec): feature is ExpandableFeature => Object.hasOwn(featureHandlers, feature.type);
  const createFeatures = createFeaturesFactory<ExpandableFeature, NetworkCreateAction | ServiceSpec>(featureHandlers, isExpandableFeature);
  return reactive(async (features: (ExpandableFeature | NetworkCreateAction | ServiceSpec)[], context: ServiceContext) => {
    const expandedFeatures = await createFeatures(features, context);
    const desiredServices: ServiceSpec[] = [];
    const createActions: NetworkCreateAction[] = [];
    for (const feature of expandedFeatures) {
      if (feature.type === "ServiceSpec") {
        desiredServices.push(feature);
      } else {
        createActions.push(feature);
      }
    }
    return {
      desiredState: createDesiredModelFromBasicFeatures(createActions),
      desiredServices,
    };
  });
};
