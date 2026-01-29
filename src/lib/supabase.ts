import { createClient } from '@supabase/supabase-js';

// These environment variables need to be set in your .env file
// VITE_SUPABASE_URL=https://your-project.supabase.co
// VITE_SUPABASE_ANON_KEY=your-anon-key

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isValidUrl = (url: string) => {
  try {
    return url && url.startsWith('http') && !url.includes('your_supabase_url');
  } catch {
    return false;
  }
};

export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey && 
                                   isValidUrl(supabaseUrl) &&
                                   !supabaseUrl.includes('placeholder') && 
                                   !supabaseAnonKey.includes('placeholder');

if (!isSupabaseConfigured) {
  // Supabase is not configured. 
  // Running in local/offline mode.
}

// Singleton pattern to prevent "Multiple GoTrueClient instances" warning during HMR
const globalSupabase = globalThis as unknown as { _supabase: ReturnType<typeof createClient> | undefined };

export const supabase = globalSupabase._supabase ?? createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

if (import.meta.env.DEV) {
  globalSupabase._supabase = supabase;
}
