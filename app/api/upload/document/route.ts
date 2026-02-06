/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { logAuditTrail } from "@/lib/auditLogger";

const DISPATCHER_SIGNED_URL =
  "https://upload-dispatcher-283806001440.us-west2.run.app/preupload/signed-url";

export async function POST(req: Request) {
  try {
    console.log("======================================");
    console.log("📥 Upload Init Request");
    console.log("======================================");

    // ----------------------------------------------
    // 1. Validate session
    // ----------------------------------------------
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 },
      );
    }

    // ----------------------------------------------
    // 2. Parse request body
    // ----------------------------------------------
    const body = await req.json();

    const fileNameRaw = body.file_name;
    const contentType = body.content_type || "application/octet-stream";

    const documentType = body.document_type;
    const fileSize = body.file_size;

    if (!fileNameRaw || !documentType) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing file_name or document_type",
        },
        { status: 400 },
      );
    }

    // ----------------------------------------------
    // 3. Normalize filename
    // ----------------------------------------------
    const normalizedFileName = fileNameRaw.trim().replace(/\s+/g, "_");

    // ----------------------------------------------
    // 4. Generate upload path
    // ----------------------------------------------
    const filePath = `uploads/${Date.now()}_${normalizedFileName}`;

    // ----------------------------------------------
    // 5. Build metadata
    // ----------------------------------------------
    const metadata = {
      file_name: normalizedFileName,

      file_path: filePath,

      bucket_name: process.env.GOOGLE_BUCKET_DOCUMENT,

      content_type: contentType,

      file_size: fileSize,

      upload_timestamp: new Date().toISOString(),

      user_id: session.user.id,

      session_id: (session as any)?.session_id || null,

      service_key_role: (session.user.role || "user").toLowerCase(),

      document_type: documentType,
    };

    console.log("📝 Sending metadata to dispatcher:", metadata);

    // ----------------------------------------------
    // 6. Call dispatcher for signed URL
    // ----------------------------------------------
    const dispatcherRes = await fetch(DISPATCHER_SIGNED_URL, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(metadata),
    });

    const dispatcherJson = await dispatcherRes.json();

    if (!dispatcherRes.ok || dispatcherJson.status !== "success") {
      console.error("Dispatcher failed:", dispatcherJson);

      return NextResponse.json(
        {
          success: false,
          message: dispatcherJson.message || "Dispatcher failed",
        },
        { status: dispatcherRes.status },
      );
    }

    const { signed_url, upload_path, file_id } = dispatcherJson;

    // ----------------------------------------------
    // 7. Audit trail
    // ----------------------------------------------
    await logAuditTrail({
      userId: session.user.id,

      username: session.user.username || session.user.email || "unknown",

      role: session.user.role || "user",

      actionType: "UPLOAD_INIT",

      tableName: "document",

      description: `Upload initialized: ${normalizedFileName}`,

      ipAddress: req.headers.get("x-forwarded-for") ?? "unknown",

      userAgent: req.headers.get("user-agent") ?? "unknown",
    });

    console.log("✅ Signed URL generated successfully");

    // ----------------------------------------------
    // 8. Return signed URL
    // ----------------------------------------------
    return NextResponse.json({
      success: true,

      signed_url,

      file_path: upload_path,

      file_id,

      metadata,
    });
  } catch (error: any) {
    console.error("🔥 Upload init error:", error);

    return NextResponse.json(
      {
        success: false,
        message: error.message || "Internal server error",
      },
      { status: 500 },
    );
  }
}
