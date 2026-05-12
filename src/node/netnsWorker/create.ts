import { join } from "node:path";
import { getNetnsPrefix } from "../../common/model/commands";
import { spawn } from "node:child_process";
import { NetnsWorkerRequest, NetnsWorkerResponse, RequestId } from "./types";

export const createNetnsWorker = (netns: string) => {
  const args = [...getNetnsPrefix(netns), process.execPath, ...process.execArgv, join(import.meta.dirname, "netns-worker")];
  const child = spawn(args[0], args.slice(1), {
    stdio: ["inherit", "inherit", "inherit", "ipc"],
  });
  let curId = 0;
  const requests = new Map<number, { resolve: (r: any) => void; reject: (r: any) => void }>();
  child.on("disconnect", () => {
    for (const { reject } of requests.values()) {
      reject({ message: "Child process disconnected", code: "DISCONNECTED" });
    }
    requests.clear();
  });
  child.on("message", ({ requestId, ...response }: RequestId & NetnsWorkerResponse<any>, handler) => {
    const promise = requests.get(requestId);
    if (promise) {
      if (response.success) {
        promise.resolve(handler ?? response.result);
      } else {
        promise.reject(response.error);
      }
      requests.delete(requestId);
    }
  });
  const close = () => {
    child.disconnect();
  };
  return {
    async call<T>(request: NetnsWorkerRequest): Promise<T> {
      const requestId = curId++;
      await new Promise<void>((resolve, reject) =>
        child.send(
          {
            requestId,
            ...request,
          },
          (error) => (error ? reject(error) : resolve()),
        ),
      );
      return await new Promise((resolve, reject) => {
        requests.set(requestId, { resolve, reject });
      });
    },
    close,
    [Symbol.dispose]: close,
  };
};
