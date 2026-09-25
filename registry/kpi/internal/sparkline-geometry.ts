export const CHART_VERTICAL_PADDING = 4;

/**
 * Height of the lowest bar as a fraction of the drawable height.
 *
 * Bars are normalised against the series minimum, so without a floor the lowest
 * value maps to zero height. On a live feed the newest value is regularly the
 * new minimum, which made every fresh bar collapse into an invisible sliver.
 */
export const MIN_BAR_HEIGHT_RATIO = 0.18;

export type BarGeometry = {
  height: number;
  width: number;
  x: number;
  y: number;
};

type GeometryOptions = {
  height: number;
  padding?: number;
  width: number;
};

/**
 * Positions and sizes the bars of a sparkline. Kept separate from the component
 * so the scaling rules can be unit tested without a DOM.
 */
export function computeBarGeometry(
  data: number[],
  { height, padding = CHART_VERTICAL_PADDING, width }: GeometryOptions,
): BarGeometry[] {
  if (data.length === 0) return [];

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;
  const drawableHeight = height - padding * 2;
  const baseline = height - padding;
  const barWidth = Math.max(2, width / data.length - 2);

  return data.map((point, index) => {
    // A flat series has no spread to scale against; draw it at full height
    // rather than collapsing every bar onto the floor.
    const ratio = range === 0 ? 1 : (point - min) / range;
    const scaled = Math.min(1, MIN_BAR_HEIGHT_RATIO + (1 - MIN_BAR_HEIGHT_RATIO) * ratio);
    const barHeight = drawableHeight * scaled;

    return {
      height: barHeight,
      width: barWidth,
      x: (index / data.length) * width,
      y: baseline - barHeight,
    };
  });
}
