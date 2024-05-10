import { DiscreteHourlyPredictor } from "./predict.ts";
import patchValues_ from "./values/patches.json" with { type: "json" };

const patchValues = patchValues_ as number[];
// const patchMaxValue = Math.max(...patchValues);
// const patchTestedValue = 272.0; // hard-coded to its own lab-tested estrogen levels
// const patchScale = patchTestedValue / patchMaxValue;
//
// console.debug(
//   "predictor: using",
//   patchTestedValue,
//   "as the baseline level for scaling a maximum of",
//   patchMaxValue,
//   "meaning we'll scale the values by",
//   patchScale,
// );

const patchScale = 1.0;

export const patchesPredictor = new DiscreteHourlyPredictor(
  patchValues,
  patchScale,
);
