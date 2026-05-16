import { createNetnsWorker, NetnsWorker } from "./create";

export interface NetnsWorkerPool extends Disposable {
  getWorker(netns: string): Promise<NetnsWorker>;
  close(): void;
}

export const createNetnsWorkerPool = (): NetnsWorkerPool => {
  const workers = new Map<string, Promise<NetnsWorker>>();
  const getWorker = (netns: string): Promise<NetnsWorker> => {
    if (!netns) {
      throw new Error("Cannot get a worker for the default namespace");
    }
    let workerPromise = workers.get(netns);
    if (!workerPromise) {
      workerPromise = (async () => {
        const worker = await createNetnsWorker(netns);
        try {
          await worker.setupMount();
        } catch (error) {
          worker.close();
          throw error;
        }
        return worker;
      })();
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
