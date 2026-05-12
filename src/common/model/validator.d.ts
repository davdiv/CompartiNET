import type { NetworkModel } from "./networkModel";
export const validate: {
  (input: any): input is NetworkModel;
  errors: any;
};
