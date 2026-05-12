import { wakeOnLan } from "../../../wakeOnLan";

export default async (args: string[]) => {
  await wakeOnLan(args[0], args[1], args[2]);
};
