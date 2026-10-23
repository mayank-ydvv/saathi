/**
 * shadcn/ui chart wrapper (ui.shadcn.com/charts), trimmed: `ChartContainer` sets the colours
 * from a config as --color-<key> variables and makes the Recharts chart responsive, with the
 * same axis/grid styling hooks, mapped to this app's tokens. The tooltip is a small version of
 * shadcn's ChartTooltipContent (dot indicator, label + one row per series).
 */
import { useId, type ComponentProps, type ReactNode } from "react";
import { ResponsiveContainer } from "recharts";
import { cn } from "../../lib/cn";

export type ChartConfig = Record<string, { label?: ReactNode; color?: string }>;

export function ChartContainer({
  config,
  className,
  children,
  ...props
}: ComponentProps<"div"> & { config: ChartConfig; children: ComponentProps<typeof ResponsiveContainer>["children"] }) {
  const id = `chart-${useId().replace(/:/g, "")}`;
  const vars = Object.entries(config)
    .filter(([, c]) => c.color)
    .map(([k, c]) => `--color-${k}: ${c.color};`)
    .join(" ");
  return (
    <div
      data-chart={id}
      className={cn(
        "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted [&_.recharts-cartesian-grid_line]:stroke-line [&_.recharts-curve.recharts-tooltip-cursor]:stroke-line [&_.recharts-layer]:outline-hidden [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-line [&_.recharts-radial-bar-background-sector]:fill-surface-2 [&_.recharts-sector]:outline-hidden [&_.recharts-surface]:outline-hidden",
        className,
      )}
      {...props}
    >
      {vars ? <style>{`[data-chart=${id}] { ${vars} }`}</style> : null}
      <ResponsiveContainer initialDimension={{ width: 320, height: 200 }}>{children}</ResponsiveContainer>
    </div>
  );
}

type TooltipItem = { name?: string | number; value?: unknown; dataKey?: unknown; color?: string };

export function ChartTooltipContent({
  active,
  payload,
  label,
  config,
  labelFormatter,
  valueFormatter = (v) => String(v),
}: {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string | number;
  config: ChartConfig;
  labelFormatter?: (label: string | number | undefined) => ReactNode;
  valueFormatter?: (value: unknown) => ReactNode;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="grid min-w-32 gap-1.5 rounded-[6px] border border-line bg-surface px-2.5 py-1.5 text-xs text-ink">
      <div>{labelFormatter ? labelFormatter(label) : label}</div>
      {payload.map((item) => {
        const key = String(item.dataKey ?? item.name ?? "");
        return (
          <div key={key} className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: item.color ?? `var(--color-${key})` }} />
            <span className="text-muted">{config[key]?.label ?? key}</span>
            <span className="ml-auto tabular-nums">{valueFormatter(item.value)}</span>
          </div>
        );
      })}
    </div>
  );
}
