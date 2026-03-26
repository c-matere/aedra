# Tenant Workflows: Step-by-Step Solutions

This document provides pseudo-code workflows for each tenant expectation.

---

## 1. Payment Convenience
**Goal:** Frictionless digital payment options.
1. **Invoice Trigger:** System generates an `Invoice` for monthly rent.
2. **Notification:** Send a WhatsApp message with a "Pay Now" button to the tenant.
3. **Select Method:** Tenant selects M-Pesa, Card, or Bank Transfer.
4. **Processing (STK Push):**
    - If M-Pesa: Trigger STK push to the tenant's phone.
    - If Card: Redirect to a secure payment gateway (e.g., Stripe/Flutterwave).
5. **Update State:** On successful callback, create a `Payment` record and link to the `Invoice`.
6. **Receipting:** Generate a PDF receipt and send it instantly via WhatsApp.

---

## 2. Maintenance Tracking
**Goal:** Easy reporting and real-time updates on repairs.
1. **Report Issue:** Tenant opens "Report Problem" in the app or via WhatsApp bot.
2. **Attach Evidence:** Tenant uploads photos or videos of the issue.
3. **Auto-Categorize:** AI analyzes the description and image to suggest a category from `MaintenanceCategory`.
4. **Status Loop:**
    - `REPORTED` -> `ACKNOWLEDGED` (notify tenant)
    - `ACKNOWLEDGED` -> `IN_PROGRESS` (notify tenant + technician ETA)
    - `IN_PROGRESS` -> `COMPLETED` (notify tenant + request rating)
5. **Feedback:** Tenant provides a 1-5 star rating and comments on the repair.

---

## 3. Digital Records
**Goal:** 24/7 access to all tenancy-related documents.
1. **Document Storage:** Every invoice, receipt, and lease is saved to the `Document` table.
2. **Retrieve Documents:** Tenant selects "View My Documents" from their profile.
3. **Filter & Sort:** Query the `Document` and `Invoice` tables where `tenantId` matches.
4. **Display:** Show a list with download links (e.g., `Lease_2023.pdf`, `Rent_Receipt_Jan.pdf`).

---

## 4. Fast Communication
**Goal:** Rapid response times for inquiries.
1. **Message Input:** Tenant sends a query via WhatsApp/App.
2. **AI Pre-check:** AI checks if the query can be answered by the KB (e.g., "What is my balance?").
3. **If Resolution:** Answer immediately and close the ticket.
4. **If Human Needed:** Escalate to the property manager and provide a "Priority" tag based on tenant sentiment.

---

## 5. Privacy & Security
**Goal:** Data protection and staff verification.
1. **Staff Verification:** When a technician is assigned to a `MaintenanceRequest`, send the technician's photo and name to the tenant via WhatsApp.
2. **Access Control:** Log all staff accesses to the property in the `AuditLog`.
3. **Anonymization:** Mask tenant phone numbers for vendors unless absolutely necessary.

---

## 6. Incentive Programs
**Goal:** Rewards for on-time payments.
1. **Threshold Check:** At the end of every month, check if `Payment` was made before the `Invoice.dueDate`.
2. **Award Points:** Increment a `tenantPoints` balance (stored in metadata/extended schema).
3. **Redemption:** Allow points to be used for rent discounts or utility vouchers.

---

## 7. Paperless Onboarding
**Goal:** Quick digital signing and onboarding.
1. **Draft Lease:** System generates a `Lease` agreement from a template.
2. **Digital Signature:** Send the link to the tenant for a digital signature (e.g., DocuSign or internal signature capture).
3. **Store Signed Copy:** Once signed, update `LeaseStatus` to `ACTIVE` and save the PDF.
4. **Welcome Pack:** Automated WhatsApp message with rules, contact info, and WiFi passwords (where applicable).

---

## 8. Smart Locks/Access [ADVANCED]
**Goal:** Remote access management.
1. **Identify Entry:** Tenant requests access for a guest or technician.
2. **Grant Token:** System generates a time-limited digital key or QR code.
3. **Unlock Event:** Smart lock communicates with the API to verify the token.
4. **Log Event:** Create an entry in `AuditLog` for entry/exit times.

---

## 9. Automated Disputes [ADVANCED]
**Goal:** Simplified mediation for security deposits.
1. **Final Inspection:** Staff captures photos of the unit during move-out.
2. **Compare State:** AI compares current photos against move-in photos to identify damages.
3. **Deduct Costs:** Automatically calculate deductions from the security deposit based on damage report.
4. **Mediation:** If tenant disagrees, trigger a "Resolution Workflow" where an admin reviews the evidence.
