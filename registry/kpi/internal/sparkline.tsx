"use client";

import { CHART_VERTICAL_PADDING, computeBarGeometry } from "./sparkline-geometry";

export type SparklineType = "bar" | "line";

const WIDTH = 120;
const HEIGHT = 40;

type SparklineProps = {
  data: number[];
  type?: SparklineType;
};

/**
 * Micro chart drawn as plain SVG from the data points. Stroke and fill follow
 * `currentColor`, which `.kpi-chart` sets per trend tone. Decorative by
 * design: the numbers next to it carry the information, so it is hidden from
 * assistive tech.
 *
 * Both entrances live in `styles/motion.css`. They used to be `motion/react`
 * transitions here, which made a 40 kB library this demo's only third-party
 * dependency and put the reduced-motion decision in the script — where, for a
 * portable island, it does not belong. The bars carry their index so the
 * stylesheet can stagger them; nothing else about the animation reaches this
 * file.
 */
export function Sparkline({ data, type = "line" }: SparklineProps) {
  if (data.length === 0) return null;

  if (type === "bar") {
    return (
      <svg aria-hidden="true" focusable="false" height={HEIGHT} width={WIDTH}>
        {computeBarGeometry(data, { height: HEIGHT, width: WIDTH }).map((bar, index) => (
          <rect
            fill="currentColor"
            height={bar.height}
            key={index}
            opacity={0.6}
            style={{ "--kpi-bar-index": index } as React.CSSProperties}
            width={bar.width}
            x={bar.x}
            y={bar.y}
          />
        ))}
      </svg>
    );
  }

  // One point has no span to draw a line across. A polyline of one point
  // renders nothing, which left an empty chart area; a dot says "one reading".
  if (data.length === 1) {
    return (
      <svg aria-hidden="true" focusable="false" height={HEIGHT} width={WIDTH}>
        <circle cx={WIDTH / 2} cy={HEIGHT / 2} fill="currentColor" r={2.5} />
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const drawableHeight = HEIGHT - CHART_VERTICAL_PADDING * 2;

  const lastIndex = data.length - 1;
  const points = data
    .map((point, index) => {
      const x = (index / lastIndex) * WIDTH;
      const y = HEIGHT - CHART_VERTICAL_PADDING - ((point - min) / range) * drawableHeight;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg aria-hidden="true" focusable="false" height={HEIGHT} width={WIDTH}>
      {/* `pathLength={1}` renormalises the line to a single unit so the
          stylesheet can draw it with a dash of 1, whatever the data does to its
          real length. */}
      <polyline
        fill="none"
        pathLength={1}
        points={points}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}
