import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    // 1️⃣ Update account status in database
    await supabase
      .from("accounts_status")
      .update({ account_status: "offline" })
      .eq("account_id", session.user.accountId)
      .eq("username", session.user.username);

    // 2️⃣ Clear NextAuth cookies
    const res = NextResponse.json({ success: true });
    res.cookies.set("next-auth.session-token", "", { expires: new Date(0) });
    res.cookies.set("next-auth.csrf-token", "", { expires: new Date(0) });

    return res;
  }

  return NextResponse.json({ success: true });
}
