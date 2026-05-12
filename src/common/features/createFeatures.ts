import { context, reactive, type ReactiveFn } from "signalium";
import { ServiceContext } from "../services/types";

export const MarkReloadable = context(() => {});

export type FeatureHandler<InputFeature, OutputFeature> = ReactiveFn<OutputFeature[] | Promise<OutputFeature[]>, [InputFeature, ServiceContext]>;
export type FeatureHandlerMap<InputFeature extends { type: string }, OutputFeature> = { [K in InputFeature["type"]]: FeatureHandler<InputFeature & { type: K }, OutputFeature> };

export const createFeaturesFactory = <ExpandableFeature extends { type: string }, SimpleFeature>(
  featuresHandler: FeatureHandlerMap<ExpandableFeature, ExpandableFeature | SimpleFeature>,
  isExpandableFeature: (feature: ExpandableFeature | SimpleFeature) => feature is ExpandableFeature,
) => {
  const processFeature = reactive(async (context: ServiceContext, feature: ExpandableFeature | SimpleFeature): Promise<SimpleFeature[]> => {
    if (isExpandableFeature(feature)) {
      const handler = featuresHandler[feature.type as keyof typeof featuresHandler] as FeatureHandler<ExpandableFeature, ExpandableFeature> | undefined;
      if (!handler) {
        throw new Error(`Unsupported feature type: ${feature.type}`);
      }
      const outputFeatures = await handler(feature, context);
      return processFeatures(outputFeatures, context);
    } else {
      return [feature];
    }
  });
  const processFeatures = reactive(async (config: (ExpandableFeature | SimpleFeature)[], context: ServiceContext) => (await Promise.all(config.map(processFeature.bind(null, context)))).flat());
  return processFeatures;
};
