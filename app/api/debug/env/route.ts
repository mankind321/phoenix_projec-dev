import { NextResponse } from "next/server";

export async function GET() {
  console.log(process.env.GOOGLE_GENAI_API_KEY);
  return NextResponse.json({
    GOOGLE_API_KEY: process.env.GOOGLE_GENAI_API_KEY || "NOT LOADED",
  });
}
