import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service role client: RLS'yi atlar, auth.admin API'sine erisir.
// SADECE server tarafinda (route handler / server component) kullanilir;
// client bundle'ina asla import edilmemeli.
export function createAdminClient() {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "Supabase admin client icin SUPABASE_URL ve SUPABASE_SECRET_KEY (veya SUPABASE_SERVICE_ROLE_KEY) gerekli"
    );
  }

  return createSupabaseClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
