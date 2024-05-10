export * from "./plot.ts";
export * from "./predict.ts";
export * from "./predictors.ts";
export * from "./statistics.ts";

import * as plot from "./plot.ts";
import { calculate } from "./statistics.ts";
import { patchesPredictor } from "./predictors.ts";
import { TimeValue } from "./predict.ts";
import { ValueStatistic } from "./statistics.ts";

declare global {
  interface Window {
    config: {
      Type: "patches" | string;
      IntervalHours: number;
      Concurrence: number;
    };
    dosageHistory: {
      HRTType: string;
      DosageAt: string;
    }[];
  }
}

async function main() {
  let values: TimeValue[];

  switch (window.config.Type) {
    case "patches": {
      const applicationTimes = window.dosageHistory
        .filter((dose) => dose.HRTType == "patches")
        .map((dose) => Date.parse(dose.DosageAt) / 1000);

      values = await patchesPredictor.predict(applicationTimes, {
        intervalHours: window.config.IntervalHours,
        concurrence: window.config.Concurrence,
        hoursAgo: 24 * 30, // 30 days or 1 month
      });
      break;
    }
    default: {
      console.log("not drawing chart due to unknown type", window.config.Type);
      return;
    }
  }

  const statsTable = querySelectorMust(document.body, "#dosage-stats");
  const timeStats: ({ name: string; forDays: number } & ValueStatistic)[] = [];

  querySelectorAll(statsTable, "[data-for-days]").forEach((td) => {
    const name = td.dataset.name;
    const forDays = parseInt(td.dataset.forDays);

    const quantiles = querySelectorAll(td, "span[data-quantile]")
      .map((span) => span.dataset.quantile)
      .map((quantile) => parseFloat(quantile) / 100);

    const stats = calculate(values, forDays, quantiles);
    timeStats.push({ name, forDays, ...stats });

    setElement(td, "span[data-value='mean']", stats.mean);
    setElement(td, "span[data-value='stddev']", stats.stdDev);
    for (const [q, value] of Object.entries(stats.quantiles)) {
      setElement(td, `span[data-value='quantile'][data-quantile='${parseFloat(q) * 100}']`, value);
    }
  });

  new plot.EstrogenLine("#history-line").update(values, {
    quantile: 0.95,
    bucketDays: (window.config.IntervalHours * window.config.Concurrence) / 24,
    onlyLastBucket: true,
  });

  // new plot.EstrogenCandlesticks(
  //   "#history-candlesticks",
  //   {
  //     quantile: 0.85,
  //     quantizeDays: (window.config.IntervalHours) / 24,
  //   },
  //   {
  //     timeScale: {
  //       minimumHeight: 50,
  //       tickMarkFormatter: () => " ",
  //     },
  //   },
  // ).update(values);

  const dosageDetails = document.getElementById("dosage-details");
  dosageDetails.style.display = "block";
}

function ftoa(value: number) {
  return value.toFixed(1);
}

function querySelectorAll(root: HTMLElement, selector: string): HTMLElement[] {
  return [...root.querySelectorAll(selector)]
    .filter((element) => element instanceof HTMLElement) as HTMLElement[];
}

function querySelectorMust(root: HTMLElement, selector: string): HTMLElement {
  const element = root.querySelector(selector);
  if (!element || !(element instanceof HTMLElement)) {
    console.error("Element not found", selector);
    alert("Cannot render completely. Check console.");
  }
  return element as HTMLElement;
}

function setElement(root: HTMLElement, selector: string, value: unknown) {
  const element = root.querySelector(selector);
  if (!element) {
    console.error("Element not found", selector);
    alert("Cannot render completely. Check console.");
    return;
  }
  let text = "";
  switch (typeof value) {
    case "string":
      text = value;
      break;
    case "number":
      text = ftoa(value);
      break;
    default:
      text = value.toString();
      break;
  }
  element.textContent = text;
}

await main();
