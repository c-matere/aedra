"use client";

// ─────────────────────────────────────────────
// app/reports/[id]/page.tsx
// Example Next.js page — fetches portfolio data,
// generates AI analysis, renders the report
// ─────────────────────────────────────────────

import HomeetReport from "@/components/HomeetReport";
import { generateReportWithAI, PortfolioInput } from "@/lib/generateReport";
import { ReportData } from "@/types/report";
import React, { useEffect, useState } from "react";

export default function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);
  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";
        const res = await fetch(`${apiUrl}/reports/${id}/data`, {
          // In a real app, you'd pass the auth token here.
          // For Puppeteer internal requests, we might use a secret header.
          headers: {
            "x-internal-secret": process.env.INTERNAL_REPORT_SECRET || "aedra-secret-123",
          },
        });

        if (!res.ok) throw new Error(`Failed to fetch report data: ${res.statusText}`);
        
        const portfolioInput: PortfolioInput = await res.json();
        
        // Generate AI analysis
        const aiFields = await generateReportWithAI(portfolioInput, {
          annualSubscriptionCost: 54000,
          estimatedAnnualSavings: 122000,
          // Waterfall would normally be computed or provided by AI
          waterfall: [
            { label: "Gross rent", value: portfolioInput.totalRentDue, type: "positive" },
            { label: "Vacancies", value: -155000, type: "negative", note: "2 units vacant" },
            { label: "Arrears", value: -155000, type: "negative", note: "3 tenants" },
            { label: "Maintenance", value: -210000, type: "negative", note: "Block C heavy" },
            { label: "Net yield", value: portfolioInput.totalRentCollected - 210000, type: "total" },
          ],
          heatmap: portfolioInput.tenantPayments.map((t: any) => ({
            name: t.name,
            unit: t.unit,
            nov: "ok", dec: "ok", jan: "ok", feb: "ok", mar: "ok",
            ltv: 90,
          })) as any,
        });

        setReport(aiFields as ReportData);
      } catch (err: any) {
        console.error(err);
        setError(err.message);
      }
    }
    init();
  }, [id]);

  if (error) return <div className="p-10 text-red-500">Error: {error}</div>;
  if (!report) return <div className="p-10 text-gray-400">Loading intelligence...</div>;

  return (
    <main className="min-h-screen bg-gray-50 report-ready">
      <HomeetReport data={report} />
    </main>
  );
}
