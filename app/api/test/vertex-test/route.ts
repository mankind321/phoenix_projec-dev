/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function GET() {
  try {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY!;
    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
      model: "models/gemini-2.5-flash",
    });

    const result = await model.generateContent(
      "Say: Gemini 2.5 Flash is working!"
    );

    return NextResponse.json({
      success: true,
      message: result.response.text(),
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    });
  }
}