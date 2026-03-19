import { GoogleGenerativeAI } from "@google/generative-ai";
import { MODEL } from "@/lib/constants/config";

const genAI = new GoogleGenerativeAI(
  process.env.GOOGLE_GENAI_API_KEY!,
);

export async function extractDSL(prompt: string) {
  const model = genAI.getGenerativeModel({ model: MODEL });

  const instruction = `
Return EXACTLY one valid JSON object. No text, no code blocks.

SCHEMA:
{
  "geo": { "location_text": string|null, "radius_m": number|null },
  "filters": [{ "field": string, "op": string, "value": any }],
  "sort": null,
  "limit": 20,
  "offset": 0
}

FIELDS (ONLY these):
type, price, cap_rate, state, city, address, status

RULES:
- Use ONLY allowed fields (map "property type"→type, "cap rate"→cap_rate)
- Operators: = != > < >= <= in not_in between not_between like not_like
- between/not_between → [min,max]; in/not_in → array
- price: convert k/m/b (2M→2000000)
- cap_rate: number (6 = 6%, NOT 0.06)
- text → LIKE (%value%)
- "on Market Street" → address like "%Market Street%"
- "not on Market Street" → address not_like "%Market Street%"
- multiple streets → address in ["..."]

SPECIAL:
- "TX and NC" → state in ["TX","NC"]
- "outside TX and NC" → state not_in ["TX","NC"]
- "not in Charlotte" → city != "Charlotte"

SORT:
- highest price → price desc
- lowest price → price asc
- best cap rate → cap_rate desc
- latest → created_at desc

LIMIT:
- singular intent → limit 1

User: "${prompt}"
`;

  const result = await model.generateContent(instruction);

  const raw = result.response.text();

  const text = raw.replace(/```json|```/g, "").trim();

  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray(parsed.filters)) parsed.filters = [];
    return parsed;
  } catch {
    console.error("❌ DSL parse failed");
    return null;
  }
}
