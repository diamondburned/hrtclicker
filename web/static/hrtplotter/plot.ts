import { type TimeValue } from "./predict.ts";
import * as statistics from "./statistics.ts";

// @deno-types="https://cdn.jsdelivr.net/npm/lightweight-charts@4.1.3/dist/typings.d.ts"
import * as charts from "https://cdn.jsdelivr.net/npm/lightweight-charts@4.1/dist/lightweight-charts.standalone.production.mjs";

export type UTCTimestamp = charts.UTCTimestamp;
export type ChartOptions = charts.DeepPartial<charts.ChartOptions>;

const styles = globalThis.getComputedStyle(document.body);

export const colors = {
  muted: styles.getPropertyValue("--b2"),
  pink: styles.getPropertyValue("--pink"),
  blue: styles.getPropertyValue("--blue"),
  pinkText: styles.getPropertyValue("--pink-text"),
  blueText: styles.getPropertyValue("--blue-text"),
};

const defaultChartOptions: ChartOptions = {
  autoSize: true,
  handleScale: false,
  handleScroll: false,
  grid: {
    vertLines: { visible: false },
    horzLines: { visible: true, color: colors.muted },
  },
  layout: {
    background: { type: charts.ColorType.Solid, color: "transparent" },
    textColor: styles.color,
    fontFamily: styles.fontFamily,
  },
  rightPriceScale: {
    scaleMargins: {
      top: 0,
      bottom: 0,
    },
  },
  timeScale: {
    lockVisibleTimeRangeOnResize: true,
    borderVisible: false,
    timeVisible: true,
    secondsVisible: false,
    fixLeftEdge: true,
    fixRightEdge: true,
  },
};

const defaultSeriesOptions: Partial<charts.SeriesOptionsCommon> = {
  baseLineVisible: false,
  priceLineVisible: false,
  autoscaleInfoProvider: (autoscale: () => charts.AutoscaleInfo) => {
    const scale = autoscale();
    if (scale != null) {
      scale.priceRange.minValue = 0;
      scale.priceRange.maxValue *= 1.1;
    }
    return scale;
  },
};

function newChart(element: string | HTMLElement, options: ChartOptions) {
  return charts.createChart(getHTMLElement(element), {
    ...defaultChartOptions,
    ...options,
  });
}

export type CandlestickPlotOptions = {
  // quantile is the value of the quantile to calculate from the values.
  quantile: number;
  // quantizeDays is the number of days to average the values over.
  // For each block of quantizeDays days, the quantile is calculated.
  quantizeDays: number;
};

export class EstrogenLine {
  static numericalKeys = ["mean", "open", "close"] as const;

  chart: charts.IChartApi;
  lineSeries: charts.ISeriesApi<"Line", charts.Time>;
  numericalSeries: Record<
    typeof EstrogenLine.numericalKeys[number],
    charts.ISeriesApi<"Line", charts.Time>
  >;

  constructor(
    element: string | HTMLElement,
    options: ChartOptions = {},
  ) {
    this.chart = newChart(element, options);

    this.numericalSeries = {} as typeof this.numericalSeries;
    EstrogenLine.numericalKeys.forEach((key) => {
      this.numericalSeries[key] = this.chart.addLineSeries({
        ...defaultSeriesOptions,
        color: colors.pinkText,
        lineType: charts.LineType.Curved,
        lineWidth: 1,
        lineStyle: charts.LineStyle.Dashed,
        priceFormat: {
          type: "custom",
          formatter: (price: charts.BarPrice) => price.toFixed(0) + " pg/mL",
        },
      });
    });

    this.lineSeries = this.chart.addLineSeries({
      ...defaultSeriesOptions,
      color: colors.pink,
      lineType: charts.LineType.Curved,
      pointMarkersVisible: false,
      crosshairMarkerVisible: false,
      priceFormat: {
        type: "custom",
        formatter: (price: charts.BarPrice) => price.toFixed(0) + " pg/mL",
      },
    });
  }

  update(values: TimeValue[], options: {
    quantile?: number;
    bucketDays?: number;
    onlyLastBucket?: boolean;
  } = {}) {
    this.lineSeries.setData(
      values.map((t) => ({
        time: t.t as charts.UTCTimestamp,
        value: t.v,
      })),
    );

    if (options.quantile && options.bucketDays) {
      const { quantile, bucketDays } = options;
      const bucketHours = bucketDays * 24;

      let data: charts.CandlestickData<charts.Time>[] = Array.from(
        { length: Math.ceil(values.length / bucketHours) },
        (_, i) => {
          const a = i * bucketHours;
          const b = Math.min((i + 1) * bucketHours, values.length);
          const v = values.slice(a, b).map((t) => t.v);

          const qhi = statistics.quartile(v, quantile);
          const qlo = statistics.quartile(v, 1 - quantile);
          const min = Math.min(...v);
          const max = Math.max(...v);

          return {
            time: values[b - 1].t as charts.UTCTimestamp,
            color: colors.blue,
            wickColor: colors.blue,
            borderColor: colors.blue,
            open: qlo,
            close: qhi,
            high: max,
            low: min,
          };
        },
      );

      if (options.onlyLastBucket) {
        data = [
          { ...data[data.length - 1], time: data[data.length - 2].time },
          { ...data[data.length - 1] },
        ];
      }

      const mapData = (mapValue: (_: charts.CandlestickData<charts.Time>) => number) =>
        data.map((data) => ({
          time: data.time,
          value: mapValue(data),
        }));

      this.numericalSeries.mean.setData(mapData((d) => (d.open + d.close) / 2));
      this.numericalSeries.open.setData(mapData((d) => d.open));
      this.numericalSeries.close.setData(mapData((d) => d.close));
    } else {
      Object.values(this.numericalSeries).forEach((series) => series.setData([]));
    }

    this.chart.timeScale().fitContent();
  }
}

export class EstrogenCandlesticks {
  chart: charts.IChartApi;

  candlestickSeries: charts.ISeriesApi<"Candlestick", charts.Time>;
  numericalSeries: {
    mean: charts.ISeriesApi<"Line", charts.Time>;
    open: charts.ISeriesApi<"Line", charts.Time>;
    close: charts.ISeriesApi<"Line", charts.Time>;
  };

  constructor(
    element: string | HTMLElement,
    readonly candlestickOpts: CandlestickPlotOptions,
    chartOptions: ChartOptions = {},
  ) {
    this.chart = newChart(element, chartOptions);

    this.candlestickSeries = this.chart.addCandlestickSeries({
      ...defaultSeriesOptions,
      priceFormat: {
        type: "custom",
        formatter: (price: charts.BarPrice) => price.toFixed(0) + " pg/mL",
      },
    });

    const numericalSeriesOptions = {
      ...defaultSeriesOptions,
      color: colors.blue,
    };
    this.numericalSeries = {
      mean: this.chart.addLineSeries(numericalSeriesOptions),
      open: this.chart.addLineSeries(numericalSeriesOptions),
      close: this.chart.addLineSeries(numericalSeriesOptions),
    };
  }

  update(values: TimeValue[]) {
    const { quantile, quantizeDays } = this.candlestickOpts;
    const quantizeHours = quantizeDays * 24;

    const data = Array.from(
      { length: Math.ceil(values.length / quantizeHours) },
      (_, i) => {
        const a = i * quantizeHours;
        const b = Math.min((i + 1) * quantizeHours, values.length);
        const o = (b - a) / 2;
        const v = values.slice(a, b).map((t) => t.v);

        const qhi = statistics.quartile(v, quantile);
        const qlo = statistics.quartile(v, 1 - quantile);
        const min = Math.min(...v);
        const max = Math.max(...v);

        return {
          time: values[a + o].t as charts.UTCTimestamp,
          color: colors.blue,
          wickColor: colors.blue,
          borderColor: colors.blue,
          open: qlo,
          close: qhi,
          high: max,
          low: min,
        };
      },
    );

    this.candlestickSeries.setData(data);
    this.numericalSeries.mean.setData(
      data.map((d) => ({ time: d.time, value: (d.open + d.close) / 2 })),
    );
    this.chart.timeScale().fitContent();
  }
}

function getHTMLElement(selectorOrElement: string | HTMLElement): HTMLElement {
  if (typeof selectorOrElement === "string") {
    const element = document.querySelector(selectorOrElement);
    if (!element) {
      throw new Error(`Element not found: ${selectorOrElement}`);
    }
    return element as HTMLElement;
  }
  return selectorOrElement;
}
