import { spawn, type ChildProcess } from "node:child_process";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Readable } from "node:stream";
import type { CommandArg, Commands } from "../common/model/commands";

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
  return stdout;
};

export const execOutJson = async (...args: Parameters<typeof exec>) => {
  const output = (await exec(...args)).toString("utf8");
  if (!output) {
    return undefined;
  }
  try {
    return JSON.parse(output);
  } catch (cause) {
    throw new Error(`Failed to parse JSON output from ${args[0].join(" ")}\nOutput: ${output}`, {
      cause,
    });
  }
};

export const runCommand = async (args: CommandArg[]): Promise<Buffer> => {
  let tempFolder: string | undefined;
  try {
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
      } else if (arg.type === "processPid") {
        resolvedArgs.push(`${process.pid}`);
      }
    }
    return await exec(resolvedArgs);
  } finally {
    if (tempFolder) {
      try {
        await rm(tempFolder, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
  }
};

export const runCommands = async (commands: Commands) => {
  for (const cmd of commands) {
    await runCommand(cmd);
  }
};
