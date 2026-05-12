export interface TempFileArg {
  type: "tempFile";
  content: string;
}

export interface ProcessPidArg {
  type: "processPid";
}

export type CommandArg = string | TempFileArg | ProcessPidArg;
export type Command = CommandArg[];
export type Commands = Command[];

export const getNetnsPrefix = (netns: string): string[] => (netns ? ["ip", "netns", "exec", netns] : []);
export const getNetnsTarget = (netns: string): CommandArg[] => [netns || { type: "processPid" }];

/**
 * Formats a command array into a human-readable string for testing.
 * TempFileArg objects are rendered as bash process substitution syntax.
 */
export const formatCommand = (cmd: CommandArg[]): string =>
  cmd
    .map((a) => {
      if (typeof a === "string") return a;
      if (a.type === "processPid") return "$$";
      // Escape single quotes in content for shell safety
      const content = a.content.replace(/'/g, "'\\''");
      return `<(printf '%s' '${content}')`;
    })
    .join(" ");
