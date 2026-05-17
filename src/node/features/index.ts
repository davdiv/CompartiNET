import { createFeatureSystem } from "../../common/features";
import { WireguardFeature, wireguardHandler } from "../../common/features/wireguard";
import { ConfigNetworkCreateAction, NetworkCreateAction } from "../../common/model/actions";
import { createServiceManagerFactory } from "../../common/services/serviceManager";
import { dhcpClientServiceHandler, DhcpClientServiceSpec } from "../dhcp/client/machine";
import { ConfigDirectory, configDirectoryHandler } from "./configDirectory";
import { ConfigFile, configFileHandler } from "./configFile";

import { DhcpClientFeature, dhcpClientHandler } from "./dhcpClient";

export type ExpandableFeature = ConfigDirectory | ConfigFile | DhcpClientFeature | WireguardFeature;
export type ServiceSpec = DhcpClientServiceSpec;
export type Feature = ExpandableFeature | NetworkCreateAction | ServiceSpec;
export type ConfigFeature = ExpandableFeature | ConfigNetworkCreateAction;
export type Config = ConfigFeature[];

export const processFeatures = createFeatureSystem<ExpandableFeature, ServiceSpec>({
  ConfigDirectory: configDirectoryHandler,
  ConfigFile: configFileHandler,
  DhcpClient: dhcpClientHandler,
  Wireguard: wireguardHandler,
});

export const createServicesManager = createServiceManagerFactory<ServiceSpec>({
  DhcpClient: dhcpClientServiceHandler,
});
