/* eslint-disable @typescript-eslint/no-explicit-any */
export function relaxDSL(dsl: any) {
  if (!dsl) return dsl;

  const relaxed = JSON.parse(JSON.stringify(dsl));

  relaxed.filters = (dsl.filters || []).filter((f: any) => {
    if (f.field === "status") return false;
    if (f.field === "address" && f.op === "like") return false;
    return true;
  });

  return relaxed;
}