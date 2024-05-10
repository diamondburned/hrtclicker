import * as statistics from "https://cdn.jsdelivr.net/gh/avalero/jsr-maths-statistics@master/mod.ts";
export * from "https://cdn.jsdelivr.net/gh/avalero/jsr-maths-statistics@master/mod.ts";

import { type TimeValue } from "./predict.ts";

export type CalculateData = {
  values: TimeValue[];
  forDays: readonly number[];
  quantiles: readonly number[];
};

export type ValueStatistic<QuantilesT extends readonly number[] = []> = {
  mean: number;
  stdDev: number;
  quantiles: Record<QuantilesT[number], number>;
};

export function calculate<
  QuantilesT extends readonly number[],
  ResultT extends ValueStatistic<QuantilesT>,
>(
  values: TimeValue[],
  days: number,
  quantiles: QuantilesT,
): ResultT {
  const averageHours = days * 24;
  const hoursValues = values.slice(-averageHours).map((v) => v.v);
  return {
    mean: statistics.average(hoursValues),
    stdDev: statistics.stdDev(hoursValues),
    quantiles: quantiles.reduce((quantiles, q) => {
      return {
        ...quantiles,
        [q]: statistics.quartile(hoursValues, q),
      };
    }, {}),
  } as ResultT;
}
