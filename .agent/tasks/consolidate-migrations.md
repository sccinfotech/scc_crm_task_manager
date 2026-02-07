# Task: Consolidate Database Migrations

Consolidate migration files into 4 module-wise files matching the current database schema.

## Objectives
- [x] Keep `001_auth_user_management.sql` as-is (auth, users, roles, admin seed).
- [x] Merge leads + module RLS into `002_lead_management.sql` (no legacy lead_followups).
- [x] Merge clients + internal notes + attachments into `003_client_management.sql`.
- [x] Merge unified follow-ups into `004_lead_client_followups.sql`.
- [x] Remove old files 003–007 (module_permissions_rls, client_management, optional followup, internal_notes, lead_client_followups).
- [x] Update README and keep idempotency (IF NOT EXISTS, DROP IF EXISTS).

## Final Structure (4 files)

1. **001_auth_user_management.sql** – Auth, users, roles, triggers, admin seed.
2. **002_lead_management.sql** – Leads table + module_permissions RLS (leads).
3. **003_client_management.sql** – Clients, client_internal_notes, client_note_attachments + RLS.
4. **004_lead_client_followups.sql** – Unified lead_client_followups table + RLS.

## Progress
- [x] Initial research and plan.
- [x] Create consolidated files (002 updated, 003 and 004 merged).
- [x] Remove old migration files.
- [x] Update README.
