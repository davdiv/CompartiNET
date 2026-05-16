import { join } from "node:path";

export const namedNetnsPath = "/var/run/netns";

export const getNetnsPath = (id: string) => {
  if (id === "") {
    return `/proc/${process.pid}/ns/net`;
  } else if (id.startsWith("/")) {
    return id;
  } else {
    return join(namedNetnsPath, id);
  }
};
