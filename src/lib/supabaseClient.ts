import { createClient } from '@supabase/supabase-js'

// This is a Vite app (see vite.config.ts / import.meta usage elsewhere), so
// env vars come through import.meta.env and MUST be prefixed with VITE_ —
// Vite strips anything without that prefix before it reaches the client
// bundle. Set these in a .env file at the project root (see .env.example).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your project values.',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Keeps the session (and therefore the anonymous user's identity)
    // persisted in localStorage across reloads/tabs, and refreshes the
    // token automatically — this is what makes points "synced across
    // sessions" instead of reset every visit.
    persistSession: true,
    autoRefreshToken: true,
  },
})
