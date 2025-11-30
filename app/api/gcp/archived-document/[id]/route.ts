/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Storage } from "@google-cloud/storage";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAuditTrail } from "@/lib/auditLogger";

// ============================================================
// 🔐 Supabase — SERVICE ROLE
// ============================================================
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================
// ☁️ Google Cloud Storage — DOCUMENT BUCKET
// ============================================================
const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON!);

const storage = new Storage({
  projectId: credentials.project_id,
  credentials: {
    client_email: credentials.client_email,
    private_key: credentials.private_key,
  },
});

// MUST use GOOGLE_BUCKET_DOCUMENT
const bucket = storage.bucket(process.env.GOOGLE_BUCKET_DOCUMENT!);

// ============================================================
// 📦 ARCHIVE PROPERTY DOCUMENTS
// ============================================================
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: propertyId } = await params;

  try {
    // Session validation
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    // ------------------------------------------------------------
    // 1️⃣ Get all documents for the property
    // ------------------------------------------------------------
    const { data: docs, error: docError } = await supabase
      .from("document")
      .select("document_id, file_url")
      .eq("property_id", propertyId);

    if (docError) {
      return NextResponse.json({ success: false, message: "Failed to fetch documents" });
    }

    if (!docs || docs.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No documents to archive."
      });
    }

    // ------------------------------------------------------------
    // 2️⃣ Move each document: replace first folder with "archived"
    // ------------------------------------------------------------
    for (const doc of docs) {
      if (!doc.file_url) continue;

      const oldPath = doc.file_url;   // e.g., "image/File.img"

      // Normalize slashes
      const normalized = oldPath.replace(/\\/g, "/");

      // Split into folder + file
      const parts = normalized.split("/");

      // Replace first folder with "archived"
      parts[0] = "archived";

      // New file location
      const newPath = parts.join("/");

      const oldFile = bucket.file(normalized);
      const newFile = bucket.file(newPath);

      // Copy → Delete (Move)
      await oldFile.copy(newFile);
      await oldFile.delete();
    }

    // ------------------------------------------------------------
    // 3️⃣ Audit log
    // ------------------------------------------------------------
    await logAuditTrail({
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
      actionType: "UPDATE",
      tableName: "document",
      recordId: propertyId,
      description: `Archived all documents for property ${propertyId}`,
      ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent: req.headers.get("user-agent") ?? "Unknown"
    });

    return NextResponse.json({
      success: true,
      message: "Documents archived successfully."
    });

  } catch (error: any) {
    console.error("❌ Archive Error:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
