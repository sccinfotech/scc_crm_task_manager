/**
 * Validates Supabase environment variables
 * Throws clear errors if required variables are missing
 */

function getEnvVar(name: string, isPublic = false): string {
  const value = process.env[name]

  if (!value) {
    let instructions = `
Missing required environment variable: ${name}

To fix this:
1. Create a file named .env.local in the project root (same directory as package.json)
2. Add the following line:
   ${name}=your_value_here

3. Get your Supabase credentials:
   - Go to https://supabase.com/dashboard
   - Select your project
   - Go to Settings > API
   - Copy the values:`

    if (isPublic) {
      if (name === 'NEXT_PUBLIC_SUPABASE_URL') {
        instructions += `
     - Project URL → NEXT_PUBLIC_SUPABASE_URL`
      } else {
        instructions += `
     - Publishable key (from "Publishable key" section) → NEXT_PUBLIC_SUPABASE_ANON_KEY
       Note: Use the new "Publishable key" format (sb_publishable_...), not legacy "anon" key`
      }
    } else {
      instructions += `
     - service_role key → SUPABASE_SERVICE_ROLE_KEY (server-only)`
    }

    instructions += `

4. Restart your development server after adding .env.local

For more details, see SETUP.md in the project root.`

    throw new Error(instructions.trim())
  }

  return value
}

/**
 * Check if Supabase client env vars are available (e.g. for optional client features).
 * Use this to avoid throwing when vars are missing; do not use for required server logic.
 */
export function hasSupabaseClientConfig(): boolean {
  return Boolean(
    typeof process !== 'undefined' &&
      process.env?.NEXT_PUBLIC_SUPABASE_URL &&
      process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

/**
 * Get Supabase URL (public, safe for browser)
 */
export function getSupabaseUrl(): string {
  return getEnvVar('NEXT_PUBLIC_SUPABASE_URL', true)
}

/**
 * Get Supabase anon key (public, safe for browser)
 */
export function getSupabaseAnonKey(): string {
  return getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY', true)
}

/**
 * Get Supabase service role key (server-only, never expose to browser)
 * Note: Currently not used in this project, but available for future admin operations
 */
export function getSupabaseServiceRoleKey(): string {
  // Only allow this in server context
  if (typeof window !== 'undefined') {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY must never be used in browser/client code. ' +
      'It bypasses Row Level Security and should only be used in server-side admin operations.'
    )
  }
  return getEnvVar('SUPABASE_SERVICE_ROLE_KEY', false)
}

