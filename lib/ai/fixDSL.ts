/* eslint-disable @typescript-eslint/no-explicit-any */

import { normalizeStatusValue } from "@/lib/dsl/normalize";
import { resolveState } from "../dsl/validateDSL";

export function fixKnownAIIssues(dsl: any) {
  if (!dsl?.filters) return dsl;

  for (const f of dsl.filters) {
    // ----------------------------------
    // 🏷️ STATUS FIXES
    // ----------------------------------
    if (f.field === "status" && typeof f.value === "string") {
      const v = f.value.toLowerCase().trim();

      const STATUS_FIX_MAP: Record<string, string> = {
        active: "Available",
        inactive: "Not Available",
        unavailable: "Not Available",
        vacant: "Available",
        leased: "Occupied",
        rented: "Occupied",
      };

      if (STATUS_FIX_MAP[v]) {
        console.log("🛠️ Fixing status:", f.value, "→", STATUS_FIX_MAP[v]);
        f.value = STATUS_FIX_MAP[v];
      }

      // fallback normalization (important)
      const normalized = normalizeStatusValue(f.value);
      if (normalized) {
        f.value = normalized;
      }
    }

    // ----------------------------------
    // 🏢 TYPE FIXES
    // ----------------------------------
    if (f.field === "type" && typeof f.value === "string") {
      const v = f.value.toLowerCase().trim();

      const TYPE_FIX_MAP: Record<string, string> = {
        "mixed-use": "mixed use",
        "multi family": "multifamily",
        "multi-family": "multifamily",
      };

      if (TYPE_FIX_MAP[v]) {
        console.log("🛠️ Fixing type:", f.value, "→", TYPE_FIX_MAP[v]);
        f.value = TYPE_FIX_MAP[v];
      }
    }

    // ----------------------------------
    // 🌎 STATE FIXES
    // ----------------------------------
    if (f.field === "state") {
      if (Array.isArray(f.value)) {
        const resolved = f.value.map(resolveState).filter((v: null) => v !== null);

        if (resolved.length > 0) {
          console.log("🛠️ Fixing state array:", f.value, "→", resolved);
          f.value = resolved;
        }
      } else {
        const resolved = resolveState(f.value);

        if (resolved && resolved !== f.value) {
          console.log("🛠️ Fixing state:", f.value, "→", resolved);
          f.value = resolved; // ✅ always string
        }
      }
    }

    // ----------------------------------
    // 💰 CAP RATE FIX (0.06 → 6)
    // ----------------------------------
    if (f.field === "cap_rate") {
      if (typeof f.value === "number" && f.value > 0 && f.value < 1) {
        console.log("🛠️ Fixing cap_rate:", f.value, "→", f.value * 100);
        f.value = f.value * 100;
      }
    }
  }

  return dsl;
}
