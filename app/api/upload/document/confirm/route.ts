/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { Storage } from "@google-cloud/storage";
import { logAuditTrail } from "@/lib/auditLogger";

const storage = new Storage({
  projectId: process.env.GOOGLE_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

const bucket = storage.bucket(process.env.GOOGLE_BUCKET_DOCUMENT!);

// Allowed MIME types (same as frontend)
const allowedMimeTypes = [
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
];

export async function POST(req: Request) {
  try {
    // 1️⃣ Validate authenticated session
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2️⃣ Parse body
    const body = await req.json();
    const { fileName, objectName } = body;

    if (!fileName || !objectName) {
      return NextResponse.json(
        { success: false, message: "Missing file info" },
        { status: 400 }
      );
    }

    // 3️⃣ Get file from Google Cloud Storage
    const file = bucket.file(objectName);
    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json(
        { success: false, message: `File not found in storage: ${objectName}` },
        { status: 404 }
      );
    }

    // 4️⃣ Validate MIME type from GCP
    const [meta] = await file.getMetadata();
    const mimeType = meta.contentType || "";

    if (!allowedMimeTypes.includes(mimeType)) {
      return NextResponse.json(
        { success: false, message: `Unsupported file type: ${mimeType}` },
        { status: 400 }
      );
    }

    // 5️⃣ Build metadata for GCP (flatten session)
    const metadata: Record<string, string> = {};
    const flatten = (obj: Record<string, any>, prefix = "") => {
      for (const [key, value] of Object.entries(obj)) {
        const newKey = prefix ? `${prefix}_${key}` : key;
        if (typeof value === "object" && value !== null) {
          flatten(value, newKey);
        } else {
          metadata[newKey.toLowerCase()] = String(value ?? "");
        }
      }
    };
    flatten(session);

    // Add request information
    metadata["ip"] = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    metadata["useragent"] = req.headers.get("user-agent") || "unknown";
    metadata["confirmed_at"] = new Date().toISOString();
    metadata["filename"] = fileName;
    metadata["filetype"] = mimeType;

    // 6️⃣ Attach metadata into GCP Object
    await file.setMetadata({ metadata });

    // 7️⃣ Retrieve final metadata
    const [after] = await file.getMetadata();

    // 8️⃣ 🔥 AUDIT TRAIL — FINAL FILE CREATED
    await logAuditTrail({
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
      actionType: "CREATE",
      tableName: "document",
      description: `Uploaded & confirmed document: ${fileName}`,
      ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent: req.headers.get("user-agent") ?? "Unknown",
    });

    return NextResponse.json({
      success: true,
      message: "File confirmed and metadata attached successfully",
      file: {
        fileName,
        path: objectName,
        bucket: bucket.name,
        mimeType,
        publicUrl: `https://storage.googleapis.com/${bucket.name}/${objectName}`,
        metadata: after.metadata,
      },
    });
  } catch (error: any) {
    console.error("❌ Confirm error:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}