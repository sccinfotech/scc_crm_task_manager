# Environment Variables Quick Reference

## Required Variables

Create a `.env.local` file in the project root with these variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
NEXT_PUBLIC_CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret
```

## Optional: Project Amount Encryption

To store project amounts encrypted in the database, set:

```env
PROJECT_AMOUNT_ENCRYPTION_KEY=your-32-byte-key-as-hex-or-base64
```

- **Format:** 32-byte key as **64-character hex** or **44-character base64**
- **Generate a key (hex):** `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- If not set, amounts are stored as plain text (app works normally; add the key when you want encryption)

## Where to Find Values

1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **Settings** → **API**
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (from "Publishable key" section) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Service Role key** (from "Secret key" section) → `SUPABASE_SERVICE_ROLE_KEY`
     - **Important**: This is a secret key. Never share it or prefix it with `NEXT_PUBLIC_`.

## Cloudinary (Internal Notes Attachments)

1. Go to https://cloudinary.com/console
2. Open your Cloudinary dashboard
3. Copy:
   - **Cloud name** → `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
   - **API Key** → `NEXT_PUBLIC_CLOUDINARY_API_KEY`
   - **API Secret** → `CLOUDINARY_API_SECRET` (server-only, never prefix with `NEXT_PUBLIC_`)

## Important Notes

- ✅ File location: `.env.local` in project root (same directory as `package.json`)
- ✅ Variable names are case-sensitive
- ✅ No spaces around `=` sign
- ✅ No quotes around values
- ⚠️ **MUST restart dev server** after creating/updating `.env.local`
- ❌ Never commit `.env.local` to git (already in `.gitignore`)

## Validation

The app validates environment variables at runtime. If missing, you'll see a clear error message with instructions.

## Security

- ✅ `NEXT_PUBLIC_*` variables are safe for browser/client code
- ✅ `SUPABASE_SERVICE_ROLE_KEY` is **REQUIRED** for administrative tasks (User Management).
- ❌ **CRITICAL**: Never prefix `SUPABASE_SERVICE_ROLE_KEY` with `NEXT_PUBLIC_`. It must remain server-side only.

## Troubleshooting

**Error: "Missing required environment variable"**
→ Check that `.env.local` exists and has correct variable names
→ Restart dev server after creating/updating the file

**App still shows errors after adding variables**
→ Verify variable names match exactly (case-sensitive)
→ Check for typos in values
→ Make sure you restarted the dev server

For detailed setup instructions, see [SETUP.md](./SETUP.md).
