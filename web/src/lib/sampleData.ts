// ─────────────────────────────────────────────
// Homeet · Sample Report Data
// Replace with live data from your Homeet API
// ─────────────────────────────────────────────

import { ReportData } from "../types/report";

export const sampleReport: ReportData = {
  portfolioName: "Bahari Ridge Holdings",
  agentName: "Zawadi Mwangi",
  month: "March 2026",
  generatedAt: "March 14, 2026",

  totalUnits: 25,
  occupiedUnits: 23,
  occupancyRate: 92,
  occupancyDelta: 4,
  totalRentDue: 2590000,
  totalRentCollected: 2435000,
  collectionRate: 94,
  outstandingAmount: 155000,
  openMaintenanceIssues: 2,
  resolvedMaintenanceIssues: 5,

  execSummary:
    "Bahari Ridge Holdings delivered its strongest collection month since September 2025, with KES 2.43M recovered against a KES 2.59M target — a 94% rate driven by Aedra's automated reminder cadence introduced in February. One structural risk requires immediate attention: Block C's net yield has deteriorated to 6.1% after maintenance costs, underperforming the portfolio average of 9.4% despite commanding above-average rents. Prioritise Block C maintenance audit and tenant retention action on Unit 7B before the April cycle opens.",

  execBadge: "Strong performance",

  paymentSplit: { mpesa: 71, card: 18, cash: 11 },

  occupancyTrend: [
    { month: "Oct", value: 78 },
    { month: "Nov", value: 80 },
    { month: "Dec", value: 76 },
    { month: "Jan", value: 83 },
    { month: "Feb", value: 88 },
    { month: "Mar", value: 92 },
  ],

  waterfall: [
    { label: "Gross rent", value: 2590000, type: "positive" },
    { label: "Vacancies", value: -155000, type: "negative", note: "2 units vacant" },
    { label: "Arrears", value: -155000, type: "negative", note: "3 tenants" },
    { label: "Maintenance", value: -210000, type: "negative", note: "Block C heavy" },
    { label: "Net yield", value: 2070000, type: "total" },
  ],

  heatmap: [
    { name: "Amina Wanjiru", unit: "A1", nov: "ok", dec: "ok", jan: "ok", feb: "ok", m: "ok" as any, ltv: 97 } as any,
    { name: "David Otieno", unit: "A3", nov: "ok", dec: "ok", jan: "late", feb: "ok", mar: "ok", ltv: 84 },
    { name: "Sarah Kimani", unit: "B2", nov: "ok", dec: "late", jan: "late", feb: "late", mar: "ok", ltv: 61 },
    { name: "Noah Mwenda", unit: "B5", nov: "ok", dec: "ok", jan: "ok", feb: "late", mar: "late", ltv: 68 },
    { name: "Omar Faraj", unit: "C4", nov: "ok", dec: "late", jan: "missed", feb: "missed", mar: "missed", ltv: 22 },
    { name: "Fatuma Hassan", unit: "C6", nov: "ok", dec: "ok", jan: "ok", feb: "ok", mar: "ok", ltv: 99 },
    { name: "James Kariuki", unit: "D2", nov: "late", dec: "ok", jan: "ok", feb: "ok", mar: "ok", ltv: 79 },
  ],

  patterns: [
    {
      tag: "Pattern 01 · Intake cohort risk",
      body: "Tenants who moved in between June–August 2024 show a 2.3× higher late payment rate than those onboarded in other periods. Of your current 4 late payers, 3 belong to this cohort. The likely driver is that June–August move-ins correlate with post-Ramadan relocation activity — a segment with higher income variability. Recommend tightening income verification for this seasonal intake window going forward.",
    },
    {
      tag: "Pattern 02 · Cash payment decline signal",
      body: "Cash payments have dropped from 23% to 11% over 6 months — a positive digital adoption trend. However, two tenants who previously paid via M-Pesa have reverted to cash in the last 60 days. Historical data shows cash reversion precedes missed payments in 68% of similar cases within this portfolio. Both tenants warrant a proactive check-in before April's cycle.",
    },
    {
      tag: "Pattern 03 · Block C yield trap",
      body: "Block C commands the highest average rent in the portfolio at KES 28,500/unit but generates the lowest net yield at 6.1%. The maintenance cost per unit in Block C is KES 3,116/month vs a portfolio average of KES 875/month. This is not a rent pricing problem — it is a structural maintenance problem silently eroding returns. A one-time infrastructure audit could recover KES 140,000+ annually in net yield.",
    },
    {
      tag: "Pattern 04 · Vacancy gap cost",
      body: "Your average vacancy gap is 19 days. At a blended rent of KES 24,200/month, each turnover costs KES 15,300 in lost income. You had 6 turnovers in the last 12 months — total vacancy cost: KES 91,800. Aedra's move-intent detection has flagged 2 tenants showing early departure signals this month. Acting now could protect KES 30,600 in income.",
    },
  ],

  risks: [
    {
      level: "red",
      label: "Critical · Omar Faraj — Unit C4",
      detail:
        "Three consecutive missed payments totalling KES 85,500. Tenant has not responded to 4 Aedra messages in 18 days. Legal notice threshold reached. Recommend formal notice issuance by March 18th — delay beyond this point reduces recovery probability to below 30% based on portfolio history.",
    },
    {
      level: "amber",
      label: "Watch · Sarah Kimani — Unit B2",
      detail:
        "Three late payments in four months. Recovered this month but the pattern is consistent with pre-default behaviour. She has begun browsing 1-bedroom listings on Homeet in a lower price band — a move-intent signal. Proactive retention conversation recommended before April 1st.",
    },
    {
      level: "amber",
      label: "Watch · Block C structural costs",
      detail:
        "Maintenance spend in Block C has exceeded budget for 4 consecutive months. Net yield has compressed from 9.8% to 6.1% over this period. Without intervention, Block C will become cash-flow negative by June 2026 at the current trajectory.",
    },
  ],

  recommendations: [
    {
      action:
        "Issue formal demand notice to Omar Faraj (Unit C4). Aedra can generate the notice automatically — agent to review and send via WhatsApp with read receipt. If no response within 7 days, escalate to formal eviction process.",
      deadline: "Wednesday March 18th",
    },
    {
      action:
        "Commission a Block C infrastructure audit. Target: identify root cause of recurring maintenance spend. Estimated resolution investment: KES 80,000–120,000. Estimated annual yield recovery: KES 140,000+. Payback period under 12 months.",
      deadline: "March 31st",
    },
    {
      action:
        "Initiate retention conversation with Sarah Kimani (Unit B2). Her Homeet browsing activity suggests price-shopping. A rent freeze offer or minor upgrade may cost KES 15,000 but prevent a KES 15,300 vacancy gap.",
      deadline: "Before April 1st",
    },
    {
      action:
        "Pre-list Unit C4 on Homeet immediately. Current market absorption rate for 2BR units in this zone is 11 days. Starting the listing now ensures zero vacancy gap upon Omar's exit.",
      deadline: "Today",
    },
  ],

  annualSubscriptionCost: 54000,
  estimatedAnnualSavings: 122000,
};
