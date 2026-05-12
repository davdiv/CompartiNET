import { validate } from "../../../../common/model/validator";
import { collectState } from "../../../collectState";

export default async () => {
  try {
    const model = await collectState();
    console.log(JSON.stringify(model, null, 2));
    if (!validate(model)) {
      console.error("Error: current state failed validation:" + JSON.stringify(validate.errors));
      process.exit(2);
    }
  } catch (error) {
    console.error("Collection failed:", error);
    process.exit(1);
  }
};
