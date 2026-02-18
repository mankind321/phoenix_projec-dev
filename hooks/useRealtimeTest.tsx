/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { createRealtimeClient } from "@/lib/supabaseRealtimeClient";
import type {
  RealtimePostgresInsertPayload,
  RealtimeChannel,
} from "@supabase/supabase-js";

type DocumentRegistryRow = {
  user_id: string | null;
  file_name: string | null;
  extraction_status: "PASSED" | "FAILED" | string;
  document_type: string | null;
};

export function useRealtimeTest(
  enabled: boolean,
  options?: {
    onExtractionSuccess?: () => void;
    onExtractionFailed?: () => void;
  },
) {
  const { data: session } = useSession();
  const router = useRouter();

  const subscribedRef = useRef(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabaseRef = useRef<any>(null);

  useEffect(() => {
    const userId = session?.user?.id;

    if (!enabled || !userId || subscribedRef.current) return;

    async function init() {
      try {
        const res = await fetch("/api/realtime-token", { method: "POST" });
        const json = await res.json();

        if (!json.success) throw new Error("Realtime token failed");

        const supabase = createRealtimeClient(json.access_token);
        supabaseRef.current = supabase;

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

              const toastId = `doc-${row.user_id}-${row.file_name}-${row.extraction_status}`;

              const normalizedDocType = row.document_type
                ?.toLowerCase()
                .replace(/_/g, " ")
                .trim();

              const isRentRoll = normalizedDocType === "rent roll";

              // ========================
              // SUCCESS
              // ========================
              if (row.extraction_status === "PASSED") {
                const message = isRentRoll
                  ? `Data extraction for "${row.file_name ?? "document"}" completed. View Data on the Tenate Page`
                  : `Data extraction for "${row.file_name ?? "document"}" completed. Data will be sent to Review Page for evaluation.`;

                toast.success(
                  <div
                    onClick={() => toast.dismiss(toastId)}
                    style={{
                      cursor: "pointer",
                      width: "100%",
                    }}
                  >
                    {message}
                  </div>,
                  {
                    id: toastId,
                    duration: 30_000,
                  },
                );

                options?.onExtractionSuccess?.();
              }

              // ========================
              // FAILED
              // ========================
              if (row.extraction_status === "FAILED") {
                const message = `Extraction failed for "${row.file_name ?? "document"}". Please refer to the Error Document List under Document Page to investigate and resolve issues`;

                toast.error(
                  <div
                    onClick={() => toast.dismiss(toastId)}
                    style={{
                      cursor: "pointer",
                      width: "100%",
                    }}
                  >
                    {message}
                  </div>,
                  {
                    id: toastId,
                    duration: 30_000,
                  },
                );

                options?.onExtractionFailed?.();
              }
            },
          )
          .subscribe((status, err) => {
            if (err) {
              console.error("[realtime] channel error:", err);
            }

            if (status === "SUBSCRIBED") {
              subscribedRef.current = true;
              console.log("[realtime] subscribed");
            }

            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              subscribedRef.current = false;
              console.error("[realtime] subscription failed");
            }
          });

        channelRef.current = channel;
      } catch (err) {
        console.error("[realtime] init failed", err);
        subscribedRef.current = false;
      }
    }

    init();

    return () => {
      subscribedRef.current = false;

      if (supabaseRef.current && channelRef.current) {
        supabaseRef.current.removeChannel(channelRef.current);
      }

      channelRef.current = null;
      supabaseRef.current = null;
    };
  }, [enabled, options, session?.user?.id, router]);
}
