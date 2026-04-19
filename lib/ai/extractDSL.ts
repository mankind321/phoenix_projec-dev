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

TYPE FIELD (IMPORTANT):

- "type" includes BOTH:
  1. Property type → office, retail, industrial, etc.
  2. Tenancy type → MultiTenant, SingleTenant

- Tenancy values MUST be EXACT:
  MultiTenant
  SingleTenant

- Examples:
  "multi tenant office" →
    { field: "type", op: "=", value: "MultiTenant" }
    { field: "type", op: "=", value: "office" }

  "single tenant retail" →
    { field: "type", op: "=", value: "SingleTenant" }
    { field: "type", op: "=", value: "retail" }

- If ONLY tenancy is mentioned:
  "multi tenant" →
    { field: "type", op: "=", value: "MultiTenant" }

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

- Normalize tenancy keywords:
  "multi tenant", "multi-tenant", "multitenant", "MultiTenant" → MultiTenant
  "single tenant", "single-tenant", "singletenant", "SingleTenant" → SingleTenant

- Multiple states MUST ALWAYS be returned as an array:
  - "Texas and Florida" → state in ["TX","FL"]

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

- NEVER return a single state if multiple states are present.

- Apply SAME logic for cities.

VALIDATION RULE:

- If multiple values are mentioned, output MUST include ALL of them.

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
