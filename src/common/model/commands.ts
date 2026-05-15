export interface TempFileArg {
  type: "tempFile";
  content: string;
}

export interface DefaultNetnsArg {
  type: "defaultNetns";
}

export type CommandArg = string | TempFileArg | DefaultNetnsArg;
export type Command = CommandArg[];

export const getNetnsPrefix = (netns: string): string[] => (netns ? ["ip", "netns", "exec", netns] : []);
export const getIpNetnsPrefix = (netns: string) => (netns ? ["ip", "-n", netns] : ["ip"]);
export const getBridgeNetnsPrefix = (netns: string) => (netns ? ["bridge", "-n", netns] : ["bridge"]);
export const getNetnsTarget = (netns: string): CommandArg => netns || { type: "defaultNetns" };

/**
 * Formats a command array into a human-readable string for testing.
 * TempFileArg objects are rendered as bash process substitution syntax.
 */
export const formatCommand = (cmd: CommandArg[]): string =>
  cmd
    .map((a) => {
      if (typeof a === "string") return a;
      if (a.type === "defaultNetns") return "/proc/$$/ns/net";
      // Escape single quotes in content for shell safety
      const content = a.content.replace(/'/g, "'\\''");
      return `<(printf '%s' '${content}')`;
    })
    .join(" ");
