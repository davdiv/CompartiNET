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
    const { state, errors } = await collectState();
    if (errors.length > 0) {
      console.error("State collection errors:", errors);
    }
    const { config, errors: configErrors } = modelToConfig(state);
    if (configErrors.length > 0) {
      console.error("Reconciliation errors:", configErrors);
    }

    if (values.format === "yaml") {
      console.log(yamlStringify(config));
    } else {
      console.log(JSON.stringify(config, null, 2));
    }
  } catch (error) {
    console.error("Collection failed:", error);
    process.exit(1);
  }
};
