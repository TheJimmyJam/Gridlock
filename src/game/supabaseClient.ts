import { createClient } from '@supabase/supabase-js';

// The anon key is safe to ship in the client bundle — it's meant to be
// public. Row Level Security (see the `gridlock_saves` table policy) is
// the actual security boundary, not this key being secret.
const SUPABASE_URL = 'https://eoeajvhykkxeohvlfnoi.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvZWFqdmh5a2t4ZW9odmxmbm9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NjM1MjEsImV4cCI6MjA5MTIzOTUyMX0.9CxozctRRhgLJqmM-Y-R2zaATUImWTnT8hYyCbwYp9Y';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
