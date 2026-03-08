# Aedra — Database Schema Overview

The database schema is managed using **Prisma ORM** on **PostgreSQL** with **PostGIS** extensions. It is designed for a multi-tenant property management platform targeting the Mombasa marketplace.

---

## Entity Hierarchy

```
Platform (Aedra)
 └── Super Admins (customer support, see everything)
 └── Company (multi-tenant boundary — a property management firm)
      ├── Company Admins & Staff (users who manage the company)
      ├── Landlords (property owners managed by the company)
      │    └── Properties (buildings / real estate)
      │         └── Units (individual rentable spaces)
      │              ├── Leases (contracts linking tenants to units)
      │              │    ├── Payments (rent, deposits, penalty settlements)
      │              │    └── Penalties (late fees, violations, damages)
      │              └── Maintenance Requests (work orders)
      ├── Tenants (real-world renters occupying units)
      └── Expenses (maintenance, repairs, utilities, management fees)
```

---

## Models

### User
Platform users who log into Aedra. Role-based access control:
| Role | Scope |
|------|-------|
| `SUPER_ADMIN` | Platform-wide. No `companyId`. Aedra customer support. |
| `COMPANY_ADMIN` | Manages a single Company and all its data. |
| `COMPANY_STAFF` | Staff member (agent, accountant) within a Company. |

Users can also be **assigned** to maintenance requests.

### Company
A property management company in Mombasa. This is the **multi-tenant boundary** — all business data (landlords, properties, tenants, etc.) is scoped to a Company.

### Landlord
A property owner whose portfolio is managed by a Company. One landlord can own **multiple properties**.

### Property
A building, estate, or plot managed by a Company on behalf of a Landlord. Each property can contain **multiple units**.

Supports property types: `RESIDENTIAL`, `COMMERCIAL`, `MIXED_USE`, `INDUSTRIAL`, `LAND`.

### Unit
An individual rentable space within a property (e.g. "Apartment 3B", "Shop 12"). Tracks vacancy status: `VACANT`, `OCCUPIED`, `UNDER_MAINTENANCE`.

### Tenant
A real-world renter (person or business) who occupies a unit. **Not** to be confused with the software "multi-tenant" concept — here, "tenant" means the person paying rent.

### Lease
A contract linking a **Tenant** to a **Unit** for a specific time period. Tracks status: `PENDING`, `ACTIVE`, `EXPIRED`, `TERMINATED`.

### Payment
A payment made by a tenant. Typed by purpose and method:

**Payment Types:** `RENT`, `DEPOSIT`, `PENALTY`, `UTILITY`, `OTHER`
**Payment Methods:** `MPESA`, `BANK_TRANSFER`, `CASH`, `CHEQUE`, `CARD`, `OTHER`

Payments can optionally be linked to a specific **Penalty** they are settling.

### Expense
Costs incurred whilst maintaining or operating a property. Scoped to a **Company**, optionally tied to a specific **Property** or **Unit**.

**Expense Categories:** `MAINTENANCE`, `REPAIR`, `UTILITY`, `INSURANCE`, `TAX`, `MANAGEMENT_FEE`, `LEGAL`, `CLEANING`, `SECURITY`, `OTHER`

Tracks vendors (plumber, electrician, KPLC, etc.) and invoice references.

### Penalty
Charges levied against a tenant for infractions or overdue payments.

**Penalty Types:** `LATE_PAYMENT`, `LEASE_VIOLATION`, `PROPERTY_DAMAGE`, `EARLY_TERMINATION`, `OTHER`
**Penalty Statuses:** `PENDING`, `PAID`, `WAIVED`, `PARTIALLY_PAID`

Penalties are linked to a **Lease** and can be settled by one or more **Payments**.

### MaintenanceRequest
A work order / maintenance request raised for a property or specific unit. Tracks the full lifecycle from report to resolution.

**Statuses:** `REPORTED` → `ACKNOWLEDGED` → `IN_PROGRESS` → `ON_HOLD` → `COMPLETED` / `CANCELLED`
**Priorities:** `LOW`, `MEDIUM`, `HIGH`, `URGENT`
**Categories:** `PLUMBING`, `ELECTRICAL`, `STRUCTURAL`, `PAINTING`, `APPLIANCE`, `PEST_CONTROL`, `HVAC`, `ROOFING`, `FLOORING`, `GENERAL`, `OTHER`

Key fields:
- `reportedAt` / `scheduledAt` / `completedAt` — lifecycle timestamps
- `estimatedCost` / `actualCost` — budget tracking
- `vendor` / `vendorPhone` — who performs the work
- `assignedTo` — which staff member (User) is handling it
- Scoped to a **Company**, linked to a **Property**, optionally to a **Unit**

---

## Multi-Tenancy Strategy

All companies share a single database and `public` schema. Isolation is enforced at the **application layer** via Prisma Client Extensions that inject `companyId` filtering into every query. In production, PostgreSQL Row-Level Security (RLS) policies will provide an additional database-level safety net:

```sql
SELECT set_config('app.current_company_id', 'COMPANY_UUID', TRUE);
```

---

## PostGIS Support

The schema enables the `postgis` extension for geospatial queries. Properties store `latitude` and `longitude` as floats, with the option to upgrade to native `geometry(Point, 4326)` columns for spatial indexing and map-tile generation as the product matures.
