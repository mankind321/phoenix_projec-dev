/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { Storage } from "@google-cloud/storage";

export async function POST(req: Request) {
  console.log("📥 Received upload request...");

  try {
    const formData = await req.formData();
    console.log("🧾 FormData entries:", [...formData.keys()]);

    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { success: false, message: "No file uploaded" },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { success: false, message: "Invalid file type. Must be an image." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON!);

    const storage = new Storage({
      projectId: credentials.project_id,
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
    });

    const bucketName = process.env.GOOGLE_BUCKET_PROFILE;
    if (!bucketName) throw new Error("Missing GOOGLE_BUCKET_PROFILE env var");

    const bucket = storage.bucket(bucketName);

    const timestamp = Date.now();
    const safeFileName = file.name.replace(/\s+/g, "_");
    const destination = `uploads/${timestamp}_${safeFileName}`;

    const blob = bucket.file(destination);

    const blobStream = blob.createWriteStream({
      resumable: false,
      contentType: file.type,
      // ❌ Removed "public: true"
      // ✅ UBLA-compliant: let IAM handle access
    });

    await new Promise<void>((resolve, reject) => {
      blobStream.on("finish", resolve);
      blobStream.on("error", reject);
      blobStream.end(buffer);
    });

    const publicUrl = `https://storage.googleapis.com/${bucketName}/${destination}`;

    console.log("✅ Uploaded file:", publicUrl);

    return NextResponse.json({
      success: true,
      message: "File uploaded successfully",
      url: publicUrl,
      path: destination,
    });
  } catch (error: any) {
    console.error("❌ Upload error:", error);
    return NextResponse.json(
      { success: false, message: error.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}