/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Search, FileText, Building, File } from "lucide-react";
import { useRouter } from "next/navigation";

// Suggested examples
const suggestedQueries = [
  "homes for sale in Northern California",
  "affordable properties near Sacramento",
  "residential listings in the Bay Area",
  "commercial properties in Northern California",
  "properties with large lots in Napa and Sonoma",
];

const PAGE_SIZE = 10;

// ---------- Helper: normalize GS/GCS URLs (browser-safe) ----------
function normalizeGsUrl(url: string) {
  return url.replace(`gs://${process.env.NEXT_PUBLIC_GCP_BUCKET}/`, "");
}

// ---------- Component ----------
export default function AISearch() {
  const router = useRouter();

  // UI state
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null); // global index
  const [hasSearched, setHasSearched] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = PAGE_SIZE;

  // ---------- Download handler ----------
  const handleDownload = useCallback((url: string) => {
    const clean = normalizeGsUrl(url);
    window.location.href = `/api/gcp/download?path=${encodeURIComponent(clean)}`;
  }, []);

  // ---------- Input / suggestions ----------
  const handleInput = (value: string) => {
    setQuery(value);
    if (!value) {
      setSuggestions([]);
      return;
    }
    const filtered = suggestedQueries.filter((s) =>
      s.toLowerCase().includes(value.toLowerCase())
    );
    setSuggestions(filtered.slice(0, 5));
  };

  // ---------- Search ----------
  const handleSearch = async (value?: string) => {
    const finalQuery = (value ?? query).trim();
    if (!finalQuery) return;

    setHasSearched(true);
    setQuery(finalQuery);
    setSuggestions([]);
    setResults([]);
    setOpenIndex(null);
    setLoading(true);

    try {
      const res = await fetch("/api/aisearch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: finalQuery }),
      });

      const data = await res.json();
      console.log("UNIFIED AI Search Response:", data);

      const unifiedResults = [
        ...(data.results?.properties || []).map((p: any) => ({
          type: "property",
          id: p.property_id,
          name: p.name,
          city: p.city,
          state: p.state,
          price: p.price,
          landlord: p.landlord,
          distance_m: p.distance_m,
          raw: p,
        })),
        ...(data.results?.leases || []).map((l: any) => ({
          type: "lease",
          id: l.lease_id,
          name: l.tenant || "Lease",
          price: l.annual_rent,
          landlord: l.landlord,
          raw: l,
        })),
        ...(data.results?.documents || []).map((d: any) => ({
          type: "document",
          id: d.document_id,
          name: d.doc_type || "Document",
          raw: d,
        })),
      ];

      setResults(unifiedResults);
      setCurrentPage(1); // reset pagination
    } catch (err) {
      console.error("AI search error:", err);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Navigation for non-document items ----------
  const openDetails = (item: any) => {
    if (item.type === "property") router.push(`/dashboard/properties/${item.id}`);
    else if (item.type === "lease") router.push(`/dashboard/leases/${item.id}`);
    else if (item.type === "document") {
      // For documents we prefer download instead of openDetails
      if (item.raw?.file_url) handleDownload(item.raw.file_url);
    }
  };

  // ---------- Pagination calculations ----------
  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  // clamp currentPage if totalPages changed
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
    if (results.length === 0) {
      setCurrentPage(1);
      setOpenIndex(null);
    }
  }, [results.length, totalPages, currentPage]);

  const pagedResults = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return results.slice(start, start + pageSize);
  }, [results, currentPage, pageSize]);

  // ---------- Page button rendering (Option B: compact with ellipsis) ----------
  const pageButtons = useMemo(() => {
    const pages: (number | "…")[] = [];
    const maxVisible = 7; // heuristic: show up to 7 slots including first/last and ellipses

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }

    // always show first two and last two, and neighbors around currentPage
    const left = 1;
    const left2 = 2;
    const right = totalPages;
    const right2 = totalPages - 1;
    const windowSize = 1; // neighbors on each side of current
    const windowStart = Math.max(currentPage - windowSize, 3);
    const windowEnd = Math.min(currentPage + windowSize, totalPages - 2);

    pages.push(left, left2);

    if (windowStart > 3) pages.push("…");
    for (let p = windowStart; p <= windowEnd; p++) pages.push(p);
    if (windowEnd < totalPages - 2) pages.push("…");

    pages.push(right2, right);
    return pages;
  }, [totalPages, currentPage]);

  // ---------- Render ----------
  return (
    <div className="w-11/12 mx-auto mt-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          AI-Powered Search (Properties • Leases • Documents)
        </h2>
        <p className="text-sm text-muted-foreground">
          Ask natural questions to explore properties, leases, and documents.
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="flex gap-2 items-center">
          <div className="relative w-full">
            <Search className="absolute left-3 top-3 mt-2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search anything…"
              className="pl-10 h-12 text-base border border-gray-300"
              value={query}
              onChange={(e) => handleInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="absolute top-full mt-1 w-full bg-white border rounded-lg shadow-lg z-20">
                {suggestions.map((s, i) => (
                  <div
                    key={i}
                    onClick={() => handleSearch(s)}
                    className="px-4 py-2 cursor-pointer hover:bg-gray-100"
                  >
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button
            className="h-12 px-6 bg-blue-700 mt-2 hover:bg-blue-500"
            onClick={() => handleSearch()}
          >
            <Sparkles className="h-5 w-5 text-white" />
            Search
          </Button>
        </div>
      </div>

      {/* Try Chips */}
      <div className="flex gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground">Try:</span>
        {suggestedQueries.map((s, i) => (
          <Badge
            key={i}
            variant="secondary"
            className="cursor-pointer hover:bg-blue-100 hover:text-blue-700 transition"
            onClick={() => handleSearch(s)}
          >
            {s}
          </Badge>
        ))}
      </div>

      {/* Results */}
      <div className="mt-6 space-y-4">
        {loading && <p className="text-sm text-muted-foreground">Searching…</p>}

        {!loading && hasSearched && results.length === 0 && (
          <p className="text-sm text-muted-foreground">No results found.</p>
        )}

        {/* Cards */}
        {!loading &&
          pagedResults.map((item: any, idx: number) => {
            const globalIndex = (currentPage - 1) * pageSize + idx;
            return (
              <div
                key={globalIndex}
                className="w-full border border-gray-200 bg-white rounded-xl p-4 shadow-sm hover:shadow transition"
              >
                {/* Row 1 */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {item.type === "property" && <Building className="h-5 w-5 text-blue-500" />}
                    {item.type === "lease" && <FileText className="h-5 w-5 text-green-500" />}
                    {item.type === "document" && <File className="h-5 w-5 text-purple-500" />}
                    <h3 className="text-base font-semibold text-gray-800">{item.name}</h3>
                  </div>

                  <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">
                    {item.type === "property" ? "Match" : "Result"}
                  </span>
                </div>

                {/* Summary */}
                <div className="mt-2">
                  {item.type === "property" && (
                    <>
                      <p className="text-sm text-gray-600">
                        {item.raw?.city}, {item.raw?.state} — {item.raw?.type}
                      </p>
                      <p className="text-sm mt-2">
                        Price:{" "}
                        {item.raw?.price ? `$${Number(item.raw.price).toLocaleString()}` : "N/A"}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Landlord: {item.raw?.landlord || "N/A"}
                      </p>
                    </>
                  )}

                  {item.type === "lease" && (
                    <>
                      <p className="text-sm">Tenant: {item.raw?.tenant || "N/A"}</p>
                      <p className="text-sm mt-2">
                        Annual Rent:{" "}
                        {item.raw?.annual_rent
                          ? `$${Number(item.raw.annual_rent).toLocaleString()}`
                          : "N/A"}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Landlord: {item.raw?.landlord || "N/A"}
                      </p>
                    </>
                  )}

                  {item.type === "document" && (
                    <>
                      <p className="text-sm">Document Type: {item.raw?.doc_type || "N/A"}</p>
                      <p className="text-sm mt-1">Uploaded On: {item.raw?.uploaded_on || "N/A"}</p>
                      <p className="text-sm mt-1">
                        Confidence Score: {item.raw?.confidence_score ?? "N/A"}
                      </p>
                    </>
                  )}
                </div>

                {/* Buttons Row */}
                <div className="flex justify-between items-center mt-3">
                  {/* View Details toggle (left) */}
                  <button
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => setOpenIndex(openIndex === globalIndex ? null : globalIndex)}
                  >
                    {openIndex === globalIndex ? "Hide Details" : "View Details"}
                  </button>

                  {/* Right-side action: navigate or download */}
                  {item.type !== "document" ? (
                    <Button
                      className="bg-blue-700 hover:bg-blue-500 text-white text-xs px-3 py-1 h-8"
                      onClick={() => openDetails(item)}
                    >
                      View {item.type}
                    </Button>
                  ) : (
                    item.raw?.file_url && (
                      <Button
                        className="bg-blue-700 hover:bg-blue-500 text-white text-xs px-3 py-1 h-8"
                        onClick={() => handleDownload(item.raw.file_url)}
                      >
                        View Document
                      </Button>
                    )
                  )}
                </div>

                {/* Details (expand) */}
                {openIndex === globalIndex && (
                  <div className="border-t mt-3 p-3 bg-gray-100 rounded-b-xl text-sm space-y-2">
                    {item.type === "property" && (
                      <>
                        <p><strong>Address:</strong> {item.raw?.address || "N/A"}</p>
                        <p><strong>Status:</strong> {item.raw?.status || "N/A"}</p>
                        <p><strong>Sale Date:</strong> {item.raw?.sale_date || "N/A"}</p>
                        <p><strong>Cap Rate:</strong> {item.raw?.cap_rate ?? "N/A"}</p>
                        <p><strong>Comments:</strong> {item.raw?.comments || "—"}</p>
                      </>
                    )}

                    {item.type === "lease" && (
                      <>
                        <p><strong>Tenant:</strong> {item.raw?.tenant || "N/A"}</p>
                        <p><strong>Lease Start:</strong> {item.raw?.lease_start || "N/A"}</p>
                        <p><strong>Lease End:</strong> {item.raw?.lease_end || "N/A"}</p>
                        <p><strong>Status:</strong> {item.raw?.status || "N/A"}</p>
                        <p><strong>Comments:</strong> {item.raw?.comments || "—"}</p>
                      </>
                    )}

                    {item.type === "document" && (
                      <>
                        <p><strong>Document Type:</strong> {item.raw?.doc_type || "N/A"}</p>
                        <p><strong>Uploaded On:</strong> {item.raw?.uploaded_on || "N/A"}</p>
                        <p><strong>Confidence Score:</strong> {item.raw?.confidence_score ?? "N/A"}</p>
                        <p><strong>Extraction Status:</strong> {item.raw?.extraction_status || "N/A"}</p>

                        {item.raw?.file_url && (
                          <div className="pt-2">
                            <Button
                              className="bg-blue-700 hover:bg-blue-500 text-white text-xs px-3 py-1 h-8"
                              onClick={() => handleDownload(item.raw.file_url)}
                            >
                              View Document
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Pagination (One-Line Layout) */}
          {!loading && results.length > pageSize && (
            <div className="flex flex-wrap items-center justify-center gap-4 mt-6">

              {/* Page Buttons */}
              <div className="flex gap-2 flex-wrap">
                {pageButtons.map((p, idx) =>
                  p === "…" ? (
                    <span key={`dots-${idx}`} className="px-2 text-sm text-gray-600">…</span>
                  ) : (
                    <Button
                      key={p}
                      variant={p === currentPage ? "default" : "outline"}
                      className="h-8 px-3 text-xs"
                      onClick={() => setCurrentPage(Number(p))}
                    >
                      {p}
                    </Button>
                  )
                )}
              </div>

              {/* Prev / Next */}
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>

                <span className="text-sm whitespace-nowrap">
                  Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                </span>

                <Button
                  variant="outline"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>

            </div>
          )}

      </div>
    </div>
  );
}
