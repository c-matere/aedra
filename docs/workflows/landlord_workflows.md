# Landlord Workflows: Step-by-Step Solutions

This document provides pseudo-code workflows for each landlord expectation.

---

## 1. Financial Transparency
**Goal:** Real-time visibility into income and expenses.
1. **Identify Scope:** Get all properties and units owned by the landlord.
2. **Fetch Income:** Query the `Payment` and `Income` tables for all related units within a given timeframe.
3. **Fetch Expenses:** Query the `Expense` table for all related properties and units.
4. **Calculate Net:** Subtract total expenses from total income.
5. **Aggregate Data:** Group by property/unit and by month.
6. **Output:** Return a JSON payload structured for a dashboard (e.g., `totalRealizedIncome`, `totalPendingInvoices`, `totalExpenses`).

---

## 2. Asset Preservation
**Goal:** Ensure properties are maintained and repairs are verified.
1. **Report Trigger:** Tenant or staff creates a `MaintenanceRequest`.
2. **Categorize & Prioritize:** Assign category (e.g., PLUMBING) and priority (e.g., HIGH).
3. **Assign Vendor:** Link a vendor and schedule the repair.
4. **Capture "Before":** Require a photo upload to the `Document` table linked to the request.
5. **Execute Repair:** Update status to `IN_PROGRESS`.
6. **Verify "After":** Require an "After" photo and actual cost input.
7. **Notify Landlord:** Send a summary + photos via WhatsApp/Email.

---

## 3. Automated Reporting
**Goal:** Tax-ready monthly/annual financial statements.
1. **Schedule Trigger:** Monthly (e.g., 1st of every month) cron job.
2. **Compile Data:** Run the "Financial Transparency" workflow for the previous month.
3. **Generate Document:** Use a PDF template to format the compiled data.
4. **Store Record:** Save the PDF to the `Document` table with `type: AGREEMENT` (or a report type).
5. **Distribute:** Email the report to the landlord's registered email address.

---

## 4. Portfolio Performance
**Goal:** Compare performance across different assets.
1. **Calculate Yield:** For each property, `(Annual Rent - Annual Expenses) / Property Value`.
2. **Calculate Occupancy:** `(Occupied Units / Total Units) * 100`.
3. **Identify Outliers:** Flag properties with > 20% vacancy or < 5% ROI.
4. **Benchmarking:** Compare current property performance against historical averages.
5. **Visualize:** Present as a comparative bar chart or heatmap.

---

## 5. Tenant Quality
**Goal:** High-quality screening and history tracking.
1. **Capture Data:** Collect tenant ID, previous landlord contact, and employment details.
2. **Run Checks:**
    - Internal: Check for previous defaults or maintenance issues in our system.
    - External: Integrate with credit bureau API or manual reference check workflow.
3. **Score Tenant:** Assign a risk score (1-100) based on findings.
4. **Recommendation:** Output `APPROVE`, `APPROVE WITH HIGHER DEPOSIT`, or `REJECT`.

---

## 6. Compliance Assurance
**Goal:** Meeting statutory and legal requirements.
1. **Check Validity:** Periodically scan all `Lease` agreements for expiration.
2. **Tax Calculation:** Calculate withholding tax or VAT based on local regulations.
3. **Audit Trail:** Maintain an immutable log in `AuditLog` for every financial transaction.
4. **Alerts:** Notify property managers 30 days before safety certificates or insurance policies expire.

---

## 7. Direct Communication
**Goal:** Frictionless access to property managers.
1. **Message Input:** Landlord sends a message via the platform or WhatsApp.
2. **Context Injection:** AI retrieves current status of landlord's properties (Rent status, active maintenance).
3. **Route Message:** Tag the message with the assigned property manager's ID.
4. **Notify Manager:** Push notification to the manager's dashboard/phone.

---

## 8. Occupancy Optimization
**Goal:** Minimizing vacancy periods.
1. **Predictive Vacating:** Track units where `UnitStatus` is `VACATING` (lease ending soon).
2. **Auto-Listing:** Generate a rental listing for the upcoming vacancy.
3. **Market Comparison:** Compare current unit rent against similar units in the area.
4. **Renewal Workflow:** Trigger automated renewal offers to existing tenants 60 days before lease end.

---

## 9. Predictive ROI [ADVANCED]
**Goal:** AI-driven insights on appreciation and pricing.
1. **Data Ingestion:** Fetch historical rent growth and local property price trends.
2. **Model Processing:** Feed data into a regression model to forecast future value.
3. **Dynamic Pricing:** Suggest optimal rent prices based on seasonal demand and local inventory.
4. **Outcome:** Provide a "Buy/Hold/Sell" recommendation report.

---

## 10. Portfolio Health Score [ADVANCED]
**Goal:** A single holistic metric for risk and performance.
1. **Weighted Inputs:**
    - Financial (Income vs. Targeted) [40%]
    - Maintenance (Open issues / Severity) [30%]
    - Tenant Satisfaction (Survey results / Payment speed) [30%]
2. **Calculate Score:** Aggregate weighted metrics into a 0-100 score.
3. **Trend Analysis:** Show if the health score is improving or declining month-over-month.
