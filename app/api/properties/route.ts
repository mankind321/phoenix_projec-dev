import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

export const runtime = "nodejs";
process.env.GAX_GCN_DISALLOW_IPv6 = "true";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Storage } from "@google-cloud/storage";

// ----------------------------------------------
// 🔐 Create Supabase Client with HEADER-BASED RLS
// ----------------------------------------------
function createRlsClient(headers: Record<string, string>) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // MUST use service-role for header-based RLS
    {
      db: { schema: "api" },
      global: { headers },
    }
  );
}

// ----------------------------------------------
// ☁️ GCP Storage
// ----------------------------------------------
const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON!);

const storage = new Storage({
  projectId: credentials.project_id,
  credentials: {
    client_email: credentials.client_email,
    private_key: credentials.private_key,
  },
});

const bucket = storage.bucket(process.env.GOOGLE_BUCKET_DOCUMENT!);

async function getSignedUrl(path: string): Promise<string | null> {
  try {
    const [url] = await bucket.file(path).getSignedUrl({
      action: "read",
      expires: Date.now() + 60 * 60 * 1000,
    });
    return url;
  } catch (err) {
    console.error("Signed URL error:", err);
    return null;
  }
}

// ----------------------------------------------
// ⚠️ Allowed sort fields
// ----------------------------------------------
const ALLOWED_SORT_FIELDS = new Set([
  "property_created_at",
  "property_updated_at",
  "price",
  "cap_rate",
  "name",
]);

// ----------------------------------------------
// 📌 GET — EVERY USER CAN ACCESS PROPERTIES
// ----------------------------------------------
export async function GET(req: Request) {
  try {
    // 1️⃣ Authenticate user
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2️⃣ Build RLS headers for Supabase
    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    };

    // 3️⃣ Create Supabase RLS client
    const supabase = createRlsClient(rlsHeaders);

    const { searchParams } = new URL(req.url);

    // Pagination
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 9;
    const offset = (page - 1) * limit;

    // Filters
    const search = (searchParams.get("search") || "").trim();
    const type = searchParams.get("type");
    const status = searchParams.get("status");

    // Sorting
    const sortField = searchParams.get("sortField") || "property_created_at";
    const sortOrder =
      (searchParams.get("sortOrder") || "desc").toLowerCase() === "asc"
        ? "asc"
        : "desc";

    const field = ALLOWED_SORT_FIELDS.has(sortField)
      ? sortField
      : "property_created_at";

    // ----------------------------------------------
    // 4️⃣ Base Query (RLS + secure view)
    // ----------------------------------------------
    let query = supabase
      .from("vw_property_with_image")
      .select(
        `
        property_id,
        name,
        landlord,
        address,
        city,
        state,
        type,
        status,
        price,
        cap_rate,
        file_url,
        latitude,
        longitude
      `,
        { count: "exact" }
      )
      .neq("status", "Review"); // hide review properties from all users

    // 🔍 Text Search (name, address, city, state)
    if (search) {
      // Optional: small sanitize to avoid breaking the OR string with commas
      const safeSearch = search.replace(/,/g, " ");

      query = query.or(
        `name.ilike.%${safeSearch}%,` +
          `address.ilike.%${safeSearch}%,` +
          `city.ilike.%${safeSearch}%,` +
          `state.ilike.%${safeSearch}%`
      );
    }

    // 🎯 Filters
    if (type && type !== "All") query = query.eq("type", type);
    if (status && status !== "All") query = query.eq("status", status);

    // Sorting & Pagination
    query = query
      .order(field, { ascending: sortOrder === "asc" })
      .range(offset, offset + limit - 1);

    // 5️⃣ Execute
    const { data, count, error } = await query;

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 6️⃣ Replace file_url with signed URL
    const signedData = await Promise.all(
      (data ?? []).map(async (p) => ({
        ...p,
        file_url: p.file_url ? await getSignedUrl(p.file_url) : null,
      }))
    );

    return NextResponse.json({
      success: true,
      data: signedData,
      total: count ?? 0,
      page,
      limit,
    });
  } catch (err: any) {
    console.error("API Error:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
