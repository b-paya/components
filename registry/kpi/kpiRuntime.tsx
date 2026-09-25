"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import {
  formatPercentChange,
  formatValueParts,
  partsToText,
  type KpiFormat,
} from "./internal/format-value";
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  MinusIcon,
} from "./internal/icons";
import { computeKpiMetrics, type KpiSemantics } from "./internal/metrics";
import { Sparkline, type SparklineType } from "./internal/sparkline";
import { ValueParts } from "./internal/value-parts";

export type { KpiSemantics } from "./internal/metrics";

export type KpiChartType = SparklineType | "none";

export type KpiProps = {
  /** Replaces the default "open in new tab" glyph of the action button. */
  actionIcon?: ReactNode;
  /** Accessible name of the action button. */
  actionLabel?: string;
  chartType?: KpiChartType;
  className?: string;
  /** Caption next to the trend badge. */
  comparisonLabel?: string;
  /** Announced via a polite status region after a successful copy. */
  copiedLabel?: string;
  /** Accessible name of the copy button. */
  copyLabel?: string;
  /** ISO 4217 code, used when `format` is `"currency"`. */
  currency?: string;
  /** Hover, focus or touch-tap details panel body. Feature is inactive when omitted. */
  details?: ReactNode;
  /** Accessible name of the details group. */
  detailsLabel?: string;
  format?: KpiFormat;
  /**
   * Fixed decimals for `number`, `currency`, `compact` and `percentage`.
   * Applied to the value and target. When omitted, each format keeps its own
   * default (`number`: locale default; `currency`: 0–1; `compact`: max 1;
   * `percentage`: 1–2).
   */
  fractionDigits?: number;
  /** Oldest value first. */
  historyData?: number[];
  isLoading?: boolean;
  /** BCP 47 tag driving number, currency and percentage formatting. */
  locale?: string;
  onActionClick?: () => void;
  previousValue?: number;
  semantics?: KpiSemantics;
  showCopyButton?: boolean;
  targetLabel?: string;
  /** Renders the progress footer when set. */
  targetValue?: number | null;
  title: string;
  value: number;
  /**
   * Measure unit (`"km/s"`) shown after the main value and both target-footer
   * values. Currency and percent affixes come from `format` instead, so they
   * stay locale-correct.
   */
  valueUnit?: string;
};

const COPIED_RESET_MS = 2000;
const DETAILS_OPEN_DELAY_MS = 500;
const DETAILS_CLOSE_DELAY_MS = 200;
const TOUCH_TAP_MOVE_TOLERANCE_PX = 8;

/** Stable identity for the default, so `Kpi` stays safe to wrap in `memo`. */
const NO_HISTORY: number[] = [];

/**
 * Self-contained KPI card: a title, one large value, an optional trend badge,
 * sparkline, target progress and a details panel revealed on hover, focus or tap.
 *
 * The folder is a portable island. It imports no design tokens, no `cn()`
 * helper and no sibling components; all styling lives in `styles/` behind the
 * `kpi-` class / token prefix and every import inside the folder is relative. Copy
 * `kpi/` into another project; it needs nothing beyond React.
 *
 * @example
 * <Kpi
 *   comparisonLabel="vs last month"
 *   format="currency"
 *   historyData={[38_100, 39_400, 41_200, 42_800]}
 *   previousValue={41_200}
 *   targetValue={50_000}
 *   title="Monthly recurring revenue"
 *   value={42_800}
 * />
 */
export function Kpi({
  actionIcon,
  actionLabel = "Open details",
  chartType = "line",
  className,
  comparisonLabel = "vs last period",
  copiedLabel = "Value copied",
  copyLabel = "Copy raw value",
  currency = "USD",
  details,
  detailsLabel = "Additional details",
  format = "number",
  fractionDigits,
  historyData = NO_HISTORY,
  isLoading = false,
  locale = "en-US",
  onActionClick,
  previousValue,
  semantics = "standard",
  showCopyButton = true,
  targetLabel = "Goal",
  targetValue = null,
  title,
  value,
  valueUnit,
}: KpiProps) {
  const [copied, setCopied] = useState(false);
  const progressLabelId = useId();
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detailsActive = details != null;

  const clearCopyTimer = useCallback(() => {
    if (copyTimerRef.current != null) {
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearCopyTimer(), [clearCopyTimer]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(String(value));
      clearCopyTimer();
      setCopied(true);
      copyTimerRef.current = setTimeout(() => {
        setCopied(false);
        copyTimerRef.current = null;
      }, COPIED_RESET_MS);
    } catch {
      // Clipboard access is unavailable (insecure origin, denied permission).
      // Silently keep the previous state rather than breaking the card.
    }
  }, [clearCopyTimer, value]);

  const rootClassName = ["kpi-theme", "kpi", className].filter(Boolean).join(" ");

  if (isLoading) {
    return (
      <div aria-busy="true" className={`${rootClassName} kpi--loading`}>
        <div className="kpi-skeleton kpi-skeleton--title" />
        <div className="kpi-skeleton kpi-skeleton--value" />
        <div className="kpi-skeleton kpi-skeleton--footer" />
      </div>
    );
  }

  const { delta, deltaPercent, hasComparison, showTarget, targetProgress, tone } =
    computeKpiMetrics({ previousValue, semantics, targetValue, value });

  const TrendIcon = delta > 0 ? ArrowUpRightIcon : delta < 0 ? ArrowDownRightIcon : MinusIcon;
  const showChart = historyData.length > 0 && chartType !== "none";
  const visibleDeltaPercent = formatPercentChange(deltaPercent, { locale });
  const signedDeltaPercent =
    deltaPercent == null ? null : formatPercentChange(deltaPercent, { locale, signed: true });

  const formatOptions = { currency, format, fractionDigits, locale, unit: valueUnit };
  const valueParts = formatValueParts(value, formatOptions);

  const card = (
    <div className={`${rootClassName} kpi--tone-${tone}`}>
      <div className="kpi-header">
        <h3 className="kpi-title">{title}</h3>

        <div className="kpi-actions">
          {showCopyButton ? (
            <KpiButton
              aria-label={copyLabel}
              className={copied ? "kpi-button--success" : undefined}
              onClick={handleCopy}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </KpiButton>
          ) : null}
          {onActionClick ? (
            <KpiButton aria-label={actionLabel} onClick={onActionClick}>
              {actionIcon ?? <ExternalLinkIcon />}
            </KpiButton>
          ) : null}
        </div>
      </div>

      <span aria-live="polite" className="kpi-sr-only" role="status">
        {copied ? copiedLabel : ""}
      </span>

      <div className="kpi-body">
        {/* Remounting on a new value replays the CSS fade in `.kpi-value-animate`. */}
        <span className="kpi-value kpi-value-animate" key={partsToText(valueParts)}>
          <ValueParts parts={valueParts} />
        </span>

        {hasComparison ? (
          <div className="kpi-trend">
            <span className="kpi-trend-badge">
              <TrendIcon size={10} />
              {signedDeltaPercent != null ? (
                <>
                  <span aria-hidden="true">{visibleDeltaPercent}</span>
                  <span className="kpi-sr-only">{signedDeltaPercent}</span>
                </>
              ) : (
                visibleDeltaPercent
              )}
            </span>
            <span className="kpi-trend-comparison">{comparisonLabel}</span>
          </div>
        ) : null}

        {showChart ? (
          <div className="kpi-chart">
            <Sparkline data={historyData} type={chartType} />
          </div>
        ) : null}
      </div>

      {showTarget ? (
        <div className="kpi-footer">
          <div className="kpi-footer-row">
            <span className="kpi-footer-label" id={progressLabelId}>
              {targetLabel}
            </span>
            <span className="kpi-footer-value">
              <ValueParts parts={valueParts} />
              <span className="kpi-value-part kpi-value-part--literal"> / </span>
              <ValueParts parts={formatValueParts(targetValue, formatOptions)} />
            </span>
          </div>
          <div
            aria-labelledby={progressLabelId}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={Math.round(targetProgress)}
            className="kpi-progress"
            role="progressbar"
          >
            {/* The fill's width and its entrance both live in the stylesheet;
                this passes the fraction and nothing else. It used to be a
                `motion/react` transition, which made a 40 kB library this
                demo's only third-party dependency for one animated width. */}
            <div
              className="kpi-progress-fill"
              style={{ "--kpi-progress": targetProgress / 100 } as React.CSSProperties}
            />
          </div>
        </div>
      ) : null}
    </div>
  );

  if (!detailsActive) return card;

  return (
    <KpiDetailsShell
      details={details}
      detailsLabel={detailsLabel}
    >
      {card}
    </KpiDetailsShell>
  );
}

export type KpiDetailRow = {
  label: string;
  value: string;
};

type KpiDetailsProps = {
  rows: KpiDetailRow[];
};

/**
 * Ready-made label/value list for the details panel. Pass it — or any other
 * node — into `Kpi`'s `details` prop; the card never fetches data itself.
 */
export function KpiDetails({ rows }: KpiDetailsProps) {
  if (rows.length === 0) return null;

  return (
    <dl className="kpi-details-list">
      {rows.map((row) => (
        <div className="kpi-details-row" key={row.label}>
          <dt className="kpi-details-label">{row.label}</dt>
          <dd className="kpi-details-value">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

type KpiDetailsShellProps = {
  children: ReactNode;
  details: ReactNode;
  detailsLabel: string;
};

type TouchPress = {
  pointerId: number;
  startX: number;
  startY: number;
};

function isTouchToggleTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;

  return target.closest(".kpi-details, a, button, input, select, textarea, [contenteditable], [role='button'], [role='link']") == null;
}

/** Owns open/close timers so omitting `details` unmounts and resets state. */
function KpiDetailsShell({
  children,
  details,
  detailsLabel,
}: KpiDetailsShellProps) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchPressRef = useRef<TouchPress | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  const clearTimers = useCallback(() => {
    if (openTimerRef.current != null) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (closeTimerRef.current != null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleOpen = useCallback(() => {
    clearTimers();
    openTimerRef.current = setTimeout(() => setOpen(true), DETAILS_OPEN_DELAY_MS);
  }, [clearTimers]);

  const scheduleClose = useCallback(() => {
    clearTimers();
    closeTimerRef.current = setTimeout(() => setOpen(false), DETAILS_CLOSE_DELAY_MS);
  }, [clearTimers]);

  const closeNow = useCallback(() => {
    clearTimers();
    setOpen(false);
  }, [clearTimers]);

  const handlePointerEnter = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;
    scheduleOpen();
  }, [scheduleOpen]);

  const handlePointerLeave = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;
    scheduleClose();
  }, [scheduleClose]);

  const handleTouchPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch" || !isTouchToggleTarget(event.target)) return;

    touchPressRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
  }, []);

  const handleTouchPointerCancel = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (touchPressRef.current?.pointerId === event.pointerId) touchPressRef.current = null;
  }, []);

  const handleTouchPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const touchPress = touchPressRef.current;
    touchPressRef.current = null;

    if (
      event.pointerType !== "touch" ||
      touchPress?.pointerId !== event.pointerId ||
      !isTouchToggleTarget(event.target) ||
      Math.hypot(event.clientX - touchPress.startX, event.clientY - touchPress.startY) > TOUCH_TAP_MOVE_TOLERANCE_PX
    ) return;

    clearTimers();
    setOpen((current) => !current);
  }, [clearTimers]);

  /*
   * While the panel is open, and only then: Escape closes it, and a press
   * anywhere outside the card does too — on a touch screen there is no pointer
   * to leave, so without it the panel stays over the page.
   *
   * Escape is claimed in the capture phase on `window`, ahead of any host
   * handler on `document`: a page that closes a view on Escape (a dialog, a
   * preview frame) would otherwise close it on the same key press.
   */
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      closeNow();
    };
    const onPointerDown = (event: PointerEvent) => {
      const shell = shellRef.current;
      if (shell && event.target instanceof Node && !shell.contains(event.target)) closeNow();
    };

    window.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [closeNow, open]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  return (
    <div
      aria-details={open ? detailsId : undefined}
      className="kpi-theme kpi-shell"
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) return;
        scheduleClose();
      }}
      onFocus={scheduleOpen}
      onPointerCancel={handleTouchPointerCancel}
      onPointerDown={handleTouchPointerDown}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerUp={handleTouchPointerUp}
      ref={shellRef}
    >
      {children}
      <div
        aria-hidden={!open}
        aria-label={detailsLabel}
        className={`kpi-details kpi-details--animate${open ? " is-open" : ""}`}
        id={detailsId}
        role="group"
      >
        <div aria-hidden="true" className="kpi-details-bridge" />
        <div className="kpi-details-panel">
          <div className="kpi-details-content">{details}</div>
        </div>
      </div>
    </div>
  );
}

/** Icon-only action button; the accessible name comes from `aria-label`. */
function KpiButton({
  className,
  type = "button",
  ...props
}: ComponentPropsWithRef<"button">) {
  return (
    <button
      className={["kpi-button", className].filter(Boolean).join(" ")}
      type={type}
      {...props}
    />
  );
}
