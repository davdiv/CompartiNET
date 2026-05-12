import { parseArgs } from "node:util";
import { stringify as yamlStringify } from "yaml";
import { modelToConfig } from "../../../../common/reconcile/modelToConfig";
import { collectState } from "../../../collectState";

export default async (args: string[]) => {
  const { values } = parseArgs({
    args,
    options: {
      format: { type: "string", default: "json" },
    },
  });

  try {
    const model = await collectState();
    // TODO: validate model ?
    const actions = modelToConfig(model);
    // TODO: validate actions ?

    if (values.format === "yaml") {
      console.log(yamlStringify(actions));
    } else {
      console.log(JSON.stringify(actions, null, 2));
    }
  } catch (error) {
    console.error("Collection failed:", error);
    process.exit(1);
  }
};
