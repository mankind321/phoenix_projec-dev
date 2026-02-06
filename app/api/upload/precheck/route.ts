/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    console.log("========== PRECHECK DEBUG (BE) ==========");

    const session = await getServerSession(authOptions);

    console.log("Session user:", session?.user);

    if (!session?.user?.id) {
      console.log("Unauthorized request");

      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();

    console.log("Request body:", body);

    const fileNames: string[] = body.file_names;

    console.log("File names received:", fileNames);

    if (!fileNames || fileNames.length === 0) {
      console.log("No filenames provided");

      return NextResponse.json(
        { success: false, message: "No filenames provided" },
        { status: 400 }
      );
    }

    // 🔎 Query Supabase
    const { data: failedDocs, error } = await supabaseAdmin
      .from("document_registry")
      .select("file_id, file_name, extraction_status")
      .in("file_name", fileNames)
      .eq("extraction_status", "FAILED");

    console.log("Supabase query result:", failedDocs);
    console.log("Supabase error:", error);

    if (error) {
      console.error("Database error:", error);

      return NextResponse.json(
        { success: false, message: "Database error" },
        { status: 500 }
      );
    }

    if (failedDocs && failedDocs.length > 0) {
      console.log("FAILED FILES FOUND:", failedDocs);

      return NextResponse.json(
        {
          success: false,
          message:
            "Some files are in FAILED extraction list",
          failed_files: failedDocs,
        },
        { status: 409 }
      );
    }

    console.log("✅ No failed files found");
    console.log("=========================================");

    return NextResponse.json({
      success: true,
      message: "All files passed precheck",
    });
  } catch (error: any) {
    console.error("❌ Precheck fatal error:", error);

    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

