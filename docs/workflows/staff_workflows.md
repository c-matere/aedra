# Company Staff Workflows: Step-by-Step Solutions

This document provides pseudo-code workflows for each company staff/manager expectation.

---

## 1. Workflow Automation
**Goal:** Automate repetitive administrative tasks.
1. **Late Fee Trigger:** Weekly cron job scanning all `Lease` records with a balance > 0 and `dueDate` in the past.
2. **Calculate Penalty:** Apply the `Late Payment` penalty amount to each overdue lease.
3. **Notify:** Send a "Late Payment Alert" template via WhatsApp to the tenant.
4. **Update Status:** Change the `Invoice` status to `OVERDUE`.

---

## 2. Centralized Database
**Goal:** A "single source of truth."
1. **Entity Linking:** When a new `Property` is created, it must be linked to a `Landlord` and a `Company`.
2. **Validation:** Ensure all mandatory fields (ID number, Phone, Email) are present before saving a `Tenant` or `Landlord` record.
3. **Search:** Provide a global search across all entities (Property, Unit, Tenant, Lease) using a unified query model.

---

## 3. Task Orchestration
**Goal:** Organizing daily maintenance and operations.
1. **Morning Briefing:** Generate a "To-Do" list for each staff member every morning.
2. **Prioritization:** Sort maintenance requests by `PRIORITY: URGENT` and then `REPORTED_AT`.
3. **Dispatch:** Map-based view of all active maintenance jobs to assign technicians based on location proximity.
4. **Task Completion:** Technicians update status via a mobile-friendly interface with photo proof.

---

## 4. Document Management
**Goal:** Simplified OCR and digital storage.
1. **OCR Process:** When a staff member uploads an ID or Lease scan.
2. **Data Extraction:** AI extracts fields like `firstName`, `lastName`, `idNumber`, `rentAmount`, and `endDate`.
3. **Pre-populate:** Fill out the creation form automatically for staff review.
4. **Storage:** Save the original file to `Document` and link it to the relevant entity.

---

## 5. Communication Hub
**Goal:** Unified messaging across all stakeholders.
1. **Chat Integration:** Listen for incoming WhatsApp/Email messages.
2. **Thread Matching:** Use the sender's phone number to find the `Tenant`, `Landlord`, or `Staff` record.
3. **Shared Inbox:** Display all messages in a centralized "Support Center" for staff response.
4. **Templates:** Provide pre-approved "Quick Replies" for common scenarios (e.g., Rent Receipts, Viewing Requests).

---

## 6. Financial Accuracy
**Goal:** Eliminating errors in rent collection.
1. **Automatic Reconciliation:** When a `Payment` is received (e.g., from M-Pesa), match it against the oldest `PENDING` invoice for that lease.
2. **Discrepancy Handling:** If the amount is less than the invoice, mark as `PARTIALLY_PAID` and notify the tenant.
3. **Commission Calculation:** Automatically calculate the property manager's commission (e.g., 10% of collected rent) and record as `Income`.

---

## 7. Performance Metrics
**Goal:** Reporting on operational health.
1. **Collection Rate:** `(Paid Rent / Total Billed Rent) * 100` for the current month.
2. **Maintenance Efficiency:** Average time from `REPORTED` to `COMPLETED`.
3. **Staff Productivity:** Number of tasks completed vs. assigned per user.
4. **Insights:** AI-generated summary of "Lease Violations" common across properties.

---

## 8. Mobile Accessibility
**Goal:** Managing assets on-the-go.
1. **On-Site Inspection:** Staff performs a walkthrough using the mobile app.
2. **Direct Capture:** Take photos and notes directly from the camera/mic.
3. **Offline Sync:** Store data locally if no internet connection and sync once online.
4. **Instant Updates:** Maintenance status and lease notes updated in real-time for others to see.

---

## 9. Autonomous Agent Loop [ADVANCED]
**Goal:** AI handling majority of routine interactions.
1. **Query Detection:** Monitor all incoming chats for "Standard Queries."
2. **Autonomous Response:** If the query is about rent balance or repair status, the AI fetches the data and responds.
3. **Supervised Escalation:** If the query is complex or involves a conflict, the AI flags it for "Human Intervention."
4. **Learning:** Periodically review AI-resolved chats to improve the knowledge base.

---

## 10. Predictive Maintenance [ADVANCED]
**Goal:** IoT integration for early warnings.
1. **Sensor Integration:** Listen to data from smart water/electricity meters.
2. **Anomaly Detection:** If usage spikes (leaking pipe) or drops (power outage), trigger an alert.
3. **Auto-Maintenance:** Create a `MaintenanceRequest` automatically and assign it a `HIGH` priority before the tenant even notices.
