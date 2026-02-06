# Database Migrations

This folder contains SQL migration files for setting up the database schema. The migrations have been consolidated module-wise for clarity and maintainability.

## Migration Files

### 001_auth_user_management.sql
Consolidates all user-related setup:
- Shared helper function `update_updated_at_column()`
- `user_role` ENUM (admin, manager, staff, client)
- `users` table (extending Supabase auth.users)
- All user-specific indexes, including soft delete and permissions
- RLS policies for user data
- Failsafe `handle_new_user()` function and its trigger on `auth.users`
- Sarika Admin seed data

### 002_lead_management.sql
Consolidates all lead-related setup:
- `leads` table and its status constraints
- `lead_followups` table
- All indexes for both tables
- Comprehensive RLS policies for both tables
- Timestamps update triggers

### 003_module_permissions_rls.sql
Updates lead and follow-up RLS policies to respect `module_permissions`:
- Read access: `leads` / `follow_ups` set to `read` or `write`
- Write access: `leads` / `follow_ups` set to `write`
- Admins and managers retain full access (except module-specific UI gates)

### 004_client_management.sql
Consolidates all client-related setup:
- `clients` table and status constraints
- `client_followups` table
- All indexes for both tables
- RLS policies for both tables
- Timestamps update triggers

### 005_make_followup_date_optional.sql
Makes `note` and `follow_up_date` optional in lead/client follow-ups so either can be used independently.

### 006_client_internal_notes.sql
Creates internal notes and attachments:
- `client_internal_notes` table
- `client_note_attachments` table
- Admin/manager-only RLS policies

### 007_lead_client_followups.sql
Unifies lead and client follow-ups:
- Creates `lead_client_followups` with `entity_type` and a single parent reference
- Migrates data from legacy `lead_followups` and `client_followups`
- Attaches legacy lead follow-ups to clients when `clients.lead_id` matches
- Drops the legacy follow-up tables

## How to Apply Migrations

### Option 1: Using Supabase Dashboard
1. Go to your Supabase project dashboard.
2. Navigate to **SQL Editor**.
3. Copy and paste the contents of `001_auth_user_management.sql` and run it.
4. Copy and paste the contents of `002_lead_management.sql` and run it.
5. Copy and paste the contents of `003_module_permissions_rls.sql` and run it.
6. Copy and paste the contents of `004_client_management.sql` and run it.
7. Copy and paste the contents of `005_make_followup_date_optional.sql` and run it.
8. Copy and paste the contents of `006_client_internal_notes.sql` and run it.
9. Copy and paste the contents of `007_lead_client_followups.sql` and run it.

### Option 2: Using Supabase CLI
```bash
# To push all migrations to your remote database
supabase db push
```

## Important Notes

1. **Email Confirmation**: Disable email confirmation in Supabase Auth settings if you want immediate access after creation.
2. **User Creation**: Since signup is restricted in the UI, users must be created manually in the Supabase Dashboard. The trigger will automatically create the corresponding record in the `public.users` table.
3. **Admin User**: The `001` migration includes a seed for `sarika@crm.com`. Ensure this auth user exists in Supabase before running, or run the seed part manually after creating the user.
4. **RLS**: Row Level Security is active on all tables. Policies ensure that users can only see their own data, while admins have full access.
