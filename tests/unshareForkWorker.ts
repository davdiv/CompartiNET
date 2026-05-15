import { execFileSync } from "node:child_process";

if (process.connected) {
  execFileSync("mount", ["-t", "sysfs", "/sys", "/sys"], { stdio: "inherit" });
  execFileSync("mount", ["--mkdir", "-t", "tmpfs", "netns", "/var/run/netns"], { stdio: "inherit" });
  await import(process.argv[2]);
}
