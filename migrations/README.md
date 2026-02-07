# Database Migrations

This folder contains SQL migration files for the database schema, merged by **module** for clarity and maintainability. Run in numerical order on a fresh database.

## Migration Files

### 001_auth_user_management.sql
**Module: Auth & Users**
- Shared helper `update_updated_at_column()`
- `user_role` ENUM (admin, manager, staff, client)
- `users` table (id, email, full_name, role, is_active, module_permissions, deleted_at, timestamps)
- Indexes and RLS for `users`
- `handle_new_user()` trigger on `auth.users`
- Admin seed for `sarika@crm.com`

### 002_lead_management.sql
**Module: Leads**
- `leads` table and status constraint
- Indexes and RLS for `leads` (module_permissions: `leads` read/write)
- updated_at trigger

### 003_client_management.sql
**Module: Clients**
- `clients` table and status constraint
- Indexes and RLS for `clients` (module_permissions: `customers` read/write)
- `client_internal_notes` table and RLS (admin/manager only)
- `client_note_attachments` table and RLS (admin/manager only)
- updated_at triggers

### 004_lead_client_followups.sql
**Module: Follow-ups (unified)**
- `lead_client_followups` table (`entity_type`: lead | client, optional `note` and `follow_up_date`)
- Indexes and RLS (leads module for lead follow-ups, customers module for client follow-ups)
- updated_at trigger

## How to Apply Migrations

### Option 1: Supabase Dashboard
1. Open your Supabase project → **SQL Editor**.
2. Run each file in order: `001` → `002` → `003` → `004`.

### Option 2: Supabase CLI
```bash
supabase db push
```

## Notes

1. **Order**: Run 001 → 002 → 003 → 004. Later migrations depend on earlier ones.
2. **Admin user**: 001 seeds `sarika@crm.com`. Ensure this auth user exists in Supabase first, or run the seed block manually after creating the user.
3. **RLS**: All tables use Row Level Security; access follows roles (admin/manager) and `module_permissions` (leads, customers, follow_ups where applicable).
4. **Existing DBs**: If you already applied the previous 7 migrations, your schema is up to date; these 4 files are for new installs and a single consolidated reference.
