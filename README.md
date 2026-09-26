# Components

React components by Pavel Barchanski. Each one is self-contained: its own scoped CSS, no dependency beyond React, and it follows your light or dark theme.

| Component | What it is |
| --- | --- |
| [KPI card](registry/kpi/README.md) | One metric: value, trend, sparkline, progress to a target, and a details panel. |

## Install

With the [shadcn CLI](https://ui.shadcn.com/docs/cli), in a project that has a `components.json`:

```bash
npx shadcn@latest add https://raw.githubusercontent.com/b-paya/components/main/public/r/kpi.json
```

The files land in `components/kpi/`. They are TypeScript and are not transpiled on install, so the project needs TypeScript (`"tsx": true` in `components.json`). Without the CLI, copy `registry/kpi/` into your project; its README lists what to keep.

## Licence

MIT, © Pavel Barchanski. Vendored third-party code keeps its own notice in the file it lives in.
