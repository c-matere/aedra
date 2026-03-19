// ─────────────────────────────────────────────
// Homeet · McKinsey Report — Type Definitions
// ─────────────────────────────────────────────

export type RiskLevel = "red" | "amber" | "green";
export type BadgeVariant = "green" | "amber" | "red" | "blue";
export type PaymentStatus = "ok" | "late" | "missed";

export interface HeatmapRow {
  name: string;
  unit: string;
  nov: PaymentStatus;
  dec: PaymentStatus;
  jan: PaymentStatus;
  feb: PaymentStatus;
  mar: PaymentStatus;
  ltv: number;
}

export interface RiskFlag {
  level: RiskLevel;
  label: string;
  detail: string;
}

export interface Recommendation {
  action: string;
  deadline: string;
}

export interface PatternInsight {
  tag: string;
  body: string;
}

export interface WaterfallRow {
  label: string;
  value: number;
  type: "positive" | "negative" | "total";
  note?: string;
}

export interface ReportData {
  // Portfolio meta
  portfolioName: string;
  agentName: string;
  month: string;
  generatedAt: string;

  // Top-line metrics
  totalUnits: number;
  occupiedUnits: number;
  occupancyRate: number;
  occupancyDelta: number; // pts vs last month
  totalRentDue: number;
  totalRentCollected: number;
  collectionRate: number;
  outstandingAmount: number;
  openMaintenanceIssues: number;
  resolvedMaintenanceIssues: number;

  // AI-generated content
  execSummary: string;
  execBadge: "Strong performance" | "Moderate" | "At Risk";

  // Charts
  paymentSplit: { mpesa: number; card: number; cash: number };
  occupancyTrend: { month: string; value: number }[];
  waterfall: WaterfallRow[];

  // Tables & analysis
  heatmap: HeatmapRow[];
  patterns: PatternInsight[];

  // Risk & recs
  risks: RiskFlag[];
  recommendations: Recommendation[];

  // ROI
  annualSubscriptionCost: number;
  estimatedAnnualSavings: number;
}
