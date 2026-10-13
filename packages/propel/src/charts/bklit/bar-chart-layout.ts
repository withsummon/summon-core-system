import type { scaleLinear } from "@visx/scale";
import { topSquareCenterY } from "./bar-squares-layout";
import type { LineConfig } from "./chart-context";
import { normalizeYAxisId } from "./y-axis-scales";

type Datum = Record<string, unknown>;
type ScaleLinear = ReturnType<typeof scaleLinear<number>>;

/** Largest bar, or largest stack when `stacked`; 100 when there is no positive value. */
export function computeBarMaxValue(data: Datum[], lines: LineConfig[], stacked: boolean): number {
  if (stacked) {
    // For stacked bars, sum all values at each data point
    let max = 0;
    for (const d of data) {
      let sum = 0;
      for (const line of lines) {
        const value = d[line.dataKey];
        if (typeof value === "number") {
          sum += value;
        }
      }
      if (sum > max) {
        max = sum;
      }
    }
    return max || 100;
  }
  return maxValueForKeys(
    data,
    lines.map((line) => line.dataKey)
  );
}

/** Largest numeric value across `dataKeys`; 100 when there is none. */
export function maxValueForKeys(data: Datum[], dataKeys: string[]): number {
  let max = 0;
  for (const d of data) {
    for (const key of dataKeys) {
      const value = d[key];
      if (typeof value === "number" && value > max) {
        max = value;
      }
    }
  }
  return max || 100;
}

/** Running stack base per data index and series key. */
export function computeBarStackOffsets(data: Datum[], lines: LineConfig[]): Map<number, Map<string, number>> {
  const offsets = new Map<number, Map<string, number>>();
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    if (!d) {
      continue;
    }
    const pointOffsets = new Map<string, number>();
    let cumulative = 0;
    for (const line of lines) {
      pointOffsets.set(line.dataKey, cumulative);
      const value = d[line.dataKey];
      if (typeof value === "number") {
        cumulative += value;
      }
    }
    offsets.set(i, pointOffsets);
  }
  return offsets;
}

/**
 * Where the tooltip dots sit for one hovered category: bar ends for horizontal bars, bar tops
 * (or the top square when snapping) for vertical ones. The tooltip anchors at the longest bar's
 * end when horizontal and at the band center otherwise.
 */
export function computeBarTooltipPositions({
  d,
  lines,
  barPos,
  bandWidth,
  innerHeight,
  isHorizontal,
  stacked,
  stackGap,
  squareSnap,
  yScales,
  valueScale,
  primaryYScale,
}: {
  d: Datum;
  lines: LineConfig[];
  barPos: number;
  bandWidth: number;
  innerHeight: number;
  isHorizontal: boolean;
  stacked: boolean;
  stackGap: number;
  squareSnap?: { squareGap: number; groupGap?: number; fit?: boolean };
  yScales: Record<string, ScaleLinear>;
  valueScale: ScaleLinear;
  primaryYScale: ScaleLinear;
}) {
  const yPositions: Record<string, number> = {};
  const xPositions: Record<string, number> = {};

  if (isHorizontal) {
    // Horizontal bars: dots at end of bar (x = value), centered vertically in band
    const seriesCount = lines.length;
    const groupGap = seriesCount > 1 ? 4 : 0;
    const individualBarHeight = seriesCount > 0 ? (bandWidth - groupGap * (seriesCount - 1)) / seriesCount : bandWidth;

    if (stacked) {
      // Stacked horizontal: all bars same y, x at cumulative end
      let cumulative = 0;
      for (const line of lines) {
        const value = d[line.dataKey];
        if (typeof value === "number") {
          cumulative += value;
          const axisScale = yScales[normalizeYAxisId(line.yAxisId)] ?? valueScale;
          xPositions[line.dataKey] = axisScale(cumulative) ?? 0;
          yPositions[line.dataKey] = barPos + bandWidth / 2;
        }
      }
    } else {
      // Grouped horizontal: each bar at its own y position
      lines.forEach((line, idx) => {
        const value = d[line.dataKey];
        if (typeof value === "number") {
          const axisScale = yScales[normalizeYAxisId(line.yAxisId)] ?? valueScale;
          xPositions[line.dataKey] = axisScale(value) ?? 0;
          yPositions[line.dataKey] = barPos + idx * (individualBarHeight + groupGap) + individualBarHeight / 2;
        }
      });
    }
  } else if (stacked) {
    // Vertical stacked bars
    let cumulative = 0;
    let seriesIdx = 0;
    for (const line of lines) {
      const value = d[line.dataKey];
      if (typeof value === "number") {
        cumulative += value;
        const axisScale = yScales[normalizeYAxisId(line.yAxisId)] ?? primaryYScale;
        const gapOffset = seriesIdx * stackGap;
        yPositions[line.dataKey] = (axisScale(cumulative) ?? 0) - gapOffset;
        seriesIdx++;
      }
    }
  } else {
    // Vertical grouped bars
    const seriesCount = lines.length;
    const groupGap = seriesCount > 1 ? 4 : 0;
    const individualBarWidth = seriesCount > 0 ? (bandWidth - groupGap * (seriesCount - 1)) / seriesCount : bandWidth;

    lines.forEach((line, idx) => {
      const value = d[line.dataKey];
      if (typeof value === "number") {
        const axisScale = yScales[normalizeYAxisId(line.yAxisId)] ?? primaryYScale;
        const baselineY = axisScale(0) ?? innerHeight;
        const valueY = axisScale(value) ?? 0;
        const barLengthPx = baselineY - valueY;

        if (squareSnap && !isHorizontal && value > 0) {
          yPositions[line.dataKey] = topSquareCenterY({
            baselineY,
            barLengthPx,
            squareSize: individualBarWidth,
            gap: squareSnap.squareGap,
            fit: squareSnap.fit,
          });
        } else {
          yPositions[line.dataKey] = valueY;
        }

        xPositions[line.dataKey] = barPos + idx * (individualBarWidth + groupGap) + individualBarWidth / 2;
      }
    });
  }

  const tooltipX = isHorizontal ? Math.max(...Object.values(xPositions), 0) : barPos + bandWidth / 2;

  return { tooltipX, xPositions, yPositions };
}
