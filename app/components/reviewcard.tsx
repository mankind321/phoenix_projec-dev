"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { Building2, Loader2, Search as SearchIcon, Eye } from "lucide-react";

import { useSession } from "next-auth/react";
import { Clock, X } from "lucide-react";
import React, { useRef } from "react";

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

  creator_username?: string;
  creator_fullname?: string;
  creator_role?: string;
  manager_fullname?: string;
  created_at?: string;

  type?: string;
  cap_rate?: number | string;
  latitude?: number | string;
  longitude?: number | string;
  tenancytype?: string;
};

export default function ReviewPropertyListPage() {
  const router = useRouter();

  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");

  const { data: session } = useSession();
  const userId = session?.user?.id;

  const storageKey = `recent_review_property_search_${userId}`;

  const [searchInput, setSearchInput] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showRecentDropdown, setShowRecentDropdown] = useState(false);

  const searchWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId) return;

    const saved = localStorage.getItem(storageKey);
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, [storageKey, userId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchWrapperRef.current &&
        !searchWrapperRef.current.contains(event.target as Node)
      ) {
        setShowRecentDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const saveRecentSearch = (value: string) => {
    if (!value || !userId) return;

    const updated = [value, ...recentSearches.filter((v) => v !== value)].slice(
      0,
      5,
    );

    setRecentSearches(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  const applySearch = () => {
    const trimmed = searchInput.trim();

    if (trimmed) {
      saveRecentSearch(trimmed);
    }

    setSearch(trimmed);
    setPage(1);
    setShowRecentDropdown(false);
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearch("");
    setPage(1);
    setShowRecentDropdown(false);
  };

  const removeRecentSearch = (value: string) => {
    const updated = recentSearches.filter((v) => v !== value);
    setRecentSearches(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  // -------------------------------------------------------
  // Badge styling
  // -------------------------------------------------------
  const getBadgeColor = () => "bg-yellow-100 text-yellow-700";

  // -------------------------------------------------------
  // UI Rendering
  // -------------------------------------------------------
  return (
    <div className="w-11/12 mx-auto mt-6 space-y-6">
      {/* Header */}
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

          <div
            ref={searchWrapperRef}
            className="relative flex items-center gap-2"
          >
            <div className="relative">
              <Input
                placeholder="Search property, landlord, address..."
                className="w-[600px]"
                value={searchInput}
                onChange={(e) => {
                  const value = e.target.value;

                  setSearchInput(value);
                  setShowRecentDropdown(true);

                  // reload all when cleared
                  if (!value.trim()) {
                    setSearch("");
                    setPage(1);
                  }
                }}
                onFocus={() => setShowRecentDropdown(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applySearch();
                }}
              />

              {/* Recent search dropdown */}

              {showRecentDropdown && recentSearches.length > 0 && (
                <div className="absolute top-full left-0 w-full bg-white border rounded-md shadow-md z-50 mt-1 max-h-60 overflow-auto">
                  {recentSearches
                    .filter((item) =>
                      item.toLowerCase().includes(searchInput.toLowerCase()),
                    )
                    .map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between px-3 py-2 hover:bg-gray-100 cursor-pointer group"
                      >
                        <div
                          className="flex items-center gap-2 flex-1"
                          onClick={() => {
                            setSearchInput(item);
                            saveRecentSearch(item);

                            setSearch(item);
                            setPage(1);

                            setShowRecentDropdown(false);
                          }}
                        >
                          <Clock className="w-4 h-4 text-gray-400" />
                          {item}
                        </div>

                        <X
                          className="w-4 h-4 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeRecentSearch(item);
                          }}
                        />
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 mt-2">
              <Button
                onClick={applySearch}
                className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
              >
                <SearchIcon className="w-4 h-4" />
                Search
              </Button>

              <Button
                variant="outline"
                onClick={clearSearch}
                disabled={!searchInput && !search}
                className="flex items-center gap-2 bg-red-500 text-white hover:bg-red-700 hover:text-white"
              >
                <X className="w-4 h-4" />
                Clear
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
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

                        <p className="text-xs text-gray-500">
                          {formatTenancyType(p.tenancytype)} - {p.type}
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

                      {/* VIEW BUTTON */}
                      <div className="flex gap-2 justify-end">
                        <Button
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 flex items-center gap-2"
                          onClick={() =>
                            router.push(`/dashboard/review/${p.property_id}`)
                          }
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* PAGINATION */}
            <div className="flex justify-between mt-6 border-t pt-4">
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
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

function formatTenancyType(value?: string | null): string {
  if (!value) return "—";

  const map: Record<string, string> = {
    SingleTenant: "Single Tenant",
    MultiTenant: "Multi Tenant",
  };

  return map[value] || value;
}
