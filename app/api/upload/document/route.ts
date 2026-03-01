/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { logAuditTrail } from "@/lib/auditLogger";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const DISPATCHER_SIGNED_URL = requireEnv("DISPATCHER_SIGNED_URL");
const GOOGLE_BUCKET_DOCUMENT = requireEnv("GOOGLE_BUCKET_DOCUMENT");
const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB

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
    const contentType = body.content_type;
    const documentType = body.document_type;
    const fileSizeRaw = body.file_size;

    // Basic presence validation
    if (
      typeof fileNameRaw !== "string" ||
      typeof documentType !== "string" ||
      typeof contentType !== "string" ||
      fileSizeRaw === undefined
    ) {
      return NextResponse.json(
        { success: false, message: "Missing required upload fields" },
        { status: 400 },
      );
    }

    // Strict type validation
    const fileSize = Number(fileSizeRaw);

    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid file size" },
        { status: 400 },
      );
    }

    if (fileSize > MAX_FILE_SIZE) {
      const sizeInGB = (fileSize / (1024 * 1024 * 1024)).toFixed(2);

      return NextResponse.json(
        {
          success: false,
          message: `Upload blocked. File size is ${sizeInGB} GB. Maximum allowed size per document is 1 GB.`,
        },
        { status: 413 },
      );
    }

    const ALLOWED_CONTENT_TYPES = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      return NextResponse.json(
        { success: false, message: "Unsupported file type" },
        { status: 400 },
      );
    }

    // ----------------------------------------------
    // 3. Normalize filename
    // ----------------------------------------------
    const normalizedFileName = fileNameRaw.trim().replace(/[^\w.\-]/g, "_");

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

      bucket_name: GOOGLE_BUCKET_DOCUMENT,

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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 seconds

    let dispatcherRes: Response;

    try {
      dispatcherRes = await fetch(DISPATCHER_SIGNED_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metadata),
        signal: controller.signal,
        cache: "no-store",
      });
    } catch (err: any) {
      clearTimeout(timeout);

      if (err.name === "AbortError") {
        return NextResponse.json(
          { success: false, message: "Dispatcher request timed out" },
          { status: 504 },
        );
      }

      return NextResponse.json(
        { success: false, message: "Dispatcher unreachable" },
        { status: 502 },
      );
    }

    clearTimeout(timeout);

    let dispatcherJson: any;

    try {
      dispatcherJson = await dispatcherRes.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid dispatcher response" },
        { status: 502 },
      );
    }

    if (!dispatcherRes.ok || dispatcherJson?.status !== "success") {
      console.error("Dispatcher failed:", dispatcherJson);

      return NextResponse.json(
        {
          success: false,
          message: dispatcherJson?.message || "Dispatcher failed",
        },
        { status: dispatcherRes.status || 500 },
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
