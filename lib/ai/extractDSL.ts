import { GoogleGenerativeAI } from "@google/generative-ai";
import { MODEL } from "@/lib/constants/config";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY!);

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

- ALWAYS extract ALL entities mentioned. NEVER drop any value.

- Multiple states MUST ALWAYS be returned as an array:
  - "Texas and Florida" → state in ["TX","FL"]
  - "TX and NC" → state in ["TX","NC"]
  - "in Texas, Florida, and Georgia" → state in ["TX","FL","GA"]

- Convert FULL state names to 2-letter codes:
  Texas → TX
  Florida → FL
  California → CA
  New York → NY
  North Carolina → NC

- If MORE THAN ONE state is mentioned:
  → op MUST be "in"
  → value MUST be an array

- If excluding multiple states:
  → op MUST be "not_in"
  → value MUST be an array

- NEVER return a single state if multiple states are present in the user input.

- Apply the SAME logic for cities:
  "Charlotte and Dallas" → city in ["Charlotte","Dallas"]

VALIDATION RULE:

- If multiple values are mentioned in the input, the output MUST include ALL of them.
- Do NOT omit or reduce values.

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
