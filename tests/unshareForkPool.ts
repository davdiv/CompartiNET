import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import type { Writable } from "node:stream";
import { ForksPoolWorker, PoolRunnerInitializer, WorkerRequest, type PoolOptions } from "vitest/node";

// adapted from https://github.com/vitest-dev/vitest/blob/f79e7db90649e60d59e86bc61376db494c06ae97/packages/vitest/src/node/pools/workers/forksWorker.ts

const SIGKILL_TIMEOUT = 500;

export class UnshareForkPool extends ForksPoolWorker {
  private _fork2!: ChildProcess;
  private _stdout2: NodeJS.WriteStream | Writable;
  private _stderr2: NodeJS.WriteStream | Writable;

  constructor(options: PoolOptions) {
    super(options);
    this._stdout2 = options.project.vitest.logger.outputStream;
    this._stderr2 = options.project.vitest.logger.errorStream;
  }

  on(event: string, callback: (arg: any) => void): void {
    this._fork2.on(event, callback);
  }

  off(event: string, callback: (arg: any) => void): void {
    this._fork2.off(event, callback);
  }

  send(message: WorkerRequest): void {
    this._fork2.send(message);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async start(): Promise<void> {
    this._fork2 ||= spawn("unshare", ["-n", "-m", process.execPath, ...this.execArgv, join(import.meta.dirname, "unshareForkWorker.ts"), this.entrypoint], {
      env: this.env,
      stdio: ["pipe", "pipe", "pipe", "ipc"],
      serialization: "advanced",
    });

    if (this._fork2.stdout) {
      this._stdout2.setMaxListeners(1 + this._stdout2.getMaxListeners());
      this._fork2.stdout.pipe(this._stdout2);
    }

    if (this._fork2.stderr) {
      this._stderr2.setMaxListeners(1 + this._stderr2.getMaxListeners());
      this._fork2.stderr.pipe(this._stderr2);
    }
  }

  async stop(): Promise<void> {
    const fork = this._fork2;
    const waitForExit = new Promise<void>((resolve) => {
      if (fork.exitCode != null) {
        resolve();
      } else {
        fork.once("exit", resolve);
      }
    });

    /*
     * If process running user's code does not stop on SIGTERM, send SIGKILL.
     * This is similar to
     * - https://github.com/jestjs/jest/blob/25a8785584c9d54a05887001ee7f498d489a5441/packages/jest-worker/src/workers/ChildProcessWorker.ts#L463-L477
     * - https://github.com/tinylibs/tinypool/blob/40b4b3eb926dabfbfd3d0a7e3d1222d4dd1c0d2d/src/runtime/process-worker.ts#L56
     */
    const sigkillTimeout = setTimeout(() => fork.kill("SIGKILL"), SIGKILL_TIMEOUT);

    fork.kill();
    await waitForExit;
    clearTimeout(sigkillTimeout);

    if (fork.stdout) {
      fork.stdout?.unpipe(this._stdout2);
      this._stdout2.setMaxListeners(this._stdout2.getMaxListeners() - 1);
    }

    if (fork.stderr) {
      fork.stderr?.unpipe(this._stderr2);
      this._stderr2.setMaxListeners(this._stderr2.getMaxListeners() - 1);
    }

    this._fork2 = undefined!;
  }
}

export const unshareForkPool = (): PoolRunnerInitializer => ({
  name: "unshare-fork-pool",
  createPoolWorker: (options) => new UnshareForkPool(options),
});
