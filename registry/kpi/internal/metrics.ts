/** `standard`: up is good. `inverted`: down is good (latency, error rate, churn). */
export type KpiSemantics = "inverted" | "neutral" | "standard";

export type KpiTone = "flat" | "negative" | "neutral" | "positive";

export type KpiMetricsInput = {
  previousValue?: number;
  semantics: KpiSemantics;
  targetValue?: number | null;
  value: number;
};

export type KpiMetrics = {
  delta: number;
  /** Change in percent of `previousValue`; `null` without one or when it is zero. */
  deltaPercent: number | null;
  hasComparison: boolean;
  showTarget: boolean;
  targetProgress: number;
  tone: KpiTone;
};

function resolveTone(delta: number, semantics: KpiSemantics): KpiTone {
  if (semantics === "neutral") return "neutral";
  if (delta === 0) return "flat";

  const isGood = semantics === "standard" ? delta > 0 : delta < 0;
  return isGood ? "positive" : "negative";
}

/** Comparison, tone and target progress, derived from the props. */
export function computeKpiMetrics({
  previousValue,
  semantics,
  targetValue = null,
  value,
}: KpiMetricsInput): KpiMetrics {
  const hasComparison = previousValue != null;
  const delta = hasComparison ? value - previousValue : 0;
  const deltaPercent =
    hasComparison && previousValue !== 0
      ? (delta / Math.abs(previousValue)) * 100
      : null;
  const tone = resolveTone(delta, semantics);
  const showTarget = targetValue != null && targetValue !== 0;
  const targetProgress = showTarget
    ? Math.min(100, Math.max(0, (value / targetValue) * 100))
    : 0;

  return {
    delta,
    deltaPercent,
    hasComparison,
    showTarget,
    targetProgress,
    tone,
  };
}
