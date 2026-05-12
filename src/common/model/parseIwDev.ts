export const parseIwDev = (output: string | undefined): Record<string, string> => {
  const wireless: Record<string, string> = {};
  if (!output) {
    return wireless;
  }
  let currentPhy: string | undefined;
  for (const line of output.split("\n")) {
    const phyMatch = line.match(/^phy#(\d+)/);
    if (phyMatch) {
      currentPhy = `phy${phyMatch[1]}`;
    }
    const ifaceMatch = line.match(/^\s+Interface\s+(\S+)/);
    if (ifaceMatch && currentPhy) {
      wireless[ifaceMatch[1]] = currentPhy;
    }
  }
  return wireless;
};
