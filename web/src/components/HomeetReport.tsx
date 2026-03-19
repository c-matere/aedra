"use client";

// ─────────────────────────────────────────────
// Homeet · McKinsey Portfolio Report Component
// Exactly aligned with user reference design
// ─────────────────────────────────────────────

import React, { useEffect, useRef } from "react";
import { ReportData, PaymentStatus, RiskLevel, BadgeVariant } from "../types/report";

// ── Helpers ──────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString("en-KE");
}

function fmtK(n: number): string {
  return Math.abs(n) >= 1000000
    ? `${(n / 1000000).toFixed(1)}M`
    : `${Math.round(n / 1000)}K`;
}

const HEAT_STYLES: Record<PaymentStatus, string> = {
  ok: "bg-[#eaf3de] text-[#3b6d11]",
  late: "bg-[#faeeda] text-[#854f0b]",
  missed: "bg-[#fcebeb] text-[#a32d2d]",
};

const HEAT_LABEL: Record<PaymentStatus, string> = {
  ok: "On time",
  late: "Late",
  missed: "Missed",
};

const RISK_DOT: Record<RiskLevel, string> = {
  red: "bg-[#e24b4a]",
  amber: "bg-[#ef9f27]",
  green: "bg-[#639922]",
};

const BADGE_STYLES: Record<BadgeVariant, string> = {
  green: "bg-[#eaf3de] text-[#3b6d11]",
  amber: "bg-[#faeeda] text-[#854f0b]",
  red: "bg-[#fcebeb] text-[#a32d2d]",
  blue: "bg-[#e6f1fb] text-[#185fa5]",
};

// ── Sub-components ───────────────────────────

function SectionHeader({
  title,
  badge,
  badgeVariant = "blue",
}: {
  title: string;
  badge?: string;
  badgeVariant?: BadgeVariant;
}) {
  return (
    <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100">
      <span className="text-[10px] font-mono font-medium tracking-[0.12em] uppercase text-[#637285]">
        {title}
      </span>
      {badge && (
        <span
          className={`text-[10px] font-mono px-2 py-0.5 rounded ${BADGE_STYLES[badgeVariant]}`}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  delta,
  deltaPositive,
}: {
  label: string;
  value: string;
  delta: string;
  deltaPositive?: boolean;
}) {
  return (
    <div className="px-5 py-4 border-r border-gray-100 last:border-r-0">
      <div className="text-[10px] font-mono tracking-[0.05em] uppercase text-[#637285] mb-1.5">
        {label}
      </div>
      <div className="text-2xl font-medium text-[#0f1923] leading-none">
        {value}
      </div>
      <div
        className={`text-[11px] font-mono mt-1 ${
          deltaPositive === true
            ? "text-[#1d9e75]"
            : deltaPositive === false
            ? "text-[#d85a30]"
            : "text-[#637285]"
        }`}
      >
        {delta}
      </div>
    </div>
  );
}

// ── Chart Components (Chart.js via useEffect) ─

function CollectionChart({
  due,
  collected,
  outstanding,
}: {
  due: number;
  collected: number;
  outstanding: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let chart: any;
    import("chart.js/auto").then(({ Chart }) => {
      if (!ref.current) return;
      chart = new Chart(ref.current, {
        type: "bar",
        data: {
          labels: ["Target", "Collected", "Outstanding"],
          datasets: [
            {
              data: [due / 1000, collected / 1000, outstanding / 1000],
              backgroundColor: ["#b5d4f4", "#1d9e75", "#f0997b"],
              borderWidth: 0,
              borderRadius: 4,
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              ticks: {
                font: { size: 10, family: "monospace" },
                callback: (v) => `${v}K`,
                color: "#888780",
              },
              grid: { color: "rgba(128,128,128,0.1)" },
            },
            y: {
              ticks: {
                font: { size: 11, family: "monospace" },
                color: "#888780",
              },
              grid: { display: false },
            },
          },
        },
      });
    });
    return () => {
      if (chart) chart.destroy();
    };
  }, [due, collected, outstanding]);

  return <canvas ref={ref} />;
}

function PaymentDonut({
  mpesa,
  card,
  cash,
}: {
  mpesa: number;
  card: number;
  cash: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let chart: any;
    import("chart.js/auto").then(({ Chart }) => {
      if (!ref.current) return;
      chart = new Chart(ref.current, {
        type: "doughnut",
        data: {
          labels: ["M-Pesa", "Card", "Cash"],
          datasets: [
            {
              data: [mpesa, card, cash],
              backgroundColor: ["#1d9e75", "#378add", "#888780"],
              borderWidth: 0,
              hoverOffset: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "70%",
          plugins: { legend: { display: false } },
        },
      });
    });
    return () => {
      if (chart) chart.destroy();
    };
  }, [mpesa, card, cash]);

  return <canvas ref={ref} />;
}

function OccupancyTrend({
  data,
}: {
  data: { month: string; value: number }[];
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let chart: any;
    import("chart.js/auto").then(({ Chart }) => {
      if (!ref.current) return;
      chart = new Chart(ref.current, {
        type: "line",
        data: {
          labels: data.map((d) => d.month),
          datasets: [
            {
              data: data.map((d) => d.value),
              borderColor: "#0f1923",
              backgroundColor: "rgba(15,25,35,0.07)",
              borderWidth: 2,
              fill: true,
              tension: 0.4,
              pointRadius: 4,
              pointBackgroundColor: "#0f1923",
              pointBorderColor: "#fff",
              pointBorderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              min: 60,
              max: 100,
              ticks: {
                font: { size: 10, family: "monospace" },
                callback: (v) => `${v}%`,
                color: "#888780",
              },
              grid: { color: "rgba(128,128,128,0.1)" },
            },
            x: {
              ticks: {
                font: { size: 10, family: "monospace" },
                color: "#888780",
              },
              grid: { display: false },
            },
          },
        },
      });
    });
    return () => {
      if (chart) chart.destroy();
    };
  }, [data]);

  return <canvas ref={ref} />;
}

// ── Main Report Component ─────────────────────

export default function HomeetReport({ data }: { data: ReportData }) {
  const roi = Math.round(
    ((data.estimatedAnnualSavings - data.annualSubscriptionCost) /
      data.annualSubscriptionCost) *
      100
  );

  const execBadgeVariant: BadgeVariant =
    data.execBadge?.toLowerCase().includes("strong")
      ? "green"
      : data.execBadge?.toLowerCase().includes("risk")
      ? "red"
      : "amber";

  return (
    <div className="max-w-[900px] mx-auto py-6 px-0 font-['Outfit',sans-serif] text-[#0f1923]">

      {/* ── COVER ─────────────────────────────── */}
      <div className="rounded-xl border border-gray-100 overflow-hidden mb-5 bg-white">
        {/* Dark header */}
        <div className="bg-[#0f1923] px-8 py-8">
          <p className="text-[10px] font-mono tracking-[0.14em] uppercase text-[#637285] mb-2.5">
            Homeet Intelligence · Monthly Portfolio Report
          </p>
          <h1 className="font-serif text-[30px] font-normal text-white leading-[1.15] mb-1.5">
            {data.portfolioName}
          </h1>
          <p className="text-[12px] font-mono text-[#8a9ab0] tracking-[0.04em]">
            {data.month} · Managed by {data.agentName} · Prepared by Homeet AI
          </p>
        </div>

        {/* Metric strip */}
        <div className="grid grid-cols-4 bg-[#f8fafc] divide-x divide-gray-100">
          <MetricCard
            label="Occupancy"
            value={`${data.occupancyRate}%`}
            delta={`↑ ${data.occupancyDelta}pts vs last month`}
            deltaPositive={true}
          />
          <MetricCard
            label="Collection rate"
            value={`${data.collectionRate}%`}
            delta="Best in 6 months"
            deltaPositive={true}
          />
          <MetricCard
            label="Outstanding"
            value={`KES ${fmtK(data.outstandingAmount)}`}
            delta={`${data.heatmap.filter(p => p.mar === 'missed').length} tenants overdue`}
            deltaPositive={false}
          />
          <MetricCard
            label="Open issues"
            value={String(data.openMaintenanceIssues)}
            delta={`${data.resolvedMaintenanceIssues} resolved this month`}
          />
        </div>
      </div>

      {/* ── EXECUTIVE SUMMARY ─────────────────── */}
      <div className="rounded-xl border border-gray-100 p-5 mb-4 bg-white">
        <SectionHeader
          title="Executive summary"
          badge={data.execBadge}
          badgeVariant={execBadgeVariant}
        />
        <div className="bg-[#f8fafc] border-l-[3px] border-[#0f1923] px-5 py-4 rounded-r-lg text-sm leading-[1.85] text-[#0f1923]">
          {data.execSummary}
        </div>
      </div>

      {/* ── CHARTS ROW ────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Collection */}
        <div className="rounded-xl border border-gray-100 p-5 bg-white">
          <SectionHeader title="Rent collection" />
          <p className="text-[10px] font-mono tracking-[0.07em] uppercase text-[#637285] mb-2">
            Collected vs target (KES thousands)
          </p>
          <div className="relative h-[185px]">
            <CollectionChart
              due={data.totalRentDue}
              collected={data.totalRentCollected}
              outstanding={data.outstandingAmount}
            />
          </div>
        </div>

        {/* Payment methods */}
        <div className="rounded-xl border border-gray-100 p-5 bg-white">
          <SectionHeader title="Payment methods" />
          <p className="text-[10px] font-mono tracking-[0.07em] uppercase text-[#637285] mb-2">
            Distribution — {data.month}
          </p>
          <div className="flex gap-[14px] mb-2.5 flex-wrap">
            {[
              { label: "M-Pesa", val: data.paymentSplit.mpesa, color: "bg-[#1d9e75]" },
              { label: "Card", val: data.paymentSplit.card, color: "bg-[#378add]" },
              { label: "Cash", val: data.paymentSplit.cash, color: "bg-[#888780]" },
            ].map((item) => (
              <span
                key={item.label}
                className="flex items-center gap-[5px] text-[11px] font-mono text-[#637285]"
              >
                <span className={`w-2.5 h-2.5 rounded-sm ${item.color}`} />
                {item.label} {item.val}%
              </span>
            ))}
          </div>
          <div className="relative h-[145px]">
            <PaymentDonut
              mpesa={data.paymentSplit.mpesa}
              card={data.paymentSplit.card}
              cash={data.paymentSplit.cash}
            />
          </div>
        </div>
      </div>

      {/* ── OCCUPANCY TREND ───────────────────── */}
      {data.occupancyTrend.length > 0 && (
        <div className="rounded-xl border border-gray-100 p-5 mb-4 bg-white">
          <SectionHeader title="Occupancy trend" badge="6-month view" badgeVariant="blue" />
          <p className="text-[10px] font-mono tracking-[0.07em] uppercase text-[#637285] mb-2">
            Portfolio occupancy rate (%)
          </p>
          <div className="relative h-[150px]">
            <OccupancyTrend data={data.occupancyTrend} />
          </div>
        </div>
      )}

      {/* ── NET YIELD WATERFALL ───────────────── */}
      <div className="rounded-xl border border-gray-100 p-5 mb-4 bg-white">
        <SectionHeader title="Net yield waterfall" badge="Block C flagged" badgeVariant="amber" />
        <p className="text-[13.5px] leading-[1.8] text-[#0f1923] mb-4">
          Gross rent masks a significant yield gap across blocks. Block C generates KES 420,000 in gross rent but absorbs KES 187,000 in maintenance — a cost ratio 3.1× higher than Block A. On a net basis, Block C is your least profitable asset despite highest per-unit rent.
        </p>
        <div className="space-y-[6px] mt-2">
          {data.waterfall.map((row) => {
            const maxVal = data.totalRentDue;
            const widthPct = Math.max(8, Math.round((Math.abs(row.value) / maxVal) * 100));
            const rowStyles =
              row.type === "total"
                ? "bg-[#eaf3de] text-[#3b6d11]"
                : row.type === "negative"
                ? "bg-[#fcebeb] text-[#a32d2d]"
                : row.label === "Arrears" || row.label === "Maintenance"
                ? "bg-[#faeeda] text-[#854f0b]"
                : "bg-[#b5d4f4] text-[#185fa5]";

            return (
              <div key={row.label} className="flex items-center gap-2 text-[12px] font-mono">
                <span className="w-[110px] text-[11px] text-[#637285] shrink-0">{row.label}</span>
                <div
                  className={`h-[22px] rounded-[3px] flex items-center px-2 text-[11px] font-medium whitespace-nowrap ${rowStyles}`}
                  style={{ width: `${widthPct}%`, minWidth: "40px" }}
                >
                  {row.value < 0 ? "− " : ""}KES {fmt(Math.abs(row.value))}
                </div>
                {row.note && (
                  <span className="text-[11px] text-[#637285] ml-[6px]">{row.note}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── HEATMAP ───────────────────────────── */}
      <div className="rounded-xl border border-gray-100 p-5 mb-4 bg-white">
        <SectionHeader
          title="Tenant payment heatmap"
          badge={`${data.heatmap.filter((r) => r.ltv < 70).length} flagged`}
          badgeVariant="amber"
        />
        <p className="text-[13.5px] leading-[1.8] text-[#0f1923] mb-4">
          Payment consistency is strong across 80% of the portfolio. Three tenants show a pattern of late payment clustering in Q1 — historically correlated with post-holiday financial pressure.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] font-mono border-collapse">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-[10px] font-normal text-[#637285] tracking-[0.06em] uppercase py-[6px] px-2 text-left">Tenant</th>
                <th className="text-[10px] font-normal text-[#637285] tracking-[0.06em] uppercase py-[6px] px-2 text-center">Unit</th>
                <th className="text-[10px] font-normal text-[#637285] tracking-[0.06em] uppercase py-[6px] px-2 text-center">Nov</th>
                <th className="text-[10px] font-normal text-[#637285] tracking-[0.06em] uppercase py-[6px] px-2 text-center">Dec</th>
                <th className="text-[10px] font-normal text-[#637285] tracking-[0.06em] uppercase py-[6px] px-2 text-center">Jan</th>
                <th className="text-[10px] font-normal text-[#637285] tracking-[0.06em] uppercase py-[6px] px-2 text-center">Feb</th>
                <th className="text-[10px] font-normal text-[#637285] tracking-[0.06em] uppercase py-[6px] px-2 text-center">Mar</th>
                <th className="text-[10px] font-normal text-[#637285] tracking-[0.06em] uppercase py-[6px] px-2 text-center">LTV score</th>
              </tr>
            </thead>
            <tbody>
              {data.heatmap.map((row) => (
                <tr key={row.name} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                  <td className="py-[5px] px-2 text-[#0f1923] font-normal text-[12px]">
                    {row.name}
                  </td>
                  <td className="py-[5px] px-2 text-center text-[#637285]">{row.unit}</td>
                  {(["nov", "dec", "jan", "feb", "mar"] as const).map((m) => (
                    <td key={m} className="py-[5px] px-2 text-center">
                      <span
                        className={`inline-block text-[10px] px-1.5 py-0.5 rounded-[3px] border border-transparent ${HEAT_STYLES[row[m] || 'ok']}`}
                      >
                        {HEAT_LABEL[row[m] || 'ok']}
                      </span>
                    </td>
                  ))}
                  <td className="py-[5px] px-2 text-center">
                    <span
                      className={`inline-block text-[11px] font-medium px-1.5 py-0.5 rounded-[3px] ${
                        row.ltv >= 80 ? "bg-[#eaf3de] text-[#3b6d11]" : row.ltv >= 60 ? "bg-[#faeeda] text-[#854f0b]" : "bg-[#fcebeb] text-[#a32d2d]"
                      }`}
                    >
                      {row.ltv}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── DEEP PATTERN ANALYSIS ─────────────── */}
      <div className="rounded-xl border border-gray-100 p-5 mb-4 bg-white">
        <SectionHeader title="Deep pattern analysis" badge="AI insight layer" badgeVariant="blue" />
        <div className="space-y-2.5">
          {data.patterns.map((p) => (
            <div key={p.tag} className="bg-[#f8fafc] rounded-lg p-5 text-[#0f1923]">
              <p className="text-[10px] font-mono tracking-[0.08em] uppercase text-[#637285] mb-1.5">
                {p.tag}
              </p>
              <p className="text-[13px] leading-[1.75]">{p.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── ROI STRIP ─────────────────────────── */}
      <div className="rounded-xl border border-gray-100 p-5 mb-4 bg-white">
        <SectionHeader title="Aedra ROI — this portfolio" badge="Positive" badgeVariant="green" />
        <div className="grid grid-cols-3 divide-x divide-gray-100 border border-gray-100 rounded-lg overflow-hidden mt-4">
          {[
            { label: "Annual subscription", value: `KES ${fmtK(data.annualSubscriptionCost)}`, color: "" },
            { label: "Estimated savings", value: `KES ${fmtK(data.estimatedAnnualSavings)}`, color: "text-[#1d9e75]" },
            { label: "Return on investment", value: `${roi}%`, color: "text-[#1d9e75]" },
          ].map((item) => (
            <div key={item.label} className="px-4 py-[0.9rem] text-center">
              <div className="text-[10px] font-mono tracking-[0.05em] uppercase text-[#637285] mb-1">
                {item.label}
              </div>
              <div className={`text-[18px] font-medium ${item.color || "text-[#0f1923]"}`}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RISK FLAGS ────────────────────────── */}
      <div className="rounded-xl border border-gray-100 p-5 mb-4 bg-white">
        <SectionHeader
          title="Risk flags"
          badge={`${data.risks.filter((r) => r.level !== "green").length} flags`}
          badgeVariant="red"
        />
        <ul className="list-none">
          {data.risks.map((risk) => (
            <li key={risk.label} className="flex gap-[10px] py-[11px] border-b border-gray-100 last:border-0 items-start">
              <span
                className={`w-2 h-2 rounded-full mt-[5px] shrink-0 ${RISK_DOT[risk.level]}`}
              />
              <div>
                <p className="text-[10px] font-mono tracking-[0.05em] uppercase text-[#637285] mb-0.5">
                  {risk.label}
                </p>
                <p className="text-[13px] leading-[1.65] text-[#0f1923]">{risk.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* ── RECOMMENDATIONS ───────────────────── */}
      <div className="rounded-xl border border-gray-100 p-5 mb-4 bg-white">
        <SectionHeader
          title="Recommendations"
          badge={`${data.recommendations.length} actions`}
          badgeVariant="blue"
        />
        <ul className="list-none">
          {data.recommendations.map((rec, i) => (
            <li key={i} className="flex gap-[14px] py-[11px] border-b border-gray-100 last:border-0 items-start">
              <span className="text-[10px] font-mono text-[#637285] mt-[3px] shrink-0 min-w-[18px]">
                0{i + 1}
              </span>
              <div>
                <p className="text-[13px] leading-[1.65] text-[#0f1923]">{rec.action}</p>
                <p className="text-[11px] font-mono text-amber-600 mt-1">
                  → {rec.deadline}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* ── FOOTER ────────────────────────────── */}
      <div className="text-[10px] font-mono text-[#637285] text-center pt-5 border-t border-gray-100 tracking-[0.04em] mt-2">
        Generated by Homeet Intelligence · Powered by Aedra · {data.generatedAt} ·{" "}
        {data.portfolioName} · Confidential
      </div>
    </div>
  );
}
ons.map((rec, i) => (
            <li key={i} className="flex gap-4 py-3 first:pt-0 last:pb-0">
              <span className="text-[10px] font-mono text-gray-400 mt-0.5 shrink-0">
                0{i + 1}
              </span>
              <div>
                <p className="text-sm leading-relaxed text-gray-800">{rec.action}</p>
                <p className="text-[11px] font-mono text-amber-600 mt-1">
                  → {rec.deadline}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* ── FOOTER ────────────────────────────── */}
      <div className="text-[10px] font-mono text-gray-400 text-center py-4 border-t border-gray-100 tracking-wide">
        Generated by Homeet Intelligence · Powered by Aedra · {data.generatedAt} ·{" "}
        {data.portfolioName} · Confidential
      </div>
    </div>
  );
}
