# Aedra AI Co-worker (MCP Server)

This MCP server transforms an AI model into a digital staff member for the Aedra Property Management System. It provides both **sight** (database analysis) and **limbs** (operational actions) via the Model Context Protocol.

## 🛠 Capabilities

### 👁 Sight (Analysis & Search)
* **Analytics**: `system_summary` (Occupancy, active leases, maintenance bottlenecks).
* **Asset Management**: `list_properties`, `get_property_details`, `list_vacant_units`.
* **Search**: `search_tenants` (name/email/phone).
* **Finance**: `list_expenses`, `list_invoices`, `view_audit_logs`.
* **Operations**: `list_staff`, `list_landlords`, `list_maintenance_requests`, `workflow_get_state`, `list_active_workflows`.

### 🦾 Limbs (Operational Actions)
* **Workflows**: `workflow_initiate`, `workflow_submit_event`.
* **Maintenance**: `record_maintenance_request`, `assign_maintenance`, `resolve_maintenance`.
* **Leasing**: `onboard_tenant`, `create_lease`, `terminate_lease`.
* **Finance**: `record_payment`, `record_payment_basic`, `generate_invoice`, `issue_penalty`.
* **Inventory**: `update_unit_status`.

## 🚀 Setup

```bash
cd mcp-server
npm install
npx prisma generate
npm run build
```

## ⚙️ Configuration

Ensure the `.env` file contains the correct `DATABASE_URL` for your Aedra PostgreSQL instance.

## 🏃 Usage

Run with stdio transport:
```bash
npm start
```
