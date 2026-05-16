import { NetnsWorker, setupWorkerWithSysMount } from "./create";

export interface NetnsWorkerPool extends Disposable {
  getWorker(netns: string): Promise<NetnsWorker>;
  close(): void;
}

export const createNetnsWorkerPool = (): NetnsWorkerPool => {
  const workers = new Map<string, Promise<NetnsWorker>>();
  const getWorker = (netns: string): Promise<NetnsWorker> => {
    let workerPromise = workers.get(netns);
    if (!workerPromise) {
      workerPromise = setupWorkerWithSysMount(netns);
      workers.set(netns, workerPromise);
    }
    return workerPromise;
  };
  const close = () => {
    for (const workerPromise of workers.values()) {
      workerPromise.then(
        (worker) => worker.close(),
        () => {},
      );
    }
    workers.clear();
  };
  return {
    getWorker,
    close,
    [Symbol.dispose]: close,
  };
};
