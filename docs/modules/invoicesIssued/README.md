# Invoices Issued Module

## 1. Purpose
What this module is responsible for.

## 2. Main Database Table
public."invoicesIssued"

## 3. Sources
Which ERP flows can create an issued invoice:
- Order
- Budget
- Bonus

## 4. Main Flow
Source
  ↓
NF-e issuance
  ↓
SEFAZ authorization
  ↓
invoicesIssued
  ↓
Stock
  ↓
Accounts Receivable
  ↓
ASAAS / financial integrations

## 5. Database Structure
Explanation of the main columns.

## 6. Backend Files
Controllers, APIs, routes, services, repositories, etc.

## 7. API Endpoints
Endpoints related to invoices issued.

## 8. Creation Rules
When a record is created.

## 9. Update Rules
When status, protocol, XML, DANFE, etc. are updated.

## 10. Source Types
ORDER
BUDGET
BONUS

## 11. Stock Integration
How an authorized NF-e affects stock.

## 12. Accounts Receivable Integration
How issued invoices generate financial records.

## 13. ASAAS Integration
How boleto/payment generation happens.

## 14. Cancellation
What happens when an NF-e is cancelled.

## 15. Reconciliation
How the ERP checks NF-e status again.

## 16. Important Constraints
Unique indexes, foreign keys, status rules, etc.

## 17. Troubleshooting
Links to module-specific problems.

ORDER ──────┐
            │
BUDGET ─────┼──> NF-e issued/authorized
            │
BONUS ──────┘
                    │
                    ▼
            invoicesIssued
                    │
          ┌─────────┼─────────┐
          ▼         ▼         ▼
       Stock    Financial    XML/DANFE
          │         │
          │         ▼
          │   Accounts Receivable
          │         │
          │         ▼
          │       ASAAS
          │
          ▼
   Stock audit/history