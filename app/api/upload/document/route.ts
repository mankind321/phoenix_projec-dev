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

// Allowed MIME types
const allowedMimeTypes: Record<string, string> = {
  txt: "text/plain",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
};

export async function GET(req: Request) {
  try {
    // 1️⃣ Validate user session
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2️⃣ Extract filename
    const { searchParams } = new URL(req.url);
    const fileName = searchParams.get("name");

    if (!fileName) {
      return NextResponse.json(
        { success: false, message: "Missing file name" },
        { status: 400 }
      );
    }

    // 3️⃣ Extract extension
    const ext = fileName.split(".").pop()?.toLowerCase();

    if (!ext || !allowedMimeTypes[ext]) {
      return NextResponse.json(
        { success: false, message: `Unsupported file type: .${ext}` },
        { status: 400 }
      );
    }

    const contentType = allowedMimeTypes[ext];

    // 4️⃣ Build object name path
    const safeFileName = fileName.replace(/\s+/g, "_");
    const objectName = `uploads/${Date.now()}_${safeFileName}`;
    const file = bucket.file(objectName);

    // 5️⃣ Generate signed URL
    const [uploadUrl] = await file.getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 10 * 60 * 1000,
      contentType,
    });

    // 6️⃣ 🔥 AUDIT TRAIL — Upload Intent
    await logAuditTrail({
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
      actionType: "UPLOAD",
      tableName: "document",
      description: `User requested signed upload URL for file: ${fileName}`,
      ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent: req.headers.get("user-agent") ?? "Unknown",
    });

    return NextResponse.json({
      success: true,
      uploadUrl,
      objectName,
      contentType,
      message: "Signed URL generated successfully",
    });
  } catch (error: any) {
    console.error("❌ Signed URL generation failed:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}