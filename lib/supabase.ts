import { createClient } from '@supabase/supabase-js';

// These environment variables will need to be set in your .env file
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase URL or Anon Key is missing. The app will default to offline mode (localStorage) or fail if offline support isn\'t fully implemented.'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: !!supabaseUrl && !!supabaseAnonKey,
      autoRefreshToken: !!supabaseUrl && !!supabaseAnonKey,
      detectSessionInUrl: !!supabaseUrl && !!supabaseAnonKey,
    },
  }
);

export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;
