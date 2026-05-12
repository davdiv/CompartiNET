import { type ReactiveFn } from "signalium";

/** Every service spec shares these fields. No generic config bag. */
export interface BaseServiceSpec {
  type: "ServiceSpec";
  serviceType: string;
  serviceKey: string;
}

/** Available to feature handlers via signalium's getContext(). */
export interface ServiceContext {
  /** Subscribes to output changes for `serviceKey` and returns the current data (or null). */
  getServiceOutput<T>(serviceKey: string): T | null;
}

/** A service handler factory. Wraps the service process lifecycle in a signalium relay. */
export type ServiceHandler<TSpec extends BaseServiceSpec, TOutput> = ReactiveFn<Promise<TOutput> | TOutput, [TSpec]>;

export type ServiceHandlerMap<ServiceSpec extends BaseServiceSpec> = { [K in ServiceSpec["serviceType"]]: ServiceHandler<ServiceSpec & { serviceType: K }, any> };
