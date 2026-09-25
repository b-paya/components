export type KpiFormat = "compact" | "currency" | "number" | "percentage";

export type FormatValueOptions = {
  currency?: string;
  format?: KpiFormat;
  /** Fixed decimals. Keeps a live value's width stable (min === max) so the
   * sparkline never shifts. */
  fractionDigits?: number;
  locale?: string;
  /** Measure unit rendered beside the number (`"km/s"`). Unlike the currency
   * symbol or the percent sign this is not part of the locale's number
   * notation, so it gets its own part and its own typography. */
  unit?: string;
};

/**
 * How a formatted fragment should be typeset:
 * - `digits`: the number itself, including separators and the sign
 * - `notation`: locale notation carried by `Intl` — currency symbol, percent
 *   sign, compact exponent. Reads as part of the number
 * - `unit`: a measure unit supplied by the caller. Reads as metadata
 * - `literal`: locale spacing between the number and its notation
 */
export type KpiValuePartKind = "digits" | "literal" | "notation" | "unit";

export type KpiValuePart = {
  kind: KpiValuePartKind;
  value: string;
};

const PLACEHOLDER = "--";

/**
 * Constructing an `Intl.NumberFormat` costs far more than using one, and a live
 * card reformats on every tick. Cache keys are built from props, so the map
 * holds one entry per formatting variant the app actually renders.
 */
const formatterCache = new Map<string, Intl.NumberFormat>();

function cachedFormatter(key: string, create: () => Intl.NumberFormat): Intl.NumberFormat {
  const cached = formatterCache.get(key);
  if (cached != null) return cached;

  const formatter = create();
  formatterCache.set(key, formatter);
  return formatter;
}

function numberFormatOptions(
  format: KpiFormat,
  currency: string,
  fractionDigits: number | undefined,
): Intl.NumberFormatOptions {
  switch (format) {
    case "compact":
      return {
        compactDisplay: "short",
        maximumFractionDigits: fractionDigits ?? 1,
        ...(fractionDigits == null ? {} : { minimumFractionDigits: fractionDigits }),
        notation: "compact",
      };
    case "currency":
      return {
        currency,
        maximumFractionDigits: fractionDigits ?? 1,
        minimumFractionDigits: fractionDigits ?? 0,
        style: "currency",
      };
    case "percentage":
      return {
        maximumFractionDigits: fractionDigits ?? 2,
        minimumFractionDigits: fractionDigits ?? 1,
        style: "percent",
      };
    case "number":
      return fractionDigits == null
        ? {}
        : { maximumFractionDigits: fractionDigits, minimumFractionDigits: fractionDigits };
    default: {
      const exhaustiveCheck: never = format;
      return exhaustiveCheck;
    }
  }
}

function numberFormat({
  currency = "USD",
  format = "number",
  fractionDigits,
  locale = "en-US",
}: FormatValueOptions): Intl.NumberFormat {
  return cachedFormatter(
    `value|${locale}|${format}|${currency}|${fractionDigits ?? "auto"}`,
    () => new Intl.NumberFormat(locale, numberFormatOptions(format, currency, fractionDigits)),
  );
}

/** `percentage` takes whole-number percentages (`12.5` → `12.5%`), matching how
 * the delta is computed in `Kpi`, not the `Intl` convention of `0.125`. */
function toFormatterInput(value: number, format: KpiFormat): number {
  return format === "percentage" ? value / 100 : value;
}

function classify(type: Intl.NumberFormatPartTypes): KpiValuePartKind {
  switch (type) {
    case "compact":
    case "currency":
    case "exponentInteger":
    case "exponentMinusSign":
    case "exponentSeparator":
    case "percentSign":
    case "unit":
      return "notation";
    case "literal":
      return "literal";
    default:
      return "digits";
  }
}

/**
 * Splits a KPI value into typographic parts via `Intl.NumberFormat#formatToParts`,
 * so the card can style the currency symbol, percent sign, compact exponent and
 * measure unit without ever string-matching `"$"` or `"%"` — those move around
 * between locales. Nullish values yield a single `"--"` part, so a card with
 * missing data still renders at its normal height.
 */
export function formatValueParts(
  value: number | null | undefined,
  options: FormatValueOptions = {},
): KpiValuePart[] {
  if (value == null || Number.isNaN(value)) return [{ kind: "digits", value: PLACEHOLDER }];

  const { format = "number", unit } = options;

  const parts: KpiValuePart[] = numberFormat(options)
    .formatToParts(toFormatterInput(value, format))
    .map((part) => ({ kind: classify(part.type), value: part.value }));

  if (unit == null || unit === "") return parts;

  return [...parts, { kind: "literal", value: " " }, { kind: "unit", value: unit }];
}

/** Flattens parts into plain text, for a React `key` that has to change
 * whenever the rendered number changes. */
export function partsToText(parts: KpiValuePart[]): string {
  return parts.map((part) => part.value).join("");
}

type FormatPercentChangeOptions = {
  locale?: string;
  /** When true, prefixes non-zero values with `+` / `−` via `signDisplay`. */
  signed?: boolean;
};

/**
 * Formats a relative change for the trend badge. Input is a whole-number
 * percentage (`12.5` → `12.5%`), matching how `computeKpiMetrics` computes
 * `deltaPercent`. Fixed to one decimal so the badge width stays stable.
 */
export function formatPercentChange(
  value: number | null | undefined,
  { locale = "en-US", signed = false }: FormatPercentChangeOptions = {},
): string {
  if (value == null || Number.isNaN(value)) return PLACEHOLDER;

  const formatter = cachedFormatter(
    `change|${locale}|${signed}`,
    () =>
      new Intl.NumberFormat(locale, {
        maximumFractionDigits: 1,
        minimumFractionDigits: 1,
        signDisplay: signed ? "exceptZero" : "never",
        style: "percent",
      }),
  );

  return formatter.format((signed ? value : Math.abs(value)) / 100);
}
