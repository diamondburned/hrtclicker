// Timestamp is the Unix time in seconds.
export type Timestamp = number;

// TimeValue is a pair of a timestamp and a value.
export type TimeValue = {
  t: Timestamp;
  v: number;
};

export type PredictOpts = {
  // intervalHours is the expected interval between applications in hours.
  intervalHours: number;
  // concurrence is the number of applications that are concurrently active; for
  // patches, this is the normal number of patches on the skin at any point in
  // time.
  concurrence: number;
  // hoursAgo is the number of hours ago to start predicting from.
  hoursAgo: number;
};

export interface Predictor {
  // predict predicts the estrogen levels over time for the given application
  // times.
  predict(applicationTimes: Timestamp[], opts: PredictOpts): Promise<TimeValue[]>;
}

const HOUR = 3600;

// DiscreteHourlyPredictor is a Predictor that predicts the levels using a
// discrete list of values. It specifically only supports hourly values and will
// return hourly values.
export class DiscreteHourlyPredictor implements Predictor {
  f: (t: number) => number;
  f_0: number; // start hour
  f_1: number; // end hour

  constructor(
    hourlyValues: number[],
    scale: number,
  ) {
    this.f = (t: number) => (hourlyValues[t] ?? 0) * scale;
    this.f_0 = 0;
    this.f_1 = hourlyValues.length;
  }

  predict(applicationTimes: Timestamp[], opts: PredictOpts): Promise<TimeValue[]> {
    if (applicationTimes.length === 0) {
      return Promise.resolve([]);
    }
    applicationTimes.sort((a, b) => a - b);

    const f_0 = this.f_0;
    const f_1 = this.f_1;
    // f_1short specifically is the f_1 value but limited to the concurrence
    // value. This value will only be used for patches older than the last few
    // current patches.
    const f_1short = opts.concurrence > 0
      ? Math.min(this.f_1, opts.intervalHours * opts.concurrence)
      : this.f_1;
    console.debug(`predictor:`, { f_0, f_1, f_1short });

    const now = Date.now() / 1000;
    const prior = now - opts.hoursAgo * HOUR;
    console.debug(
      `predictor: from`,
      new Date(prior * 1000).toISOString(),
      `to`,
      new Date(now * 1000).toISOString(),
    );

    const hours = Math.ceil((now - prior) / HOUR);
    console.debug(`predictor: hours`, hours);

    const values = Array<number>(hours).fill(0);
    console.debug("values", values);

    for (const [i, t] of applicationTimes.entries()) {
      // Calculate the hourly index for the current application time by
      // subtracting it with the first time and rounding it.
      let hourStart = Math.floor((t - prior) / HOUR) + f_0;
      let hourEnd = hourStart + (
        // If the patch index is near the end, then we should use f_1, else we
        // use f_1short.
        applicationTimes.length - i <= opts.concurrence ? f_1 : f_1short
      );
      console.debug("for", t, "going from", hourStart, "to", hourEnd, "of", values.length, "hours");

      if (hourEnd < 0) {
        // The entire interval is before the start of the prediction
        // period, so we ignore it.
        continue;
      }

      let fOffset = 0;
      if (hourStart < 0) {
        fOffset = -hourStart;
        hourStart = 0;
        hourEnd = Math.min(values.length, hourEnd - hourStart);
      }
      hourStart = Math.max(0, hourStart);
      hourEnd = Math.min(values.length, hourEnd);

      console.debug("for", t, "total hours taken is", hourEnd - hourStart);
      for (let h = hourStart; h < hourEnd; h++) {
        values[h] += this.f(h - hourStart + fOffset);
      }
    }

    console.debug("values", values);

    const timeValues = values.map((value, i) => ({ t: prior + (i * HOUR), v: value }));
    return Promise.resolve(timeValues);
  }
}
