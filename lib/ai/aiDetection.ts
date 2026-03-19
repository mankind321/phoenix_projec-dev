export function isAiQuery(text: string | null): boolean {
  if (!text) return false;

  const t = text.toLowerCase().trim().replace(/\s+/g, " ");

  // -----------------------------------------
  // 1️⃣ Detect numeric street address → NOT AI
  // -----------------------------------------
  const addressPattern = /^[\d]+\s+[a-z]/i;
  if (addressPattern.test(t)) {
    return false;
  }

  // -----------------------------------------
  // 🔥 NEW: PROPERTY INTENT (HIGH PRIORITY)
  // -----------------------------------------
  const propertyKeywords = [
    "property",
    "properties",
    "building",
    "buildings",
    "space",
    "spaces",
    "unit",
    "units",
    "real estate",
    "commercial space",
  ];

  const hasPropertyIntent = propertyKeywords.some((k) => t.includes(k));

  // 👉 If user clearly refers to properties → AI
  if (hasPropertyIntent) {
    return true;
  }

  // -----------------------------------------
  // 2️⃣ Financial / Investment Indicators
  // -----------------------------------------
  const financialPattern = /\b(\d+(\.\d+)?\s?(k|m|million|b|billion))\b/;
  const percentPattern = /\b\d+(\.\d+)?\s?%|\bpercent\b|\bcap rate\b/;

  const comparisonPattern =
    /\b(above|below|over|under|more than|less than|between|to|outside|at least|at most|greater than|less than or equal)\b/;

  if (
    financialPattern.test(t) ||
    percentPattern.test(t) ||
    comparisonPattern.test(t)
  ) {
    return true;
  }

  // -----------------------------------------
  // 2.5️⃣ Structured filter / negation detection
  // -----------------------------------------
  const negationPattern = /\b(not|exclude|without|except|outside)\b/;
  const locationFilterPattern = /\b(on|in|at)\s+[a-z]/;

  if (negationPattern.test(t) && locationFilterPattern.test(t)) {
    return true;
  }

  // -----------------------------------------
  // 3️⃣ Natural language intent keywords
  // -----------------------------------------
  const aiKeywords = [
    "near",
    "nearby",
    "around",
    "within",
    "radius",
    "distance",
    "close to",
    "next to",
    "beside",
    "km",
    "mile",
    "meter",
    "walking distance",
    "driving distance",
    "find",
    "show me",
    "search for",
    "looking for",
  ];

  if (aiKeywords.some((keyword) => t.includes(keyword))) {
    return true;
  }

  // -----------------------------------------
  // 4️⃣ Question pattern
  // -----------------------------------------
  const questionPattern = /^(where|find|show|list|get|search|what|which)\b/i;

  if (questionPattern.test(t)) {
    return true;
  }

  // -----------------------------------------
  // 5️⃣ Structured query detection (SAFE)
  // -----------------------------------------
  const structuredPattern = /\b(in|on|at|with|having|where)\b/;

  if (structuredPattern.test(t) && t.split(" ").length >= 4) {
    return true;
  }

  // -----------------------------------------
  // 6️⃣ Type-only detection (NEW FIX)
  // -----------------------------------------
  const typeKeywords = [
    "industrial",
    "office",
    "retail",
    "mixed use",
    "multifamily",
    "apartment",
    "warehouse",
    "commercial",
    "residential",
    "restaurant",
    "food",
    "fast food",
  ];

  const hasTypeKeyword = typeKeywords.some((keyword) => t.includes(keyword));

  // 👉 allow short queries like "office", "retail", "fast food"
  if (hasTypeKeyword && t.split(" ").length <= 3) {
    return true;
  }

  // -----------------------------------------
  // 7️⃣ Status detection
  // -----------------------------------------
  const statusKeywords = [
    "available",
    "occupied",
    "leased",
    "sold",
    "pending",
    "off market",
    "under maintenance",
  ];

  const hasStatusKeyword = statusKeywords.some((k) =>
    new RegExp(`\\b${k}\\b`).test(t),
  );
  const hasLogicalOperator = /\b(and|or|not)\b/.test(t);

  if (hasStatusKeyword && hasLogicalOperator) {
    return true;
  }

  return false;
}