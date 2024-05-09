import { type TimeValue } from "./predict.ts";

// @deno-types="https://cdn.jsdelivr.net/npm/lightweight-charts@4.1.3/dist/typings.d.ts"
import * as charts from "https://cdn.jsdelivr.net/npm/lightweight-charts@4.1/dist/lightweight-charts.standalone.production.mjs";

const styles = globalThis.getComputedStyle(document.body);
const colors = {
  muted: styles.getPropertyValue("--b2"),
  primary: styles.getPropertyValue("--pink"),
};

export class EstrogenPlotter {
  chart: charts.IChartApi;
  series: charts.ISeriesApi<"Line", charts.Time>;

  constructor(
    readonly element: HTMLElement,
  ) {
    this.chart = charts.createChart(this.element, {
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
    });

    if (!this.chart.autoSizeActive()) {
      alert("Chart is not auto-sizing. It will not work right.");
    }

    this.series = this.chart.addLineSeries({
      color: colors.primary,
      priceFormat: {
        type: "custom",
        formatter: (price: charts.BarPrice) => price.toFixed(0) + " pg/mL",
      },
      baseLineVisible: false,
      priceLineVisible: true,
      pointMarkersVisible: false,
      crosshairMarkerVisible: false,
      autoscaleInfoProvider: (autoscale: () => charts.AutoscaleInfo) => {
        const scale = autoscale();
        if (scale != null) {
          scale.priceRange.minValue = 0;
          scale.priceRange.maxValue *= 1.1;
        }
        return scale;
      },
    });
  }

  update(values: TimeValue[]) {
    this.series.setData(
      values.map((t) => ({
        time: t.t as charts.UTCTimestamp,
        value: t.v,
      })),
    );
    console.log(values);
    this.chart.timeScale().fitContent();
  }
}
