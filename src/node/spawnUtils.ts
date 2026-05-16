import { spawn, type ChildProcess } from "node:child_process";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Readable } from "node:stream";
import type { Command, CommandArg } from "../common/model/commands";
import { setupWorkerWithSysMount } from "./netnsWorker/create";
import type { NetnsWorkerPool } from "./netnsWorker/pool";

export const waitForProcess = (child: ChildProcess, stderrBuffer: Buffer) =>
  new Promise<void>((resolve, reject) => {
    child.on("close", (code, signal) => {
      const result = signal != null ? `signal ${signal}` : code != 0 ? `code ${code}` : null;
      if (result) {
        const stderr = stderrBuffer.toString("utf8").trim();
        reject(new Error(`Process exited with ${result}${stderr ? `\nStderr: ${stderr}` : ""}`));
      } else {
        resolve();
      }
    });
  });

export const collectOutput = (readable: Readable) =>
  new Promise<Buffer>((resolve, reject) => {
    const allData: Buffer[] = [];
    readable.on("data", (data: Buffer) => allData.push(data));
    readable.on("end", () => resolve(Buffer.concat(allData)));
    readable.on("error", reject);
  });

export const exec = async (args: string[], { stdIn }: { stdIn?: Buffer | string } = {}): Promise<Buffer> => {
  const child = spawn(args[0], args.slice(1), {
    stdio: [stdIn ? "pipe" : "ignore", "pipe", "pipe"],
  });
  if (stdIn) {
    child.stdin!.end(stdIn);
  }
  const stdout = collectOutput(child.stdout!);
  const stderr = collectOutput(child.stderr!);
  const stderrBuffer = await stderr;
  await waitForProcess(child, stderrBuffer);
  return await stdout;
};

const resolveArgs = async (args: CommandArg[]): Promise<{ resolvedArgs: string[]; cleanup: () => Promise<void> }> => {
  let tempFolder: string | undefined;
  const resolvedArgs: string[] = [];
  for (const arg of args) {
    if (typeof arg === "string") {
      resolvedArgs.push(arg);
    } else if (arg.type === "tempFile") {
      if (!tempFolder) {
        tempFolder = await mkdtemp(join(tmpdir(), "cn-"));
        await chmod(tempFolder, 0o600);
      }
      const tmpPath = join(tempFolder, `file${resolvedArgs.length}`);
      await writeFile(tmpPath, arg.content, { mode: 0o600 });
      resolvedArgs.push(tmpPath);
    } else if (arg.type === "defaultNetns") {
      resolvedArgs.push(`/proc/${process.pid}/ns/net`);
    } else if (arg.type === "netnsHelper") {
      resolvedArgs.push(process.execPath, ...process.execArgv, join(import.meta.dirname, "manage-netns"));
    }
  }
  const cleanup = async () => {
    if (tempFolder) {
      try {
        await rm(tempFolder, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
  };
  return { resolvedArgs, cleanup };
};

export const runCommand = async ({ netns, args }: Command, pool?: NetnsWorkerPool): Promise<Buffer> => {
  const { resolvedArgs, cleanup } = await resolveArgs(args);
  try {
    if (!netns) {
      return await exec(resolvedArgs);
    }
    if (pool) {
      const worker = await pool.getWorker(netns);
      return await worker.call<Buffer>({ type: "exec", args: resolvedArgs });
    }
    using worker = await setupWorkerWithSysMount(netns);
    return await worker.call<Buffer>({ type: "exec", args: resolvedArgs });
  } finally {
    await cleanup();
  }
};
