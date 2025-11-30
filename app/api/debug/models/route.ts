/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY!;
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}