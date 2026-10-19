# New industrial ERP: reference analysis and plan

## 1. What ERP Infinity is (reference, read only)

| Area | What it uses |
|---|---|
| Backend | Node.js (ESM) + Express 4, single `server.js` (~220 route mounts) |
| Layers | `routes/` (230) → `controllers/` (232) → `repositories/` (SQL with `pg`) + `services/` (fiscal, NF-e, e-mail, stock) |
| Database | PostgreSQL (local or Cloud SQL), raw SQL, quoted camelCase table names (`public."customers"`) |
| Frontend | Plain HTML/CSS/JS per screen in `backend/public/<module>/` (no framework) |
| Desktop | Electron wrapper (`desktop/`, NSIS installer "CONSART ERP") |
| Auth | JWT + access profiles, user modules, module passwords, admin middleware |
| Multi-company | `erpCompanyContext` (AsyncLocalStorage) switching BH3 / CONSART tables per request via `X-ERP-Company` |
| Infra | Docker → Google Cloud Run, GCS buckets, Secret Manager, GitHub Actions deploy workflows |
| Integrations | NF-e/NFC-e (PlugNotas, SEFAZ, own XML signing), Asaas billing/boletos, Correios, CNPJ lookup, Google Ads/GA4, OpenAI, IMAP/SMTP e-mail |
| Docs | `docs/` with per-table SQL docs, architecture notes, module write-ups |

Modules it already covers: customers/CRM, budgets → orders → invoicing (NF-e), PDV/NFC-e, products (fiscal, prices, kits, grades, lots, locations, barcodes), stock and inventory, purchase orders (`manufacturesOrders` is actually "Ordem de Compra"), inbound invoices (XML entry), suppliers, accounts payable/receivable, cash, banks, chart of accounts, DRE, balance sheet, fiscal apuração, SPED Fiscal, logistics (routes, trips, labels, tracking), tasks, e-mail inbox, marketing.

**Gap for industry:** there is no real production module: no BOM (ficha técnica), routings, work orders, MRP, shop-floor reporting or production costing.

## 2. Proposed plan for the new industrial ERP

Keep the same stack and conventions so code and know-how carry over (Node/Express ESM, routes → controllers → repositories/services, PostgreSQL, HTML/JS screens, Electron, Cloud Run). Start clean, without the BH3/CONSART table split: one database with a `company_id` column for multi-company from day one.

**Phase 1: Foundation**
- Project skeleton, auth (JWT, profiles, module permissions), companies/branches, users, audit log
- Shared registers: products/materials, units, groups, customers, suppliers, transporters, payment terms

**Phase 2: Engineering and PCP (the new core)**
- Product structure / BOM (multi-level, with losses and alternates)
- Routings: work centers, operations, standard times, machines
- Production orders (from sales orders or stock replenishment), material release and requisition
- MRP: net requirements from orders + stock + lead times → purchase and production suggestions
- Shop-floor reporting (apontamento): produced qty, scrap, time, operator
- Scheduling board (kanban/Gantt by work center)

**Phase 3: Inventory and quality**
- Multi-warehouse stock (raw material, WIP, finished goods), lots/serials, traceability
- Inventory counts, transfers, kardex
- Quality: inspection on receipt and in production, non-conformities

**Phase 4: Purchasing and sales**
- Purchase requisition → quotation → purchase order → receiving (XML import, reuse from Infinity)
- Sales: budgets → orders → delivery date promise linked to PCP capacity

**Phase 5: Finance and costs**
- Payables/receivables, cash, banks, boletos (Asaas), chart of accounts, DRE
- Industrial costing: standard vs. actual cost per order (material + labor + overhead)

**Phase 6: Fiscal**
- NF-e issuance and entries, industrial CFOPs, IPI, remessa/retorno para industrialização, SPED Fiscal and Bloco K (production and stock)

## 3. Before creating files
Needed from Renato: the project name and where the new project folder should live (default suggestion: next to the reference, e.g. `PROJETOS CONSART\00001-<NAME>`).
