// ─────────────────────────────────────────────
// Homeet · AI Report Prompt Builder
// Feed structured portfolio data → get McKinsey-
// grade analysis back as typed JSON
// ─────────────────────────────────────────────

import Anthropic from "@anthropic-ai/sdk";
import { ReportData } from "../types/report";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ── Raw portfolio input from your Homeet DB ──
export interface PortfolioInput {
  portfolioName: string;
  agentName: string;
  month: string;
  totalUnits: number;
  occupiedUnits: number;
  totalRentDue: number;
  totalRentCollected: number;
  openMaintenanceIssues: number;
  resolvedMaintenanceIssues: number;
  // Pass raw tenant payment rows for AI to analyse
  tenantPayments: {
    name: string;
    unit: string;
    payments: { month: string; status: "ok" | "late" | "missed" }[];
  }[];
  // Optional: last 6 months occupancy for trend
  occupancyHistory?: { month: string; value: number }[];
}

// ── Layer 1: Data Analyst Prompt ──
// Finds non-obvious patterns across the portfolio
function buildAnalystPrompt(input: PortfolioInput): string {
  const collectionRate = Math.round(
    (input.totalRentCollected / input.totalRentDue) * 100
  );
  const occupancyRate = Math.round(
    (input.occupiedUnits / input.totalUnits) * 100
  );
  const outstanding = input.totalRentDue - input.totalRentCollected;

  return `You are a senior McKinsey property analyst. You see patterns invisible to someone 
looking at individual metrics. Analyse this Mombasa portfolio data and return ONLY valid JSON.

PORTFOLIO DATA:
- Name: ${input.portfolioName}
- Agent: ${input.agentName}  
- Month: ${input.month}
- Units: ${input.occupiedUnits}/${input.totalUnits} occupied (${occupancyRate}%)
- Rent due: KES ${input.totalRentDue.toLocaleString()}
- Collected: KES ${input.totalRentCollected.toLocaleString()} (${collectionRate}%)
- Outstanding: KES ${outstanding.toLocaleString()}
- Maintenance: ${input.openMaintenanceIssues} open, ${input.resolvedMaintenanceIssues} resolved

TENANT PAYMENT HISTORY:
${JSON.stringify(input.tenantPayments, null, 2)}

Return this EXACT JSON structure (no markdown, no backticks, no preamble):
{
  "execSummary": "3 sentences. Lead with strongest number. Name one specific risk. State one forward action. No hedging. No passive voice. Max 20 words per sentence.",
  "execBadge": "Strong performance | Moderate | At Risk",
  "heatmapInsight": "2 sentences on payment consistency patterns. Specific. Use numbers.",
  "patterns": [
    {
      "tag": "Pattern 01 · [name the pattern]",
      "body": "3-4 sentences. Reveal a non-obvious pattern. Quantify it. Explain the likely cause. State the implication for the agent."
    },
    {
      "tag": "Pattern 02 · [name the pattern]",
      "body": "..."
    },
    {
      "tag": "Pattern 03 · [name the pattern]", 
      "body": "..."
    }
  ],
  "risks": [
    {
      "level": "red | amber | green",
      "label": "Severity · Tenant/Issue name",
      "detail": "1-2 sentences. Specific numbers. Timeline. Consequence of inaction."
    }
  ],
  "recommendations": [
    {
      "action": "Specific action. Who does what. Include cost/benefit if relevant.",
      "deadline": "Specific date or timeframe"
    }
  ],
  "ltv": [
    { "name": "tenant name", "unit": "unit id", "score": 85 }
  ],
  "paymentSplit": { "mpesa": 70, "card": 20, "cash": 10 },
  "occupancyDelta": 4
}`;
}

// ── Layer 2: Narrative Enforcer ──
// Takes raw AI output and makes it sharper
function buildNarrativePrompt(rawAnalysis: string): string {
  return `You are an editor at McKinsey. Sharpen this property report analysis.
Rules:
- Every sentence earns its place or is cut
- No filler: never use "it is worth noting", "it can be seen", "in conclusion"
- Lead with the number, then the insight  
- Name risks directly — never soften
- Recommendations must have a specific deadline
- Max 20 words per sentence
- No passive voice

Raw analysis to sharpen:
${rawAnalysis}

Return the same JSON structure, rewritten. ONLY valid JSON, no markdown.`;
}

// ── Main generator function ──
export async function generateReportWithAI(
  input: PortfolioInput,
  existingData: Partial<ReportData> = {}
): Promise<Partial<ReportData>> {
  
  // Layer 1: Analyst pass
  const analystResponse = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: buildAnalystPrompt(input),
      },
    ],
  });

  const rawAnalysis =
    analystResponse.content[0].type === "text"
      ? analystResponse.content[0].text
      : "";

  // Layer 2: Narrative enforcer pass
  const narrativeResponse = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: buildNarrativePrompt(rawAnalysis),
      },
    ],
  });

  const finalText =
    narrativeResponse.content[0].type === "text"
      ? narrativeResponse.content[0].text
      : "{}";

  // Parse and clean
  const clean = finalText.replace(/```json|```/g, "").trim();
  const ai = JSON.parse(clean);

  // Merge AI output with computed fields
  const collectionRate = Math.round(
    (input.totalRentCollected / input.totalRentDue) * 100
  );
  const occupancyRate = Math.round(
    (input.occupiedUnits / input.totalUnits) * 100
  );

  return {
    portfolioName: input.portfolioName,
    agentName: input.agentName,
    month: input.month,
    generatedAt: new Date().toLocaleDateString("en-KE"),
    totalUnits: input.totalUnits,
    occupiedUnits: input.occupiedUnits,
    occupancyRate,
    occupancyDelta: ai.occupancyDelta || 0,
    totalRentDue: input.totalRentDue,
    totalRentCollected: input.totalRentCollected,
    collectionRate,
    outstandingAmount: input.totalRentDue - input.totalRentCollected,
    openMaintenanceIssues: input.openMaintenanceIssues,
    resolvedMaintenanceIssues: input.resolvedMaintenanceIssues,
    execSummary: ai.execSummary,
    execBadge: ai.execBadge || "Strong performance",
    paymentSplit: ai.paymentSplit || { mpesa: 70, card: 20, cash: 10 },
    occupancyTrend: input.occupancyHistory || [],
    patterns: ai.patterns || [],
    risks: ai.risks || [],
    recommendations: ai.recommendations || [],
    ...existingData,
  };
}
