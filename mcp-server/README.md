# Aedra AI Co-worker (MCP Server)

This MCP server transforms an AI model into a digital staff member for the Aedra Property Management System. It provides both **sight** (database analysis) and **limbs** (operational actions) via the Model Context Protocol.

## 🛠 Capabilities

### 👁 Sight (Analysis & Search)
*   **Analytics**: `system_summary` (Occupancy, active leases, maintenance bottlenecks).
*   **Asset Management**: `list_properties`, `get_property_details`, `list_vacant_units`.
*   **Search**: `search_tenants` (By name, email, or phone).
*   **Finance**: `list_expenses` (Filter by property or category).
*   **Operations**: `list_maintenance_requests` (Filter by priority/status), `list_staff` (Find team members).

### 🦾 Limbs (Operational Actions)
*   **Maintenance**: `record_maintenance_request`, `assign_maintenance`, `resolve_maintenance`.
*   **Leasing**: `onboard_tenant`, `create_lease`, `update_lease_status`.
*   **Finance**: `record_payment_basic` (Log M-PESA/Cash/Bank entries).
*   **Inventory**: `update_unit_status` (Toggle vacancy/maintenance).

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
