import { createFeatureSystem } from "../../common/features";
import { NetworkCreateAction } from "../../common/model/actions";
import { createServiceManagerFactory } from "../../common/services/serviceManager";
import { dhcpClientServiceHandler, DhcpClientServiceSpec } from "../dhcp/client/machine";
import { ConfigDirectory, configDirectoryHandler } from "./configDirectory";
import { ConfigFile, configFileHandler } from "./configFile";

import { DhcpClientFeature, dhcpClientHandler } from "./dhcpClient";

export type ExpandableFeature = ConfigDirectory | ConfigFile | DhcpClientFeature;
export type ServiceSpec = DhcpClientServiceSpec;
export type Feature = ExpandableFeature | NetworkCreateAction | ServiceSpec;
export type Config = Feature[];

export const processFeatures = createFeatureSystem<ExpandableFeature, ServiceSpec>({
  ConfigDirectory: configDirectoryHandler,
  ConfigFile: configFileHandler,
  DhcpClient: dhcpClientHandler,
});

export const createServicesManager = createServiceManagerFactory<ServiceSpec>({
  DhcpClient: dhcpClientServiceHandler,
});
