/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useMemo, useState } from "react";
import { ChevronUp, ChevronDown, Search } from "lucide-react";

type Row = {
  property_name: string;
  city: string;
  state: string;
  monthly_income: number;
};

export default function IncomeByPropertyTable({ data }: { data: any[] }) {
  // 🛡️ Ensure "data" is always an array before mapping
  const list = Array.isArray(data) ? data : [];

  const cleaned: Row[] = list.map((r) => ({
    property_name: r.property_name ?? r.property ?? "Unknown",
    city: r.city ?? "-",
    state: r.state ?? "",
    monthly_income: Number(r.monthly_income ?? 0),
  }));

  /** -------------------------
   * SEARCH
   -------------------------- */
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return cleaned;
    const q = search.toLowerCase();

    return cleaned.filter((r) =>
      [r.property_name, r.city, r.state]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [cleaned, search]);

  /** -------------------------
   * SORTING
   -------------------------- */
  const [sortField, setSortField] = useState<keyof Row>("monthly_income");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      const A = a[sortField];
      const B = b[sortField];

      if (A < B) return sortAsc ? -1 : 1;
      if (A > B) return sortAsc ? 1 : -1;
      return 0;
    });
    return rows;
  }, [filtered, sortField, sortAsc]);

  const toggleSort = (field: keyof Row) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  /** -------------------------
   * PAGINATION
   -------------------------- */
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE) || 1;
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const go = (p: number) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
  };

  /** -------------------------
   * RENDER
   -------------------------- */
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border">
      <h2 className="text-lg font-semibold mb-4">Income by Property</h2>

      {/* Search */}
      <div className="flex items-center mb-4">
        <div className="relative w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search property..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="border rounded-lg pl-10 pr-3 py-2 w-full"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto rounded-xl border max-h-[500px]">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 sticky top-0 z-10">
            <tr>
              <Th
                label="Property"
                field="property_name"
                sortField={sortField}
                sortAsc={sortAsc}
                toggle={toggleSort}
              />
              <Th
                label="City"
                field="city"
                sortField={sortField}
                sortAsc={sortAsc}
                toggle={toggleSort}
              />
              <Th
                label="State"
                field="state"
                sortField={sortField}
                sortAsc={sortAsc}
                toggle={toggleSort}
              />
              <Th
                label="Monthly Income"
                field="monthly_income"
                sortField={sortField}
                sortAsc={sortAsc}
                toggle={toggleSort}
              />
            </tr>
          </thead>

          <tbody>
            {paginated.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="px-4 py-2">{r.property_name}</td>
                <td className="px-4 py-2">{r.city}</td>
                <td className="px-4 py-2">{r.state}</td>
                <td className="px-4 py-2 font-medium">
                  {Number(r.monthly_income).toLocaleString("en-US", {
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center mt-4">
        <span className="text-sm text-gray-500">
          {sorted.length === 0
            ? "Showing 0 of 0"
            : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(
                page * PAGE_SIZE,
                sorted.length
              )} of ${sorted.length}`}
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={() => go(page - 1)}
            disabled={page === 1}
            className="px-3 py-1 border rounded disabled:opacity-40"
          >
            Prev
          </button>

          {[...Array(totalPages)].map((_, i) => (
            <button
              key={i}
              onClick={() => go(i + 1)}
              className={`px-3 py-1 rounded border ${
                page === i + 1 ? "bg-blue-600 text-white border-blue-600" : ""
              }`}
            >
              {i + 1}
            </button>
          ))}

          <button
            onClick={() => go(page + 1)}
            disabled={page === totalPages}
            className="px-3 py-1 border rounded disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function Th({ label, field, sortField, sortAsc, toggle }: any) {
  const active = sortField === field;

  return (
    <th
      onClick={() => toggle(field)}
      className="px-4 py-2 font-medium text-left cursor-pointer select-none"
    >
      <div className="flex items-center gap-1">
        {label}
        {active ? (
          sortAsc ? (
            <ChevronUp size={14} />
          ) : (
            <ChevronDown size={14} />
          )
        ) : (
          <ChevronUp size={14} className="opacity-0" />
        )}
      </div>
    </th>
  );
}
