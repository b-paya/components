export type KpiFormat = "compact" | "currency" | "number" | "percentage";

export type FormatValueOptions = {
  currency?: string;
  format?: KpiFormat;
  /** Fixed decimals, so a live value keeps its width. */
  fractionDigits?: number;
  locale?: string;
  /** Measure unit (`"km/s"`). Not locale notation, so it is its own part. */
  unit?: string;
};

/**
 * - `digits`: the number, with separators and sign
 * - `notation`: currency symbol, percent sign or compact exponent from `Intl`
 * - `unit`: the caller's measure unit
 * - `literal`: locale spacing between them
 */
export type KpiValuePartKind = "digits" | "literal" | "notation" | "unit";

export type KpiValuePart = {
  kind: KpiValuePartKind;
  value: string;
};

const PLACEHOLDER = "--";

/** Creating an `Intl.NumberFormat` is expensive and a live card formats every tick. */
const formatterCache = new Map<string, Intl.NumberFormat>();

function cachedFormatter(
  key: string,
  create: () => Intl.NumberFormat,
): Intl.NumberFormat {
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
        ...(fractionDigits == null
          ? {}
          : { minimumFractionDigits: fractionDigits }),
        notation: "compact",
      };
    case "currency":
      // The currency's own decimals ($19.50, ¥1,950), none for a whole amount.
      return fractionDigits == null
        ? ({
            currency,
            style: "currency",
            trailingZeroDisplay: "stripIfInteger",
          } as Intl.NumberFormatOptions)
        : {
            currency,
            maximumFractionDigits: fractionDigits,
            minimumFractionDigits: fractionDigits,
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
        : {
            maximumFractionDigits: fractionDigits,
            minimumFractionDigits: fractionDigits,
          };
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
    () =>
      new Intl.NumberFormat(
        locale,
        numberFormatOptions(format, currency, fractionDigits),
      ),
  );
}

/** Takes whole-number percentages (`12.5` → `12.5%`), not `Intl`'s `0.125`. */
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
 * Splits a value into typographic parts with `formatToParts`, since symbols
 * move between locales. A missing value yields `"--"`, keeping the card's height.
 */
export function formatValueParts(
  value: number | null | undefined,
  options: FormatValueOptions = {},
): KpiValuePart[] {
  if (value == null || Number.isNaN(value))
    return [{ kind: "digits", value: PLACEHOLDER }];

  const { format = "number", unit } = options;

  const parts: KpiValuePart[] = numberFormat(options)
    .formatToParts(toFormatterInput(value, format))
    .map((part) => ({ kind: classify(part.type), value: part.value }));

  if (unit == null || unit === "") return parts;

  return [
    ...parts,
    { kind: "literal", value: " " },
    { kind: "unit", value: unit },
  ];
}

/** Plain text of the parts, used as a React `key`. */
export function partsToText(parts: KpiValuePart[]): string {
  return parts.map((part) => part.value).join("");
}

type FormatPercentChangeOptions = {
  locale?: string;
  /** Prefix non-zero values with `+` or `−`. */
  signed?: boolean;
};

/** Trend badge text from a whole-number percentage, one decimal so its width holds. */
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
