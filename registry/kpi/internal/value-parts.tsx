import type { KpiValuePart } from "./format-value";

type ValuePartsProps = {
  parts: KpiValuePart[];
};

/** One span per part, so digits, notation and unit can be styled apart. */
export function ValueParts({ parts }: ValuePartsProps) {
  return parts.map((part, index) => (
    <span
      className={`kpi-value-part kpi-value-part--${part.kind}`}
      // Parts repeat within a number, so position is the only key.
      key={`${index}-${part.kind}-${part.value}`}
    >
      {part.value}
    </span>
  ));
}
