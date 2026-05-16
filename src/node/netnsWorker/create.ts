import { spawn } from "node:child_process";
import { join } from "node:path";
import { getNetnsPath } from "../netnsPath";
import { NetnsWorkerRequest, NetnsWorkerResponse, RequestId } from "./types";

export interface NetnsWorker extends Disposable {
  call<T>(request: NetnsWorkerRequest): Promise<T>;
  close: () => void;
  setupMount: () => Promise<void>;
}

export const createNetnsWorker = async (netns: string): Promise<NetnsWorker> => {
  const args = ["nsenter", `--net=${getNetnsPath(netns)}`, "unshare", "-m", process.execPath, ...process.execArgv, join(import.meta.dirname, "netns-worker")];
  const child = spawn(args[0], args.slice(1), {
    stdio: ["inherit", "pipe", "pipe", "ipc"],
    serialization: "advanced",
  });
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  child.stdout!.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
  child.stderr!.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
  const collectedOutput = () => {
    const parts: string[] = [];
    const stdout = Buffer.concat(stdoutChunks).toString("utf-8").trim();
    const stderr = Buffer.concat(stderrChunks).toString("utf-8").trim();
    if (stdout) parts.push(`Stdout: ${stdout}`);
    if (stderr) parts.push(`Stderr: ${stderr}`);
    return parts.length > 0 ? `\n${parts.join("\n")}` : "";
  };
  let curId = 0;
  const requests = new Map<number, { resolve: (r: any) => void; reject: (r: any) => void }>();
  const initPromise = new Promise((resolve, reject) => requests.set(0, { resolve, reject }));
  const rejectAllRequests = (error: any) => {
    for (const { reject } of requests.values()) {
      reject(error);
    }
    requests.clear();
  };
  child.on("error", (error) => {
    rejectAllRequests(new Error(`Child process error: ${error.message}${collectedOutput()}`));
  });
  child.on("disconnect", () => {
    rejectAllRequests(new Error(`Child process disconnected${collectedOutput()}`));
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
  const call = async <T>(request: NetnsWorkerRequest): Promise<T> => {
    if (!child.connected) {
      throw new Error("Child process disconnected");
    }
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
  };
  let setupMountPromise: Promise<void> | undefined;
  const setupMount = () => {
    if (!setupMountPromise) {
      setupMountPromise = call({ type: "exec", args: ["mount", "-t", "sysfs", "/sys", "/sys"] });
    }
    return setupMountPromise;
  };
  await initPromise;
  return {
    setupMount,
    call,
    close,
    [Symbol.dispose]: close,
  };
};
