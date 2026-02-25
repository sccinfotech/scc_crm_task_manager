# List View Data Fetching

This document describes the pattern for fetching data in main table/list views across modules. **Always fetch only the required fields** for the list view (and any modals that receive list data without refetching).

---

## Principle

**Do not use `select('*')` for list page queries.** Explicitly list the columns needed for:

1. **Table display** – columns shown in the list/table view  
2. **Row actions** – data passed to modals (edit, permissions, etc.) when opened from the list  
3. **Sorting/filtering** – fields used in `order()` or `eq()`/`ilike()` (usually already in display columns)

Exclude columns that are never used on the list page (e.g. `deleted_at`, `updated_at`, `record_id`).

---

## Module Reference

| Module | Action | Select Pattern | Notes |
|--------|--------|----------------|-------|
| **Leads** | `getLeadsPage` | `id, name, company_name, phone, status, created_at, follow_up_date, notes` | Optimized; excludes `source`, `created_by`, `updated_at` |
| **Clients** | `getClientsPage` | `id, name, company_name, phone, email, status, remark, created_at, created_by` | Optimized |
| **Projects** | `getProjectsPage` | `id, name, logo_url, client_id, project_amount, status, priority, client_deadline_date, website_links, created_at, created_by` + `clients(...)`, `project_team_members(...)` | Includes related tables; follow-up dates fetched separately |
| **Project Tasks** | `getProjectTasks` | `id, project_id, title, task_type, priority, status, due_date, ...` (excludes `description_html`) | `description_html` loaded only in detail view |
| **Users** | `getUsers` | `id, email, full_name, designation, joining_date, personal_email, personal_mobile_no, home_mobile_no, address, date_of_birth, photo_url, role, module_permissions, is_active, created_at` | Excludes `deleted_at`, `updated_at`; includes fields for Edit and Permissions modals |
| **Activity Logs** | `getActivityLogsPage` | `id, user_name, action_type, module_name, description, status, ip_address, created_at` | Excludes `user_id`, `record_id` (not displayed) |
| **Technology Tools** | `getTechnologyTools` | `id, name, is_active, created_by, created_at, updated_at` | Used in dropdowns/settings; already selective |

---

## Checklist for New Modules

When adding a new module with a main table/list view:

1. **Identify list columns** – Which fields are shown in the table?
2. **Identify modal data** – Does Edit, View, or other modals receive the row from the list? If yes, include those fields in the select.
3. **Avoid `select('*')`** – Use an explicit column list.
4. **Add a comment** – e.g. `// Optimize: Only select fields needed for list view`
5. **Exclude unused columns** – e.g. `deleted_at` when filtering by `is('deleted_at', null)`, `updated_at` if not displayed.

---

## Example

```typescript
// ❌ Avoid
let query = supabase.from('my_table').select('*', { count: 'exact' })

// ✅ Prefer
let query = supabase
  .from('my_table')
  .select('id, name, status, created_at, created_by', { count: 'exact' })
```

---

## Related Docs

- [LOADING_AND_SKELETONS.md](./LOADING_AND_SKELETONS.md) – Skeleton format for list pages  
- [UI_SETUP.md](./UI_SETUP.md) – Modal and UI conventions  
