import { closeSync, mkdirSync, openSync, unlinkSync } from "node:fs";
import { constants } from "node:fs";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { getNetnsPath } from "../../netnsPath";

const [, , op, netns] = process.argv;

if (!netns) {
  process.stderr.write("netns argument required\n");
  process.exit(2);
}

const path = getNetnsPath(netns);

const fatal = (message: string): never => {
  process.stderr.write(`${message}\n`);
  process.exit(1);
};

if (op === "create") {
  // `unshare --net=<file>` bind-mounts onto an existing regular file, so we
  // create the parent directory and the empty file ourselves. Using O_EXCL
  // makes a duplicate create fail with EEXIST, matching `ip netns add`.
  mkdirSync(dirname(path), { recursive: true });
  try {
    closeSync(openSync(path, constants.O_CREAT | constants.O_EXCL | constants.O_RDONLY, 0o444));
  } catch (e: any) {
    fatal(`cannot create ${path}: ${e?.message ?? e}`);
  }
  const r = spawnSync("unshare", [`--net=${path}`, "--", "/bin/true"], { stdio: "inherit" });
  if (r.error || r.status !== 0) {
    try {
      unlinkSync(path);
    } catch {
      // best-effort cleanup
    }
    if (r.error) fatal(r.error.message);
    process.exit(r.status ?? 1);
  }
} else if (op === "delete") {
  const r = spawnSync("umount", [path], { stdio: "inherit" });
  if (r.error) fatal(r.error.message);
  if (r.status !== 0) process.exit(r.status);
  unlinkSync(path);
} else {
  fatal(`unknown op: ${op}`);
}
