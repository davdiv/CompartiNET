export interface TempFileArg {
  type: "tempFile";
  content: string;
}

export interface DefaultNetnsArg {
  type: "defaultNetns";
}

export type CommandArg = string | TempFileArg | DefaultNetnsArg;

export interface Command {
  netns: string;
  args: CommandArg[];
}

export const getNetnsTarget = (netns: string): CommandArg => netns || { type: "defaultNetns" };

const formatArg = (a: CommandArg): string => {
  if (typeof a === "string") return a;
  if (a.type === "defaultNetns") return "/proc/$$/ns/net";
  const content = a.content.replace(/'/g, "'\\''");
  return `<(printf '%s' '${content}')`;
};

/**
 * Formats a command into a human-readable string for testing.
 * TempFileArg objects are rendered as bash process substitution syntax.
 * A non-default netns is rendered as a leading `[NS]` token.
 */
export const formatCommand = ({ netns, args }: Command): string => {
  const formattedArgs = args.map(formatArg).join(" ");
  return netns ? `[${netns}] ${formattedArgs}` : formattedArgs;
};
