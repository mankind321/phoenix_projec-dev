/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import type {
  RealtimePostgresInsertPayload,
  RealtimeChannel,
} from "@supabase/supabase-js";

import { createRealtimeClient } from "@/lib/supabaseRealtimeClient";

// 🔥 GLOBAL SINGLETON (per tab)
declare global {
  interface Window {
    __realtimeChannel?: RealtimeChannel | null;
    __realtimeUserId?: string | null;
    __realtimeInitializing?: boolean;
  }
}

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

  const processedRef = useRef<Set<string>>(new Set());
  const reviewTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const onReviewReadyRef = useRef(options?.onReviewReady);
  const onTenantReadyRef = useRef(options?.onTenantReady);
  const onExtractionFailedRef = useRef(options?.onExtractionFailed);

  useEffect(() => {
    onReviewReadyRef.current = options?.onReviewReady;
    onTenantReadyRef.current = options?.onTenantReady;
    onExtractionFailedRef.current = options?.onExtractionFailed;
  }, [
    options?.onReviewReady,
    options?.onTenantReady,
    options?.onExtractionFailed,
  ]);

  const triggerReviewUpdate = useCallback(() => {
    if (reviewTimeoutRef.current) {
      clearTimeout(reviewTimeoutRef.current);
    }

    reviewTimeoutRef.current = setTimeout(() => {
      onReviewReadyRef.current?.();
    }, 500);
  }, []);

  // 🔁 DUPLICATE LEASE
  async function checkDuplicateLease(fileId: string) {
    try {
      console.log("[duplicate][lease] checking for fileId:", fileId);

      const res = await fetch("/api/check-duplicate/lease", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: fileId }),
      });

      console.log("[duplicate][lease] response status:", res.status);

      const json = await res.json();

      console.log("[duplicate][lease] response json:", json);

      if (json.success && json.duplicates?.length > 0) {
        console.log(
          "[duplicate][lease] duplicates found:",
          json.duplicates.length,
        );

        const tenantList = json.duplicates.map(
          (d: any) => d.tenant ?? "Unknown Tenant",
        );

        console.log("[duplicate][lease] tenant list:", tenantList);

        const toastId = `dup-lease-${fileId}`;

        toast.warning(
          <div
            onClick={() => toast.dismiss(toastId)}
            style={{ cursor: "pointer", width: "100%" }}
          >
            <div>
              Duplicate Tenant information detected. The following record(s)
              will not be saved:
            </div>
            <ul style={{ marginTop: 6, paddingLeft: 18 }}>
              {tenantList.map((t: string, idx: number) => (
                <li key={`${toastId}-${idx}`}>{t}</li>
              ))}
            </ul>
          </div>,
          { id: toastId, duration: 30000 },
        );
      } else {
        console.log(
          "[duplicate][lease] no duplicates OR success=false:",
          json.success,
          json.duplicates,
        );
      }
    } catch (err) {
      console.error("[duplicate][lease] ERROR:", err);
    }
  }

  // 🔁 DUPLICATE PROPERTY
  async function checkDuplicateProperty(fileId: string) {
    try {
      console.log("[duplicate][property] checking for fileId:", fileId);

      const res = await fetch("/api/check-duplicate/property", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: fileId }),
      });

      console.log("[duplicate][property] response status:", res.status);

      const json = await res.json();

      console.log("[duplicate][property] response json:", json);

      if (json.success && json.duplicates?.length > 0) {
        console.log(
          "[duplicate][property] duplicates found:",
          json.duplicates.length,
        );

        const propertyList = json.duplicates.map(
          (d: any) => d.property_name ?? "Unknown Property",
        );

        console.log("[duplicate][property] property list:", propertyList);

        const toastId = `dup-prop-${fileId}`;

        toast.warning(
          <div
            onClick={() => toast.dismiss(toastId)}
            style={{ cursor: "pointer", width: "100%" }}
          >
            <div>
              Duplicate property information(s) detected and will not be saved:
            </div>
            <ul style={{ marginTop: 6, paddingLeft: 18 }}>
              {propertyList.map((p: string, idx: number) => (
                <li key={`${toastId}-${idx}`}>{p}</li>
              ))}
            </ul>
          </div>,
          { id: toastId, duration: 30000 },
        );
      } else {
        console.log(
          "[duplicate][property] no duplicates OR success=false:",
          json.success,
          json.duplicates,
        );
      }
    } catch (err) {
      console.error("[duplicate][property] ERROR:", err);
    }
  }

  useEffect(() => {
    const userId = session?.user?.id;

    // 🔥 HANDLE LOGOUT → CLEANUP REALTIME
    if (!userId) {
      if (window.__realtimeChannel) {
        console.log("[realtime] logout → unsubscribing");

        window.__realtimeChannel.unsubscribe();
        window.__realtimeChannel = null;
        window.__realtimeUserId = null;
        window.__realtimeInitializing = false;
      }

      return;
    }

    if (!enabled) return;

    if (!enabled || !userId) return;

    // reuse existing
    if (window.__realtimeChannel && window.__realtimeUserId === userId) {
      return;
    }

    // prevent duplicate init
    if (window.__realtimeInitializing) {
      return;
    }

    window.__realtimeInitializing = true;

    // user changed → reset
    if (window.__realtimeChannel && window.__realtimeUserId !== userId) {
      window.__realtimeChannel.unsubscribe();
      window.__realtimeChannel = null;
    }

    async function init() {
      try {
        const res = await fetch("/api/realtime-token", { method: "POST" });
        const json = await res.json();

        if (!json.success) throw new Error("Realtime token failed");

        const supabase = createRealtimeClient(json.access_token);

        supabase.realtime.setAuth(json.access_token);

        const channel = supabase
          .channel(`realtime:${userId}`)

          // 📄 DOCUMENT EVENTS
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
                    {isRentRoll
                      ? `Rent Roll extraction completed for "${row.file_name ?? "document"}". Please check the Tenant page to view the newly added data.`
                      : `Data extraction completed for "${row.file_name ?? "document"}". Please notify your Direct Manager or Admin about the newly added document.`}
                  </div>,
                  { id: toastId, duration: 30000 },
                );

                if (!processedRef.current.has(row.file_id)) {
                  processedRef.current.add(row.file_id);

                  setTimeout(() => {
                    isRentRoll
                      ? checkDuplicateLease(row.file_id)
                      : checkDuplicateProperty(row.file_id);
                  }, 5000);
                }

                if (isRentRoll) {
                  onTenantReadyRef.current?.();
                } else {
                  setTimeout(() => {
                    onReviewReadyRef.current?.();
                  }, 500);
                }
              }

              if (row.extraction_status === "FAILED") {
                toast.error(
                  <div
                    onClick={() => toast.dismiss(toastId)}
                    style={{ cursor: "pointer", width: "100%" }}
                  >
                    {`Extraction failed for "${row.file_name ?? "document"}". Please check the Error Document List on the Document page for more details.`}
                  </div>,
                  { id: toastId, duration: 30000 },
                );

                onExtractionFailedRef.current?.();

                window.dispatchEvent(new Event("error-document-added"));
              }
            },
          )

          // 🏢 PROPERTY EVENTS (silent UI refresh)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "api",
              table: "property",
            },
            () => {
              triggerReviewUpdate();
            },
          )

          .subscribe((status: any) => {
            if (status === "SUBSCRIBED") {
              console.log("[realtime] subscribed");
            }

            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              console.warn("[realtime] subscription failed");
            }

            if (status === "CLOSED") {
              console.warn("[realtime] CLOSED");
            }
          });

        window.__realtimeChannel = channel;
        window.__realtimeUserId = userId;
        window.__realtimeInitializing = false;
      } catch (err) {
        console.error("[realtime] init failed", err);
        window.__realtimeInitializing = false;
      }
    }

    init();

    return () => {
      if (reviewTimeoutRef.current) {
        clearTimeout(reviewTimeoutRef.current);
      }
    };
  }, [enabled, session?.user?.id, triggerReviewUpdate]);
}
