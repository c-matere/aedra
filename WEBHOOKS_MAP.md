# Aedra Webhook Integration Map

This document outlines the ingress points for external systems pushing data into Aedra. 

All webhooks must be treated as **untrusted**, **out-of-order**, and **potentially duplicated**.

## 1. M-Pesa C2B Webhook
**Endpoint**: `POST /mpesa/webhook/c2b`
**Actor**: Safaricom Daraja API
**Purpose**: Receives real-time confirmation when a tenant pays rent via PayBill/Till.

### Idempotency & Security
*   **Idempotency Key**: `TransID` (Safaricom Transaction ID)
*   **Validation**: IP Whitelisting (Safaricom IPs only) + Basic Auth (if configured)
*   **Processing SLA**: Must return `HTTP 200` within 3 seconds. Execution happens synchronously, but matching logic is optimized.

### Payload Structure
```json
{
  "TransactionType": "Pay Bill",
  "TransID": "RHA9...",
  "TransAmount": "15000.00",
  "TransTime": "20230810143000",
  "BusinessShortCode": "123456",
  "BillRefNumber": "UNIT-A1", 
  "MSISDN": "254712345678",
  "FirstName": "John",
  "MiddleName": "Doe",
  "LastName": ""
}
```

### Failure & Retry Policy
*   **Matching Failure**: If `BillRefNumber` or `MSISDN` cannot be linked to a known Tenant/Lease, the payment is stored as `UNMATCHED`. A WhatsApp alert is fired to the `SUPER_ADMIN` for manual reconciliation.
*   **Safaricom Retries**: Safaricom expects a 200 OK. If Aedra returns 5xx or times out, Safaricom will retry exponentially for up to 24 hours. Aedra's idempotency key (`TransID`) ensures the database is not double-credited on retry.

---

## 2. WhatsApp Business API Webhook (Meta)
**Endpoint**: `POST /whatsapp/webhook`
**Actor**: Meta / WhatsApp Business API
**Purpose**: Receives incoming chat messages, media, and delivery receipts from users interacting with Aedra.

### Idempotency & Security
*   **Idempotency Key**: `entry[0].changes[0].value.messages[0].id` (WhatsApp Message ID)
*   **Validation**: SHA256 Signature Header (`X-Hub-Signature-256`) verified against the App Secret.
*   **Processing SLA**: Must return `HTTP 200` immediately. AI processing and response generation are handled in the background.

### Payload Structure
```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "1234567890",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": { "display_phone_number": "15551234567", "phone_number_id": "12345" },
            "contacts": [ { "profile": { "name": "Jane User" }, "wa_id": "254700000000" } ],
            "messages": [
              {
                "from": "254700000000",
                "id": "wamid.HBg...",
                "timestamp": "1691673852",
                "text": { "body": "Natafuta nyumba ya vyumba viwili." },
                "type": "text"
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

### Failure & Retry Policy
*   **Duplicate Prevention**: The Redis cache stores the `wamid` for 24 hours. Messages seen in the cache are immediately 200 OK'd and dropped.
*   **Meta Retries**: Meta retries failed webhooks (non-2xx responses) for up to 7 days with exponential backoff.
*   **Delivery Statuses**: Status updates (`sent`, `delivered`, `read`) are processed to update the audit log but do not trigger AI execution.

---

## 3. Peer Authorization Quorum (Internal/External Bridge)
**Endpoint**: `POST /quorum/approve/:id`
**Actor**: Aedra Administrators (via deep link in WhatsApp)
**Purpose**: Approves sensitive AI actions (e.g., deleting a lease, massive refunds) that required human consensus.

### Idempotency & Security
*   **Idempotency Key**: `id` + `req.user.id` (AuthorizationRequest ID + Approver ID)
*   **Validation**: JWT Bearer Token / Session Auth + Role Check (`UserRole.COMPANY_ADMIN`, `SUPER_ADMIN`).
*   **State Machine**: Once `AuthorizationRequest.status` hits `APPROVED` or `REJECTED`, further calls are no-ops.

## Monitoring Webhooks
All webhook failures trigger an immediate error log, which invokes the `SystemDegradationService`. If the failure rate exceeds 10% in a 5-minute window, the `SUPER_ADMIN` receives a WhatsApp operations alert as defined in the `RUNBOOK.md`.
