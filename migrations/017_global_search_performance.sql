-- Migration 017: Global Search Performance
-- Adds Trigram indexes to users, clients, projects, and activity_logs for high-performance searching.

-- 1. Clients Table
CREATE INDEX IF NOT EXISTS idx_clients_name_trgm ON public.clients USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clients_company_name_trgm ON public.clients USING gin(company_name gin_trgm_ops) WHERE company_name IS NOT NULL;

-- 2. Projects Table
CREATE INDEX IF NOT EXISTS idx_projects_name_trgm ON public.projects USING gin(name gin_trgm_ops);

-- 3. Users Table
CREATE INDEX IF NOT EXISTS idx_users_full_name_trgm ON public.users USING gin(full_name gin_trgm_ops) WHERE full_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_email_trgm ON public.users USING gin(email gin_trgm_ops);

-- 4. Activity Log Table
CREATE INDEX IF NOT EXISTS idx_activity_log_user_name_trgm ON public.activity_log USING gin(user_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_activity_log_description_trgm ON public.activity_log USING gin(description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_activity_log_module_name_trgm ON public.activity_log USING gin(module_name gin_trgm_ops);
