/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { logAuditTrail } from "@/lib/auditLogger";

// Service-role OK because we restrict by session.user.id
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: "public" } }
);

export async function PUT(req: Request) {
  try {
    // 1️⃣ Validate session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2️⃣ Parse input
    const body = await req.json();
    const form = body?.formData;

    if (!form) {
      return NextResponse.json(
        { success: false, message: "Invalid request payload" },
        { status: 400 }
      );
    }

    const userId = session.user.id;

    // 3️⃣ Update profile (Owner-only)
    const { error } = await supabase
      .from("usersacc")
      .update({
        first_name: form.firstName,
        middle_name: form.middleName,
        last_name: form.lastName,
        date_of_birth: form.dateOfBirth,
        gender: form.gender,
        email: form.email,
        mobile: form.mobile,
        address: form.address,
        license_number: form.licenseNumber,
        license_issued_by: form.licenseIssuedBy,
        license_expiration: form.licenseExpiration,
        profile_image_url: form.profileImageUrl,
        updatedby: session.user.username ?? "system",
        updated_at: new Date().toISOString(),
      })
      .eq("userid", userId); // Enforces user can only update THEIR OWN record

    if (error) {
      console.error("❌ Supabase Update Error:", error);
      throw error;
    }

    // 4️⃣ Audit log (safe + correct)
    await logAuditTrail({
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
      actionType: "UPDATE",
      tableName: "usersacc",
      recordId: String(userId),
      description: `Updated own profile information`,
      ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent: req.headers.get("user-agent") ?? "Unknown",
    });

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully ✅",
    });

  } catch (err: any) {
    console.error("❌ PUT /api/profile/update:", err.message);

    return NextResponse.json(
      { success: false, message: "Server error: " + err.message },
      { status: 500 }
    );
  }
}