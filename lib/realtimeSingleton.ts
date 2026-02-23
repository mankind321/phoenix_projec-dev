import { createClient, SupabaseClient } from "@supabase/supabase-js";

let realtimeClient: SupabaseClient | null = null;

export function getRealtimeClient(jwt: string) {
  if (!realtimeClient) {
    realtimeClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    realtimeClient.realtime.setAuth(jwt);
  }

  return realtimeClient;
}