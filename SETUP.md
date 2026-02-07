# Authentication Setup Guide

This document explains how to set up the authentication system for the CRM application.

## Prerequisites

1. A Supabase project (create one at https://supabase.com)
2. Node.js and npm installed
3. Next.js project initialized

## Step 1: Install Dependencies

Dependencies are already installed. If you need to reinstall:

```bash
npm install @supabase/supabase-js @supabase/ssr
```

## Step 2: Configure Environment Variables

**⚠️ IMPORTANT: Environment variables are required. The app will show clear error messages if they're missing.**

### 2.1: Create `.env.local` file

1. **Location**: Create a file named `.env.local` in the project root directory
   - This is the same directory where `package.json` is located
   - Path: `/Users/himanidudhat/Documents/Sarika/GitHub/scc_crm_task_manager/app/.env.local`

2. **File format**: The file should contain these lines (no quotes needed around values):

   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   NEXT_PUBLIC_CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret
   ```

### 2.2: Get your Supabase credentials

1. Go to https://supabase.com/dashboard
2. Select your project (or create a new one if you don't have one)
3. Navigate to **Settings** → **API** (in the left sidebar)
4. You'll see two values you need:

   - **Project URL** → Copy this value
     - This goes in `NEXT_PUBLIC_SUPABASE_URL`
     - Format: `https://xxxxxxxxxxxxx.supabase.co`
   
   - **Publishable key** → Copy this value (under "Publishable key" section)
     - This goes in `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - Format: `sb_publishable_...` (new format) or `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (legacy format)
     - **Note**: Use the new "Publishable key" format, not the legacy "anon" key

### 2.3: Add credentials to `.env.local`

1. Open `.env.local` in your editor
2. Replace the placeholder values:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxxx
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   NEXT_PUBLIC_CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret
   ```
   
   **Note**: The key format should start with `sb_publishable_` (new format). If you see a legacy format starting with `eyJ...`, make sure you're using the "Publishable key" from the "Publishable and secret API keys" tab, not the legacy "anon" key.

   **Important notes:**
   - No spaces around the `=` sign
   - No quotes around the values
   - Each variable on its own line
   - Save the file

### 2.4: Restart your development server

**⚠️ CRITICAL: You MUST restart the dev server after creating/updating `.env.local`**

1. Stop the current dev server (if running): Press `Ctrl+C` in the terminal
2. Start it again:
   ```bash
   npm run dev
   ```

   Next.js only reads environment variables when the server starts, so changes won't take effect until you restart.

### 2.5: Verify environment variables are loaded

If the variables are missing or incorrect, you'll see a clear error message when you try to use the app:

```
Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL

To fix this:
1. Create a file named .env.local in the project root...
```

If you see this error:
- Check that `.env.local` exists in the correct location
- Verify the variable names are exactly correct (case-sensitive)
- Make sure you restarted the dev server
- Check that there are no typos in the values

## Step 3: Configure Supabase Auth Settings

1. Go to Authentication > Settings in your Supabase dashboard
2. **Disable email confirmation**:
   - Find "Enable email confirmations"
   - Toggle it OFF
   - This allows users to log in immediately without email verification

3. Configure Auth providers:
   - Ensure "Email" provider is enabled
   - Disable all other providers (Google, GitHub, etc.)

## Step 4: Run Database Migrations

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run the migrations in order (see `migrations/README.md` for details):

   - **001_auth_user_management.sql** – Auth, users table, roles, triggers, admin seed
   - **002_lead_management.sql** – Leads table and RLS
   - **003_client_management.sql** – Clients, internal notes, note attachments and RLS
   - **004_lead_client_followups.sql** – Unified follow-ups table and RLS

   For each file: open it, copy the entire content, paste in SQL Editor, and click "Run".

4. Verify the migrations:
   - Go to Table Editor
   - You should see `users`, `leads`, `clients`, `client_internal_notes`, `client_note_attachments`, and `lead_client_followups` tables
   - Check that the `user_role` enum exists

## Step 5: Create Test Users

Since signup is disabled in the UI, create users manually:

1. Go to Authentication > Users in Supabase dashboard
2. Click "Add User" > "Create new user"
3. Enter:
   - Email: `admin@example.com` (or your test email)
   - Password: (choose a secure password)
   - Auto Confirm User: ✅ (checked)
4. Click "Create user"

5. Update the user record in the `users` table:
   - Go to Table Editor > `users` table
   - Find the user you just created
   - Update:
     - `full_name`: "Admin User" (optional)
     - `role`: "admin" (or "manager", "user")
     - `is_active`: true

   Or run this SQL:
   ```sql
   UPDATE users 
   SET full_name = 'Admin User', role = 'admin', is_active = true 
   WHERE email = 'admin@example.com';
   ```

## Step 6: Test the Application

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:3000`
   - You should be redirected to `/login`

3. Log in with your test user credentials

4. After successful login, you should be redirected to `/dashboard`

## Architecture Overview

### File Structure

```
app/
├── lib/
│   ├── supabase/
│   │   ├── client.ts          # Browser Supabase client
│   │   ├── server.ts          # Server Supabase client
│   │   └── middleware.ts      # Middleware helper
│   └── auth/
│       ├── actions.ts         # Server actions (login, logout)
│       └── utils.ts           # Auth utilities (getCurrentUser, requireAuth, requireRole)
├── app/
│   ├── auth/
│   │   └── login/
│   │       └── page.tsx       # Login page
│   └── dashboard/
│       └── page.tsx           # Protected dashboard page
├── middleware.ts              # Next.js middleware for route protection
├── migrations/               # Database migration files
└── types/
    └── supabase.ts           # TypeScript types for Supabase
```

### Authentication Flow

1. **Login**: User submits email/password → Server action validates → Creates session → Redirects to dashboard
2. **Session Management**: Middleware refreshes sessions automatically
3. **Route Protection**: Middleware checks authentication status and redirects accordingly
4. **User Data**: Fetched from `users` table, not just `auth.users`

### Role-Based Access

The system includes placeholder logic for role-based access:

- `requireAuth()`: Ensures user is authenticated
- `requireRole(['admin', 'manager'])`: Ensures user has specific role(s)

Example usage:
```typescript
// In a page or component
import { requireRole } from '@/lib/auth/utils'

export default async function AdminPage() {
  const user = await requireRole(['admin'])
  // User is guaranteed to be admin here
}
```

## Troubleshooting

### Environment Variable Errors

**Error: "Missing required environment variable"**
- ✅ **Solution**: Follow Step 2 above to create `.env.local` with the correct variables
- Make sure the file is in the project root (same directory as `package.json`)
- Verify variable names are exactly: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Restart your dev server** after creating/updating `.env.local`

**Error: "SUPABASE_SERVICE_ROLE_KEY must never be used in browser/client code"**
- This error means service role key was accidentally used in client code
- The service role key should NEVER be in any `NEXT_PUBLIC_*` variable
- Only use `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in this project

**App crashes on startup with environment variable errors**
- This is expected behavior - the app validates required variables at startup
- Fix by adding the missing variables to `.env.local` and restarting

### Authentication Errors

**"User not found" error**
- Ensure the user exists in both `auth.users` and `users` table
- Check that the trigger created the user record automatically
- If not, manually insert into `users` table

**"Your account has been deactivated" error**
- Check `is_active` field in `users` table
- Set it to `true` to reactivate the user

**Redirect loops**
- Check that environment variables are set correctly
- Verify Supabase URL and keys are correct
- Check browser console for errors
- Make sure you restarted the dev server after setting env vars

**Session not persisting**
- Ensure cookies are enabled in your browser
- Check that middleware is running correctly
- Verify Supabase session configuration

## Next Steps

After authentication is working:

1. Build out dashboard features
2. Implement role-based permissions
3. Add user management (for admins)
4. Create additional protected routes
5. Add business logic and features
