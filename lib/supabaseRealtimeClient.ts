/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";

let realtimeClient: any = null;   // 👈 SINGLETON

export function createRealtimeClient(accessToken: string) {

  if (realtimeClient) return realtimeClient;

  realtimeClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: {
        params: { eventsPerSecond: 10 },
      },
    }
  );

  // 🔑 REQUIRED AFTER SOCKET EXISTS
  realtimeClient.realtime.setAuth(accessToken);

  return realtimeClient;
}