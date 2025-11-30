
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.supabaseAccessToken) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${session.user.supabaseAccessToken}`,
        },
      },
    }
  );

  const { data, error } = await supabase.rpc("debug_jwt_values");

  return NextResponse.json({ data, error });
}
