import { reactive, ReactiveFn, signal } from "signalium";
import type { NetworkModel } from "../model/networkModel";
import type { BaseServiceSpec, ServiceContext, ServiceHandler, ServiceHandlerMap } from "./types";
import { isDeepStrictEqual } from "node:util";

export type SocketMetaMap = Record<number, Record<string, string>>;

export const createServiceManagerFactory = <ServiceSpec extends BaseServiceSpec>(handlers: ServiceHandlerMap<ServiceSpec>) => {
  return (desiredSpecsSig: ReactiveFn<Promise<ServiceSpec[]>, []>) => {
    let latestSpecs: ServiceSpec[] = [];
    let socketMeta: SocketMetaMap = {};
    const lastOutputsByKey = signal(null as null | Record<string, any>);

    const processHandler = reactive(
      async (spec: ServiceSpec) => {
        const factory = handlers[spec.serviceType as ServiceSpec["type"]] as ServiceHandler<ServiceSpec, any>;
        return [spec.serviceKey, await factory(spec)];
      },
      { equals: isDeepStrictEqual },
    );

    const outputsByKey = reactive(
      async () => {
        const specs = await desiredSpecsSig();
        latestSpecs = specs;
        return Object.fromEntries(await Promise.all(specs.map(processHandler)));
      },
      {
        equals: isDeepStrictEqual,
      },
    );

    const buildSocketMeta = (model: NetworkModel): SocketMetaMap => {
      const meta: SocketMetaMap = {};
      for (const spec of latestSpecs) {
        if (spec.serviceType === "DhcpClient") {
          const ds = spec as any;
          const inode = model.namedNetns[ds.netns];
          if (inode !== undefined) {
            (meta[inode] ??= {})["udp4:0.0.0.0:68"] = ds.serviceKey;
          }
        }
      }
      return meta;
    };

    const applySocketMeta = (model: NetworkModel) => {
      socketMeta = buildSocketMeta(model);
      for (const inodeStr of Object.keys(socketMeta)) {
        const inode = Number(inodeStr);
        const ns = model.netnsById[inode];
        if (!ns) continue;
        const svcMap = socketMeta[inode];
        for (const sock of ns.listeningSockets) {
          const key = `${sock.protocol}:${sock.host}${sock.zone ? "%" + sock.zone : ""}:${sock.port}`;
          if (Object.hasOwn(svcMap, key)) {
            sock.serviceKey = svcMap[key];
          }
        }
      }
    };

    return {
      run: reactive(async () => {
        const outputs = await outputsByKey();
        setTimeout(() => {
          lastOutputsByKey.value = outputs;
        }, 0);
      }),
      context: {
        getServiceOutput<T>(serviceKey: string): T | null {
          const map = lastOutputsByKey.value;
          return map && Object.hasOwn(map, serviceKey) ? map[serviceKey] : null;
        },
      } satisfies ServiceContext,
      applySocketMeta,
    };
  };
};
