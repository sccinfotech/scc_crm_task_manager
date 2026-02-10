# Database Migrations

This folder contains SQL migration files for the database schema, **merged by module** for clarity and maintainability. Run in numerical order on a fresh database.

## Migration Files

| File | Module | Contents |
|------|--------|----------|
| **001_auth_user_management.sql** | Auth & Users | `update_updated_at_column()`, `user_role` ENUM, `users` table, RLS, `handle_new_user()` trigger, admin seed `sarika@crm.com` |
| **002_lead_management.sql** | Leads | `leads` table, status constraint, indexes, RLS (module_permissions: `leads` read/write), updated_at trigger |
| **003_client_management.sql** | Clients | `clients`, `client_internal_notes`, `client_note_attachments`, status constraints, indexes, RLS (module_permissions: `customers`), updated_at triggers |
| **004_lead_client_followups.sql** | Follow-ups | `lead_client_followups` (entity_type: lead \| client), indexes, RLS (leads/customers module), updated_at trigger |
| **005_project_management.sql** | Projects (full) | `projects` (final schema: no expected_end_date; project_amount TEXT nullable; status pending\|in_progress\|hold\|completed; priority; staff_status; deadlines), `project_followups`, `technology_tools`, `project_technology_tools`, `project_team_members` (with work tracking), `project_team_member_time_events`, all RLS including staff/assigned access |
| **006_project_notes_and_team_talk.sql** | Notes & Team Talk | `project_user_notes`, `project_note_attachments`, `project_team_talk_messages`, `project_team_talk_attachments`, RLS (owner-only update/delete for team talk) |
| **007_project_requirements.sql** | Requirements | `project_requirements` (with pricing_type: hourly\|fixed\|milestone), `project_requirement_milestones`, RLS |

## Project amount (005)

- `project_amount` is stored as **TEXT** (nullable). The application stores AES-256-GCM encrypted value (base64).
- **Required env**: Set `PROJECT_AMOUNT_ENCRYPTION_KEY` (32-byte key as 64-char hex or 44-char base64) for create/update to work.

## How to Apply Migrations

### Option 1: Supabase Dashboard

1. Open your Supabase project → **SQL Editor**.
2. Run each file in order: `001` → `002` → `003` → `004` → `005` → `006` → `007`.

### Option 2: Supabase CLI

```bash
supabase db push
```

## Notes

1. **Order**: Run 001 → 002 → 003 → 004 → 005 → 006 → 007. Later migrations depend on earlier ones.
2. **Admin user**: 001 seeds `sarika@crm.com`. Ensure this auth user exists in Supabase first, or run the seed block manually after creating the user.
3. **RLS**: All tables use Row Level Security; access follows roles (admin/manager/staff) and `module_permissions` (leads, customers, projects, settings where applicable). Assigned project team members get read/update access to their projects.
4. **Existing DBs**: If you already applied the previous 19 migrations, your schema is up to date; these 7 files are for **new installs** and a single consolidated reference.
