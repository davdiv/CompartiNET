import { validate } from "../../../../common/model/validator";
import { collectState } from "../../../collectState";

export default async () => {
  try {
    const { state, errors } = await collectState();
    if (errors.length > 0) {
      console.error("State collection errors:", errors);
    }
    console.log(JSON.stringify(state, null, 2));
    if (!validate(state)) {
      console.error("Error: current state failed validation:" + JSON.stringify(validate.errors));
      process.exit(2);
    }
  } catch (error) {
    console.error("Collection failed:", error);
    process.exit(1);
  }
};
