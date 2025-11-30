/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Storage } from "@google-cloud/storage";
import { logAuditTrail } from "@/lib/auditLogger";

const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON!);

const storage = new Storage({
  projectId: credentials.project_id,
  credentials: {
    client_email: credentials.client_email,
    private_key: credentials.private_key,
  },
});

const bucket = storage.bucket(process.env.GOOGLE_BUCKET_DOCUMENT!);

export async function GET(req: Request) {
  try {
    // 1️⃣ Validate session
    const session = await getServerSession(authOptions);
    const user = session?.user;

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2️⃣ Extract file path from query string
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get("path");

    if (!filePath) {
      return NextResponse.json(
        { success: false, message: "Missing file path" },
        { status: 400 }
      );
    }

    // Normalize path (in case gs://bucket/... is passed)
    const cleanPath = filePath
      .replace("gs://", "")
      .replace(process.env.GOOGLE_BUCKET_DOCUMENT + "/", "")
      .replace(/^\/+/, ""); // remove leading slash

    // 3️⃣ Get file reference from GCP bucket
    const file = bucket.file(cleanPath);

    // 4️⃣ Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json(
        { success: false, message: "File not found in GCP" },
        { status: 404 }
      );
    }

    // 5️⃣ Download file buffer
    const [contents] = await file.download();

    // 6️⃣ Determine file name from path
    const fileName = cleanPath.split("/").pop() ?? "download";

    // 7️⃣ AUDIT LOG — record the download
    await logAuditTrail({
      userId: user.id,
      username: user.username,
      role: user.role,
      actionType: "DOWNLOAD",
      tableName: "document_user",
      description: `Downloaded file: ${fileName}`,
      ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent: req.headers.get("user-agent") ?? "Unknown",
    });

    // 8️⃣ Return file as download response
    return new Response(new Uint8Array(contents), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });

  } catch (error: any) {
    console.error("❌ File download failed:", error);

    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}