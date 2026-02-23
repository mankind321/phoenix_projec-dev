/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import type {
  RealtimePostgresInsertPayload,
  RealtimeChannel,
} from "@supabase/supabase-js";

import { createRealtimeClient } from "@/lib/supabaseRealtimeClient";
import {
  acquireRealtimeChannel,
  releaseRealtimeChannel,
} from "@/lib/realtimeChannelLock";

type DocumentRegistryRow = {
  file_id: string;
  user_id: string | null;
  file_name: string | null;
  extraction_status: "PASSED" | "FAILED" | string;
  document_type: string | null;
};

export function useRealtimeTest(
  enabled: boolean,
  options?: {
    onTenantReady?: () => void;
    onReviewReady?: () => void;
    onExtractionFailed?: () => void;
  },
) {
  const { data: session } = useSession();

  const channelRef = useRef<RealtimeChannel | null>(null);
  const processedRef = useRef<Set<string>>(new Set());

  async function checkDuplicateLease(fileId: string) {
    try {
      const res = await fetch("/api/check-duplicate/lease", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: fileId }),
      });

      const json = await res.json();

      if (json.success && json.duplicates?.length > 0) {
        const tenantList = json.duplicates.map(
          (d: any) => d.tenant ?? "Unknown Tenant",
        );

        const toastId = `dup-lease-${fileId}`;

        toast.warning(
          <div
            onClick={() => toast.dismiss(toastId)}
            style={{ cursor: "pointer", width: "100%" }}
          >
            <div>Duplicate tenant information detected. To maintain data integrity, the following record(s) will not be included in the saved dataset:</div>

            <ul style={{ marginTop: 6, paddingLeft: 18 }}>
              {tenantList.map((t: string, idx: number) => (
                <li key={`${toastId}-tenant-${idx}`}>{t}</li>
              ))}
            </ul>
          </div>,
          { id: toastId, duration: 30000 },
        );
      }
    } catch (err) {
      console.error("Duplicate lease lookup failed:", err);
    }
  }

  async function checkDuplicateProperty(fileId: string) {
    try {
      const res = await fetch("/api/check-duplicate/property", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: fileId }),
      });

      const json = await res.json();

      if (json.success && json.duplicates?.length > 0) {
        const propertyList = json.duplicates.map(
          (d: any) => d.property_name ?? "Unknown Property",
        );
        const toastId = `dup-prop-${fileId}`;

        toast.warning(
          <div
            onClick={() => toast.dismiss(toastId)}
            style={{ cursor: "pointer", width: "100%" }}
          >
            <div>Duplicate property information(s) detected and will not be saved:</div>

            <ul style={{ marginTop: 6, paddingLeft: 18 }}>
              {propertyList.map((p: string, idx: number) => (
                <li key={`${toastId}-${idx}`}>{p}</li>
              ))}
            </ul>
          </div>,
          { id: toastId, duration: 30000 },
        );
      }
    } catch (err) {
      console.error("Duplicate property lookup failed:", err);
    }
  }

  useEffect(() => {
    const userId = session?.user?.id;
    if (!enabled || !userId) return;

    // 🚨 prevents duplicate websocket clients
    if (!acquireRealtimeChannel()) return;

    async function init() {
      try {
        const res = await fetch("/api/realtime-token", { method: "POST" });
        const json = await res.json();
        if (!json.success) throw new Error("Realtime token failed");

        const supabase = createRealtimeClient(json.access_token);

        const channel = supabase
          .channel(`document-extraction-alerts:${userId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "document_registry",
              filter: `user_id=eq.${userId}`,
            },
            (payload: RealtimePostgresInsertPayload<DocumentRegistryRow>) => {
              const row = payload.new;
              if (row.user_id !== userId) return;

              const toastId = `doc-${row.file_id}`;

              if (row.extraction_status === "PASSED") {
                const normalizedDocType = (row.document_type ?? "")
                  .toUpperCase()
                  .replace(/[\s_]/g, "");

                const isRentRoll = normalizedDocType === "RENTROLL";

                toast.success(
                  <div
                    onClick={() => toast.dismiss(toastId)}
                    style={{ cursor: "pointer", width: "100%" }}
                  >
                    {`Data extraction for "${row.file_name ?? "document"}" completed.`}
                  </div>,
                  { id: toastId, duration: 30000 },
                );

                // 🔒 idempotent duplicate check
                if (!processedRef.current.has(row.file_id)) {
                  processedRef.current.add(row.file_id);

                  setTimeout(() => {
                    if (isRentRoll) {
                      void checkDuplicateLease(row.file_id);
                    } else {
                      void checkDuplicateProperty(row.file_id);
                    }
                  }, 1500);
                }

                if (isRentRoll) {
                  options?.onTenantReady?.();
                } else {
                  options?.onReviewReady?.();
                }
              }

              if (row.extraction_status === "FAILED") {
                toast.error(
                  <div
                    onClick={() => toast.dismiss(toastId)}
                    style={{ cursor: "pointer", width: "100%" }}
                  >
                    {`Extraction failed for "${row.file_name ?? "document"}".`}
                  </div>,
                  { id: toastId, duration: 30000 },
                );

                options?.onExtractionFailed?.();
              }
            },
          )
          .subscribe((status: string) => {
            if (status === "SUBSCRIBED") {
              console.log("[realtime] subscribed");
            }

            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              console.error("[realtime] subscription failed");
            }
          });

        channelRef.current = channel;
      } catch (err) {
        console.error("[realtime] init failed", err);
      }
    }

    init();

    return () => {
      releaseRealtimeChannel();
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
      channelRef.current = null;
    };
  }, [enabled, options, session?.user?.id]);
}
