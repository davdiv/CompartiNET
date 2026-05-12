import type { Config } from "./index";
export const validate: {
  (input: any): input is Config;
  errors: any;
};
