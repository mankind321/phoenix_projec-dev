/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogHeader,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

import {
  ChevronDown,
  ChevronUp,
  Building2,
  Loader2,
  Search as SearchIcon,
  CheckCircle,
  XCircle,
} from "lucide-react";

type Property = {
  property_id?: string;
  name?: string;
  landlord?: string;
  address?: string;
  city?: string;
  state?: string;
  status?: string;
  price?: number | string;
  sale_date?: string;
  comments?: string;
  [key: string]: any;
};

export default function ReviewPropertyListPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");

  // Modal
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // -------------------------------------------------------
  // Fetch Data
  // -------------------------------------------------------
  const fetchData = useCallback(async () => {
    setIsLoading(true);

    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });

    if (search) params.append("search", search);

    const res = await fetch(`/api/review?${params.toString()}`);
    const data = await res.json();

    setProperties(data?.data ?? []);
    const total = data.total ?? 0;
    setTotalPages(Math.max(1, Math.ceil(total / pageSize)));

    setIsLoading(false);
  }, [page, pageSize, search]);

  // Auto-refresh on changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // reset page on search
  useEffect(() => {
    setPage(1);
  }, [search]);

  // -------------------------------------------------------
  // Execute Approve / Reject
  // -------------------------------------------------------
  async function executeAction() {
    if (!selectedId || !pendingAction) return;

    setIsProcessing(true);
    setShowConfirm(false);

    const loadingMessage =
      pendingAction === "approve"
        ? "Approving property..."
        : "Rejecting property and archiving documents...";

    toast.promise(
      (async () => {
        // -----------------------------------------------------------------
        // 1️⃣ If rejecting → archive property documents FIRST
        // -----------------------------------------------------------------
        if (pendingAction === "reject") {
          const archiveRes = await fetch(
            `/api/properties/archive-documents/${selectedId}`,
            {
              method: "POST",
            }
          );

          const archiveData = await archiveRes.json();
          if (!archiveRes.ok) {
            throw new Error(
              archiveData.error ||
                "Failed to archive documents before rejection"
            );
          }
        }

        // -----------------------------------------------------------------
        // 2️⃣ Continue with your existing reject/approve endpoint
        // -----------------------------------------------------------------
        const res = await fetch("/api/review/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyId: selectedId,
            action: pendingAction,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Action failed");

        return data;
      })(),
      {
        loading: loadingMessage,

        success: async () => {
          await fetchData(); // reload list ONLY

          setIsProcessing(false);

          return pendingAction === "approve"
            ? "Property approved successfully"
            : "Property rejected and documents archived";
        },

        error:
          pendingAction === "approve"
            ? "Failed to approve property"
            : "Failed to reject property",
      }
    );
  }

  // -------------------------------------------------------
  // Badge styling
  // -------------------------------------------------------
  const getBadgeColor = () => "bg-yellow-100 text-yellow-700";

  // -------------------------------------------------------
  // UI Rendering
  // -------------------------------------------------------
  return (
    <div className="w-11/12 mx-auto mt-6 space-y-6">
      {/* -------------------------------------------------- */}
      {/* Header */}
      {/* -------------------------------------------------- */}
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Building2 className="w-6 h-6 text-gray-700" />
          Review of Uploaded and Processed Property Documents
        </h1>

        <p className="text-sm text-gray-500">
          A process that reviews and validates property documents.
        </p>

        <div className="max-w-xl mt-4">
          <p className="text-sm font-medium text-gray-600 mb-1">Search</p>

          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />

            <Input
              placeholder="Search tenant, property, landlord..."
              className="h-11 pl-11 rounded-xl border-gray-300"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* -------------------------------------------------- */}
      {/* Results */}
      {/* -------------------------------------------------- */}
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-3">
          <Building2 className="w-5 h-5 text-gray-600" />
          Properties
        </h2>

        {isLoading && (
          <div className="flex justify-center py-6 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading properties…
          </div>
        )}

        {!isLoading && properties.length === 0 && (
          <p className="text-center text-gray-500 py-8">No properties found.</p>
        )}

        {!isLoading && properties.length > 0 && (
          <div className="space-y-4">
            {properties.map((p) => {
              const key = `${p.property_id}-${p.name}-${p.address}`;

              return (
                <div
                  key={key}
                  className="border border-gray-200 rounded-xl bg-white p-5 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex justify-between items-start">
                    {/* LEFT */}
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-blue-600" />
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-base font-semibold text-gray-800">
                          {p.name ?? p.address ?? "Unnamed Property"}
                        </h3>

                        <p className="text-xs text-gray-600">
                          Landlord:{" "}
                          <span className="font-semibold">
                            {p.landlord ?? "—"}
                          </span>
                        </p>

                        <p className="text-xs text-gray-500">
                          {p.address}, {p.city}, {p.state}
                        </p>

                        {p.sale_date && (
                          <p className="text-xs text-gray-400">
                            Sold: {p.sale_date}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* RIGHT */}
                    <div className="text-right space-y-3">
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-medium ${getBadgeColor()}`}
                      >
                        Review
                      </span>

                      <p className="text-sm font-semibold text-gray-800">
                        ${Number(p.price || 0).toLocaleString()}
                      </p>

                      {/* ACTION BUTTONS */}
                      <div className="flex gap-2 justify-end">
                        <Button
                          disabled={isProcessing}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => {
                            setSelectedId(p.property_id!);
                            setPendingAction("approve");
                            setShowConfirm(true);
                          }}
                        >
                          <CheckCircle className="w-4 h-4" />
                          Approve
                        </Button>

                        <Button
                          disabled={isProcessing}
                          className="bg-red-600 hover:bg-red-700 text-white px-4 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => {
                            setSelectedId(p.property_id!);
                            setPendingAction("reject");
                            setShowConfirm(true);
                          }}
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* DETAILS */}
                  <div className="flex justify-between items-center mt-4">
                    <button
                      onClick={() =>
                        setExpanded(expanded === key ? null : key)
                      }
                      className="text-sm text-blue-600 flex items-center gap-1 hover:underline"
                    >
                      {expanded === key ? (
                        <>
                          <ChevronUp className="w-4 h-4" /> Hide Details
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4" /> View Details
                        </>
                      )}
                    </button>
                  </div>

                  {expanded === key && (
                    <div className="mt-4 bg-gray-50 p-4 rounded-lg border text-sm space-y-3">
                      <p>
                        <strong>Type:</strong> {p.type ?? "-"}
                      </p>
                      <p>
                        <strong>Cap Rate:</strong>{" "}
                        {p.cap_rate ? `${p.cap_rate}%` : "-"}
                      </p>
                      <p>
                        <strong>Latitude:</strong> {p.latitude ?? "-"}
                      </p>
                      <p>
                        <strong>Longitude:</strong> {p.longitude ?? "-"}
                      </p>
                      <p>
                        <strong>Comments:</strong> {p.comments ?? "—"}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}

            {/* PAGINATION */}
            <div className="flex justify-between mt-6 border-t pt-4">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Prev
              </Button>

              <span className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>

              <Button
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* -------------------------------------------------- */}
      {/* CONFIRMATION MODAL */}
      {/* -------------------------------------------------- */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>
              {pendingAction === "approve"
                ? "Approve this property?"
                : "Reject and delete this property?"}
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-gray-600">
            {pendingAction === "approve"
              ? "This will mark the property as Active."
              : "This will permanently delete the property and archive its documents."}
          </p>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              Cancel
            </Button>

            <Button
              disabled={isProcessing}
              className={
                pendingAction === "approve"
                  ? "bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  : "bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              }
              onClick={executeAction}
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : pendingAction === "approve" ? (
                "Confirm Approval"
              ) : (
                "Confirm Rejection"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
