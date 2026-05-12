import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const isSdNotifyAvailable = () => !!process.env.NOTIFY_SOCKET;

export const sdNotifyReady = async () => {
  if (!isSdNotifyAvailable()) return;
  try {
    await execFileAsync("systemd-notify", ["--ready"]);
  } catch (error) {
    console.warn("Error in sdNotifyReady", error);
  }
};

export const sdNotifyStatus = async (status: string) => {
  if (!isSdNotifyAvailable()) return;
  try {
    await execFileAsync("systemd-notify", [`--status=${status}`]);
  } catch (error) {
    console.warn("Error in sdNotifyStatus", error);
  }
};
