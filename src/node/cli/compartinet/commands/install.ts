import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";

const systemdService = () =>
  `[Unit]
Description=CompartiNET network manager service
After=network-pre.target
Before=network.target
Wants=network.target

[Service]
Type=notify
ExecStart="${join(import.meta.dirname, "compartinet-manager")}"
Restart=always
WatchdogSec=60
PrivateMounts=true
ProtectSystem=strict
ConfigurationDirectory=compartinet
ConfigurationDirectoryMode=0700
RuntimeDirectory=compartinet
RuntimeDirectoryMode=0700
StateDirectory=compartinet
StateDirectoryMode=0700
PrivateTmp=disconnected

[Install]
WantedBy=multi-user.target
`;

export default async (args: string[]) => {
  const {
    values: { "systemd-unit-path": systemdUnitPath },
  } = parseArgs({
    args,
    options: {
      "systemd-unit-path": {
        type: "string",
        default: "/usr/local/lib/systemd/system/compartinet.service",
      },
    },
  });

  await mkdir(dirname(systemdUnitPath), { recursive: true });
  await writeFile(systemdUnitPath, systemdService());
  // TODO: make the config directory configurable ?
  await mkdir("/etc/compartinet/config.d", { recursive: true });
};
