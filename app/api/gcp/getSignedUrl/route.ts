import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

export const runtime = "nodejs";
process.env.GAX_GCN_DISALLOW_IPv6 = "true";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { Storage } from "@google-cloud/storage";

const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON!);

const storage = new Storage({
  projectId: credentials.project_id,
  credentials: {
    client_email: credentials.client_email,
    private_key: credentials.private_key,
  },
});

const bucket = storage.bucket(process.env.GOOGLE_BUCKET_PROFILE!);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawPath = searchParams.get("path");

    if (!rawPath || rawPath === "undefined" || rawPath.trim() === "") {
      return NextResponse.json({ success: false, message: "❌ Missing or invalid file path" }, { status: 400 });
    }

    // Decode any URL encoding (handles %2Fuploads%2F etc.)
    const decodedPath = decodeURIComponent(rawPath);

    let cleanPath = decodedPath;

    // 🧩 Handle if a full GCS URL was passed
    if (decodedPath.startsWith("http")) {
      const match = decodedPath.match(/\/uploads\/([^?]+)/);
      if (match && match[1]) {
        cleanPath = `uploads/${match[1]}`;
      } else {
        return NextResponse.json({ success: false, message: "❌ Invalid URL format (missing /uploads/ segment)" }, { status: 400 });
      }
    }

    // Final sanity check
    if (!cleanPath || cleanPath.includes("undefined")) {
      return NextResponse.json({ success: false, message: "❌ Invalid clean path" }, { status: 400 });
    }

    const file = bucket.file(cleanPath);

    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json({ success: false, message: `❌ File not found: ${cleanPath}` }, { status: 404 });
    }

    // ✅ Generate signed URL valid for 1 hour
    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 60 * 60 * 1000,
    });

    return NextResponse.json({ success: true, url: signedUrl });
  } catch (error: any) {
    console.error("⚠️ getSignedUrl error:", error);
    return NextResponse.json({ success: false, message: `GCP error: ${error.message}` }, { status: 500 });
  }
}