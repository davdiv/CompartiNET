const commands = import.meta.glob<(args: string[]) => void | Promise<void>>("./commands/*.ts", { import: "default" });

const main = async () => {
  const [, , command, ...args] = process.argv;
  if (!command) {
    console.error(`Usage: compartinet <command> ...`);
    console.error(
      `Available commands:\n - ${Object.keys(commands)
        .map((key) => key.substring(11, key.length - 3))
        .join("\n - ")}`,
    );
    process.exit(1);
  }

  const loadHandler = commands[`./commands/${command}.ts`];
  if (!loadHandler) {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }
  const handler = await loadHandler();
  await handler(args);
};

await main();
export {};
