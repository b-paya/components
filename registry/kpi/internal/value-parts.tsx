import type { KpiValuePart } from "./format-value";

type ValuePartsProps = {
  parts: KpiValuePart[];
};

/**
 * Renders formatted parts as typed spans so the KPI styles can give the digits, the
 * locale notation (currency symbol, percent sign, compact exponent) and the
 * measure unit their own typography. Formatting happens in the card, which lets
 * one set of parts feed both the hero value and the target footer.
 */
export function ValueParts({ parts }: ValuePartsProps) {
  return parts.map((part, index) => (
    <span
      className={`kpi-value-part kpi-value-part--${part.kind}`}
      // Parts have no stable identity: the same kind and value can repeat
      // within one number (thousands groups), so position is the only key.
      key={`${index}-${part.kind}-${part.value}`}
    >
      {part.value}
    </span>
  ));
}
