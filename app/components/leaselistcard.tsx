/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronUp,
  FileSearch,
  FileText,
  Loader2,
  Search as SearchIcon,
} from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

type Lease = {
  lease_id?: string;
  unique_id?: string;
  tenant?: string;
  landlord?: string;
  property_id?: string;
  property_name?: string;
  property_address?: string;
  property_type?: string;
  property_landlord?:string;
  lease_start?: string;
  lease_end?: string;
  annual_rent?: number | string;
  rent_psf?: number | string;
  price?: number | string;
  status?: string;
  comments?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
};

export default function LeaseListPage() {
  const [leases, setLeases] = useState<Lease[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Loading & pagination
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [fromDate, setFromDate] = useState<string | null>(null);
  const [toDate, setToDate] = useState<string | null>(null);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const router = useRouter();


  // Fetch leases (Audit-style)
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);

      const params = new URLSearchParams();
      params.append("page", String(page));
      params.append("pageSize", String(pageSize));

      if (search) params.append("search", search);
      if (status !== "all") params.append("status", status);
      if (fromDate) params.append("fromDate", fromDate);
      if (toDate) params.append("toDate", toDate);
      if (minPrice) params.append("minPrice", minPrice);
      if (maxPrice) params.append("maxPrice", maxPrice);

      const res = await fetch(`/api/lease?${params.toString()}`);
      const data = await res.json();

    if (data?.data) {
        setLeases(data.data);

        const total = data.total ?? 0;
        setTotalPages(Math.max(1, Math.ceil(total / pageSize)));
    } else {
        setLeases([]);
        setTotalPages(1);
    }


      setIsLoading(false);
    }

    fetchData();
  }, [page, pageSize, search, status, fromDate, toDate, minPrice, maxPrice]);

  // Reset page when filters change (Audit-style)
  useEffect(() => {
    setPage(1);
  }, [search, status, fromDate, toDate, minPrice, maxPrice]);

  return (
    <div className="w-11/12 mx-auto mt-6 space-y-6">

      {/* ===================== */}
      {/* FILTER SECTION (NO CARD) */}
      {/* ===================== */}
      <div>
        <div className="flex items-center space-x-2 mb-2">
          <FileText className="w-6 h-6 text-gray-700" />
          <h2 className="text-xl font-semibold text-gray-800">Lease Directory</h2>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Search tenant, property, landlord, comments… Filters refine results.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">

          {/* Search box */}
          <div className="md:col-span-4">
            <p className="text-sm font-medium text-gray-600 mb-1">Search</p>
            <div className="flex gap-2 items-center">
              <Input
                className="w-full h-10"
                placeholder="Search tenant, property, landlord…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Button className="px-3 h-10 bg-blue-600 hover:bg-blue-700 text-white">
                <SearchIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Status */}
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">Status</p>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expiring">Expiring</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">From</p>
              <Input
                type="date"
                value={fromDate ?? ""}
                onChange={(e) => setFromDate(e.target.value || null)}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">To</p>
              <Input
                type="date"
                value={toDate ?? ""}
                onChange={(e) => setToDate(e.target.value || null)}
              />
            </div>
          </div>

          {/* Price range */}
          <div className="grid grid-cols-2 gap-2 md:col-span-2">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Min Price</p>
              <Input
                type="number"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Max Price</p>
              <Input
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ===================== */}
      {/* LEASE LIST (NO CARD) */}
      {/* ===================== */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-800">Leases</h2>
        </div>

        {/* Spinner */}
        {isLoading && (
          <div className="flex justify-center items-center py-8 text-gray-500">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Loading leases...
          </div>
        )}

        {/* Empty state */}
        {!isLoading && leases.length === 0 && (
          <p className="text-center text-gray-500 py-8">No leases found.</p>
        )}

        {/* Results */}
        {!isLoading && leases.length > 0 && (
          <div className="space-y-4">
            {leases.map((lease) => {
              const key = `${lease.lease_id}-${lease.tenant}-${lease.lease_start}`;

              return (
                <div
                  key={key}
                  className="border border-gray-100 rounded-xl bg-white p-5 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex justify-between items-start">
                    {/* LEFT */}
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-full bg-blue-100 text-blue-600 shadow-sm">
                        <FileText className="w-4 h-4" />
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-base font-semibold text-gray-800">
                          {lease.property_name ??
                            lease.property_address ??
                            lease.property_id}
                        </h3>

                        <p className="text-xs text-gray-500">
                          Tenant: <strong>{lease.tenant ?? "—"}</strong> · Landlord:{" "}
                          <strong>{lease.landlord ?? "—"}</strong>
                        </p>

                        <p className="text-xs text-gray-500">
                          {lease.property_address}
                        </p>

                        <p className="text-xs text-gray-400">
                          {lease.lease_start} → {lease.lease_end}
                        </p>
                      </div>
                    </div>

                    {/* RIGHT */}
                    <div className="text-right space-y-2">
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          lease.status === "active"
                            ? "bg-green-100 text-green-700"
                            : lease.status === "expiring"
                            ? "bg-yellow-100 text-yellow-700"
                            : lease.status === "expired"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {lease.status}
                      </span>

                      <div className="text-sm font-semibold text-gray-800">
                        $
                        {Number(
                          lease.annual_rent || lease.price || 0
                        ).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                  </div>

                  {/* ===== BUTTON ROW ===== */}
                  <div className="flex justify-between items-center mt-4">
                    <button
                      onClick={() => setExpanded(expanded === key ? null : key)}
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

                    <Button
                      variant="outline"
                      className="bg-blue-600 hover:bg-blue-700 text-white hover:text-white"
                      onClick={() => router.push(`/dashboard/leases/${lease.lease_id}`)}
                    >
                      <FileSearch />
                      Go to Lease Record
                    </Button>
                  </div>

                  {/* ===== INLINE DETAILS ===== */}
                  {expanded === key && (
                    <div className="mt-4 bg-gray-50 p-4 rounded-lg border text-sm space-y-2">
                      <p><strong>Property Type:</strong> {lease.property_type}</p>
                      <p><strong>Property Landlord:</strong> {lease.property_landlord}</p>
                      <p><strong>Comments:</strong> {lease.comments ?? "—"}</p>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Pagination */}
            <div className="flex justify-between items-center mt-6 border-t pt-4">
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
    </div>
  );

}
