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
  /** Panel shown on hover, keyboard focus or tap. No panel when omitted. */
  details?: ReactNode;
  /** Accessible name of the details group. */
  detailsLabel?: string;
  format?: KpiFormat;
  /** Fixed decimals for the value and target. Each format has its own default. */
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
  /** Unit after the value and target (`"km/s"`). Currency and percent come from `format`. */
  valueUnit?: string;
};

const COPIED_RESET_MS = 2000;
const DETAILS_OPEN_DELAY_MS = 500;
const DETAILS_CLOSE_DELAY_MS = 200;
const TOUCH_TAP_MOVE_TOLERANCE_PX = 8;

/** Stable default, so `memo` still works. */
const NO_HISTORY: number[] = [];

/**
 * KPI card: a title, one large value, an optional trend badge, sparkline,
 * target progress and a details panel.
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
      // No clipboard access (insecure origin or denied permission).
    }
  }, [clearCopyTimer, value]);

  const rootClassName = ["kpi-theme", "kpi", className]
    .filter(Boolean)
    .join(" ");
  // With details the shell is the root, so layout classes belong on it.
  const cardClassName = detailsActive ? "kpi-theme kpi" : rootClassName;

  if (isLoading) {
    return (
      <div aria-busy="true" className={`${rootClassName} kpi--loading`}>
        <div className="kpi-skeleton kpi-skeleton--title" />
        <div className="kpi-skeleton kpi-skeleton--value" />
        <div className="kpi-skeleton kpi-skeleton--footer" />
      </div>
    );
  }

  const {
    delta,
    deltaPercent,
    hasComparison,
    showTarget,
    targetProgress,
    tone,
  } = computeKpiMetrics({ previousValue, semantics, targetValue, value });

  const TrendIcon =
    delta > 0 ? ArrowUpRightIcon : delta < 0 ? ArrowDownRightIcon : MinusIcon;
  const showChart = historyData.length > 0 && chartType !== "none";
  const visibleDeltaPercent = formatPercentChange(deltaPercent, { locale });
  const signedDeltaPercent =
    deltaPercent == null
      ? null
      : formatPercentChange(deltaPercent, { locale, signed: true });

  const formatOptions = {
    currency,
    format,
    fractionDigits,
    locale,
    unit: valueUnit,
  };
  const valueParts = formatValueParts(value, formatOptions);

  const card = (
    <div className={`${cardClassName} kpi--tone-${tone}`}>
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
        <span
          className="kpi-value kpi-value-animate"
          key={partsToText(valueParts)}
        >
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
              <span className="kpi-value-part kpi-value-part--literal">
                {" "}
                /{" "}
              </span>
              <ValueParts
                parts={formatValueParts(targetValue, formatOptions)}
              />
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
                this passes the fraction and nothing else. */}
            <div
              className="kpi-progress-fill"
              style={
                {
                  "--kpi-progress": targetProgress / 100,
                } as React.CSSProperties
              }
            />
          </div>
        </div>
      ) : null}
    </div>
  );

  if (!detailsActive) return card;

  return (
    <KpiDetailsShell
      className={className}
      details={details}
      detailsLabel={detailsLabel}
      // With no button inside, the shell itself must be focusable.
      focusLabel={showCopyButton || onActionClick ? undefined : title}
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

/** Label/value list for the `details` prop. */
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
  className?: string;
  details: ReactNode;
  detailsLabel: string;
  /** When set, the shell itself takes focus, named by this. */
  focusLabel?: string;
};

type TouchPress = {
  pointerId: number;
  startX: number;
  startY: number;
};

/** Whether focus came from a keyboard. Without `:focus-visible`, assume it did. */
function isKeyboardFocus(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  try {
    return target.matches(":focus-visible");
  } catch {
    return true;
  }
}

function isTouchToggleTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;

  return (
    target.closest(
      ".kpi-details, a, button, input, select, textarea, [contenteditable], [role='button'], [role='link']",
    ) == null
  );
}

/** Open state and timers; lives only while `details` is set. */
function KpiDetailsShell({
  children,
  className,
  details,
  detailsLabel,
  focusLabel,
}: KpiDetailsShellProps) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchPressRef = useRef<TouchPress | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  /** A tap-opened panel ignores blur; it closes on a tap, a press outside or Escape. */
  const openedByTapRef = useRef(false);

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
    openedByTapRef.current = false;
    clearTimers();
    openTimerRef.current = setTimeout(
      () => setOpen(true),
      DETAILS_OPEN_DELAY_MS,
    );
  }, [clearTimers]);

  const scheduleClose = useCallback(() => {
    clearTimers();
    closeTimerRef.current = setTimeout(
      () => setOpen(false),
      DETAILS_CLOSE_DELAY_MS,
    );
  }, [clearTimers]);

  const closeNow = useCallback(() => {
    openedByTapRef.current = false;
    clearTimers();
    setOpen(false);
  }, [clearTimers]);

  const handlePointerEnter = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== "mouse") return;
      scheduleOpen();
    },
    [scheduleOpen],
  );

  const handlePointerLeave = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== "mouse") return;
      scheduleClose();
    },
    [scheduleClose],
  );

  const handleTouchPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== "touch" || !isTouchToggleTarget(event.target))
        return;

      touchPressRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
      };
    },
    [],
  );

  const handleTouchPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (touchPressRef.current?.pointerId === event.pointerId)
        touchPressRef.current = null;
    },
    [],
  );

  const handleTouchPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const touchPress = touchPressRef.current;
      touchPressRef.current = null;

      if (
        event.pointerType !== "touch" ||
        touchPress?.pointerId !== event.pointerId ||
        !isTouchToggleTarget(event.target) ||
        Math.hypot(
          event.clientX - touchPress.startX,
          event.clientY - touchPress.startY,
        ) > TOUCH_TAP_MOVE_TOLERANCE_PX
      )
        return;

      clearTimers();
      openedByTapRef.current = !open;
      setOpen(!open);
    },
    [clearTimers, open],
  );

  /*
   * While open, Escape or a press outside closes the panel; touch has no
   * pointer to leave. Escape is captured and marked handled so an enclosing
   * dialog does not also close, but only when focus is in the card or nowhere.
   */
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const active = document.activeElement;
      const shell = shellRef.current;
      if (
        active &&
        active !== document.body &&
        shell &&
        !shell.contains(active)
      )
        return;
      event.preventDefault();
      closeNow();
    };
    const onPointerDown = (event: PointerEvent) => {
      const shell = shellRef.current;
      if (
        shell &&
        event.target instanceof Node &&
        !shell.contains(event.target)
      )
        closeNow();
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
      aria-label={focusLabel}
      className={["kpi-theme", "kpi-shell", className]
        .filter(Boolean)
        .join(" ")}
      onBlur={(event) => {
        const next = event.relatedTarget;
        // A tap moves focus to nothing; that blur must not close what it opened.
        if (openedByTapRef.current && next == null) return;
        if (next instanceof Node && event.currentTarget.contains(next)) return;
        scheduleClose();
      }}
      onFocus={(event) => {
        // Only keyboard focus opens the panel; taps and clicks focus too.
        if (!isKeyboardFocus(event.target)) return;
        scheduleOpen();
      }}
      onPointerCancel={handleTouchPointerCancel}
      onPointerDown={handleTouchPointerDown}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerUp={handleTouchPointerUp}
      ref={shellRef}
      role={focusLabel ? "group" : undefined}
      tabIndex={focusLabel ? 0 : undefined}
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
