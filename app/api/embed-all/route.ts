/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: "api" } }
);

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY!);
const MODEL = "models/text-embedding-004";

// -------------------------------------------
// Helper: Generate Embedding
// -------------------------------------------
async function embedText(text: string): Promise<number[]> {
  if (!text || text.trim() === "") return new Array(1536).fill(0);

  const model = genAI.getGenerativeModel({ model: MODEL });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

// -------------------------------------------
// POST /api/embed-all
// -------------------------------------------
export async function POST() {
  try {
    // ----------------------------
    // 1. Fetch all data (PROPERTY)
    // ----------------------------
    const { data: properties } = await supabase
      .from("property")
      .select("*")
      .is("embedding", null);

    // ----------------------------
    // 2. Generate embeddings
    // ----------------------------
    for (const row of properties ?? []) {
      const text = [
        row.name,
        row.address,
        row.city,
        row.state,
        row.type,
        row.status,
        row.comments,
      ]
        .filter(Boolean)
        .join(" ");

      const embedding = await embedText(text);

      await supabase
        .from("property")
        .update({ embedding })
        .eq("property_id", row.property_id);

      console.log("✅ Embedded property:", row.property_id);
    }

    // ----------------------------
    // 3. Lease embeddings
    // ----------------------------
    const { data: leases } = await supabase
      .from("lease")
      .select("*")
      .is("embedding", null);

    for (const row of leases ?? []) {
      const text = [
        row.tenant,
        row.landlord,
        row.status,
        row.comments,
      ]
        .filter(Boolean)
        .join(" ");

      const embedding = await embedText(text);

      await supabase
        .from("lease")
        .update({ embedding })
        .eq("lease_id", row.lease_id);

      console.log("✅ Embedded lease:", row.lease_id);
    }

    // ----------------------------
    // 4. Document embeddings
    // ----------------------------
    const { data: documents } = await supabase
      .from("document")
      .select("*")
      .is("embedding", null);

    for (const row of documents ?? []) {
      const text = [
        row.doc_type,
        row.comments,
        row.file_url,
      ]
        .filter(Boolean)
        .join(" ");

      const embedding = await embedText(text);

      await supabase
        .from("document")
        .update({ embedding })
        .eq("document_id", row.document_id);

      console.log("✅ Embedded document:", row.document_id);
    }

    return NextResponse.json({
      success: true,
      message: "All embeddings generated successfully.",
    });
  } catch (err: any) {
    console.error("❌ EMBEDDING ERROR", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
