# KPI

A React card for one metric: its title, value, trend against a previous value, a small chart, progress towards a target, and a details panel that opens on hover, focus or tap.

It is presentational: it never fetches. You map your data to its props. It needs nothing beyond React, brings its own scoped CSS, and follows your light or dark theme.

## Install

Copy these into your project, keeping the folder structure:

```text
kpi/
  kpi.tsx          the entry: import from here
  kpiRuntime.tsx
  internal/
  styles/          index.css and the four files it imports
```

Requirements: React 18 or 19 (`react` and `react-dom` as peers), **TypeScript**, and a bundler that handles CSS imports, as Vite and Next.js do. `kpi.tsx` imports `styles/index.css` itself. The files are TypeScript and are not transpiled on install, so a JavaScript project (`"tsx": false` in shadcn's `components.json`) cannot use them as they are.

## Minimal example

```tsx
import { Kpi, KpiDetails } from "./kpi/kpi";

<Kpi
  title="Monthly recurring revenue"
  value={42_800}
  format="currency"
  previousValue={41_200}
  historyData={[38_100, 39_400, 41_200, 42_800]}
  targetValue={50_000}
  details={<KpiDetails rows={[{ label: "New MRR", value: "$4,200" }]} />}
/>
```

`title` and `value` are the only required props: without a metric there is nothing to show. Everything else has a default.

## Props

### `Kpi`

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `string` | — | **Required.** The card's heading. |
| `value` | `number` | — | **Required.** The metric. |
| `previousValue` | `number` | — | An earlier real reading. Shows the trend badge; omit it when there is none. |
| `historyData` | `number[]` | `[]` | The chart's series, oldest first. One point draws a dot. |
| `chartType` | `"line" \| "bar" \| "none"` | `"line"` | Chart style, or no chart. |
| `format` | `"number" \| "currency" \| "compact" \| "percentage"` | `"number"` | How the value and target are formatted. |
| `currency` | `string` | `"USD"` | ISO 4217 code, used when `format` is `"currency"`. |
| `locale` | `string` | `"en-US"` | BCP 47 tag for all number formatting. |
| `fractionDigits` | `number` | per format | Fixed decimals for the value and target. |
| `valueUnit` | `string` | — | Unit after the value and target, e.g. `"km/s"`. Currency and percent signs come from `format`. |
| `comparisonLabel` | `string` | `"vs last period"` | Caption beside the trend badge. |
| `semantics` | `"standard" \| "inverted" \| "neutral"` | `"standard"` | Whether up is good, down is good, or neither. |
| `targetValue` | `number \| null` | `null` | Shows the progress footer. |
| `targetLabel` | `string` | `"Goal"` | The footer's label. |
| `isLoading` | `boolean` | `false` | Shows a skeleton instead of the card. |
| `details` | `ReactNode` | — | The details panel's content. Without it there is no panel. |
| `detailsLabel` | `string` | `"Additional details"` | Accessible name of the panel. |
| `showCopyButton` | `boolean` | `true` | A button that copies the raw value. |
| `copyLabel` | `string` | `"Copy raw value"` | Accessible name of the copy button. |
| `copiedLabel` | `string` | `"Value copied"` | Announced after a copy. |
| `onActionClick` | `() => void` | — | Adds an action button, for example to open a report. |
| `actionLabel` | `string` | `"Open details"` | Accessible name of the action button. |
| `actionIcon` | `ReactNode` | external-link icon | The action button's icon. |
| `className` | `string` | — | An extra class on the outermost element, with or without a details panel. |

Types: `KpiProps`, `KpiChartType`, `KpiSemantics`, `KpiDetailRow`.

### `KpiDetails`

A ready-made list for `details`. Any other node works too.

| Prop | Type | Description |
| --- | --- | --- |
| `rows` | `{ label: string; value: string }[]` | The rows. An empty list renders nothing. |

## Behaviour

- **Details panel**: opens after a short pause on mouse hover or keyboard focus, and at once on a tap. It closes when the pointer or focus leaves, on a press outside the card, and on Escape. A tap on a button does not open it.
- **Keyboard**: the buttons lead to the panel. A card with details and no button takes focus itself, as a group named by its title.
- **Escape**: while the panel is open and focus is in the card or on nothing, the card closes it and marks the key press handled (`defaultPrevented`), so a page handler that respects that does not act on it as well. With focus in another widget, the key is left to that widget.
- **Loading**: `isLoading` shows a skeleton with `aria-busy`.
- **Errors** are yours to render: the card shows what it is given, so do not pass a placeholder value as if it were real.
- **Reduced motion**: every animation stops under `prefers-reduced-motion`.

## Right-to-left

The card follows the `dir` of the page, or of any ancestor: `<html dir="rtl">` is enough. Its layout is written in logical properties, so the title, the actions, the details panel and the target row mirror on their own, and the trend arrow and the chart are mirrored so time runs from the reading start. Pass the matching `locale` (`ar`, `he`, `fa`) for numbers in that language's digits and order.

## Theming

Dark mode follows the nearest ancestor with `data-theme="light"` or `data-theme="dark"`, or with the `dark` class; without either it follows the operating system.

Every colour, radius, font, spacing and duration is a token in `styles/tokens.css`, scoped to `.kpi-theme` and never set on `:root`, so the card cannot restyle your page. To change one, **set its `-override` on any ancestor**, not the token itself:

```css
.my-dashboard {
  --kpi-radius-override: 0.25rem;
  --kpi-font-sans-override: var(--font-sans);
  /* A colour override replaces the light and the dark value: */
  --kpi-card-override: var(--my-surface);
}
```

The override is inherited, so it wins without matching the card's selectors. An override that is a single colour applies in light and dark alike, so point it at a token of yours that already changes with your theme. Setting an override the card does not declare does nothing.

## Connecting data

Fetch in the parent and map the response to props. A client example:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Kpi } from "./kpi/kpi";

type Metric = { value: number; previousValue?: number; history?: number[] };

export function RevenueKpi() {
  const [metric, setMetric] = useState<Metric | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/metrics/mrr", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<Metric>;
      })
      .then(setMetric)
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, []);

  if (failed) return <p>Revenue is unavailable right now.</p>;

  return (
    <Kpi
      format="currency"
      historyData={metric?.history}
      isLoading={metric == null}
      previousValue={metric?.previousValue}
      title="Monthly recurring revenue"
      value={metric?.value ?? 0}
    />
  );
}
```

In a framework with server components, such as Next.js, fetch on the server and pass the result as props. `kpiRuntime.tsx` is the client module (`"use client"`); import from `kpi.tsx` as usual, from a server component too. `onActionClick` is a function, so a card that uses it has to be rendered from a client component.

Keep `historyData` oldest first, pass `previousValue` only when it is a real earlier reading, and use `semantics="inverted"` where a drop is good (latency, error rate, churn).

## Known limitations

- **Server rendering and number formats.** Values are formatted with `Intl.NumberFormat` during render. A server whose ICU data differs from the browser's (a different space character in `fr-FR`, `US$` for `$`) renders text the browser then corrects, which React reports as a hydration mismatch. It shows only where the server's and the browser's ICU versions format the locale differently; where it does, render the card on the client only.

## Licences

- The code is MIT licensed.
- The icons in `internal/icons.tsx` are path data from [Lucide](https://lucide.dev), ISC licence, © Lucide Contributors and © Cole Bemis (Feather). The notice is in that file.
