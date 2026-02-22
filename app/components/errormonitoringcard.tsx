/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";

import { Button } from "@/components/ui/button";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Input } from "@/components/ui/input";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  ArrowUpDown,
  Trash2,
  FileWarning,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";

import { toast } from "sonner";

import { useSession } from "next-auth/react";
import { Clock, X, Search } from "lucide-react";

/* ------------------ TYPE ---------------------- */

export interface ErrorMonitoringRecord {
  file_id: string;
  file_name: string;
  extraction_status: string;
  extraction_confidence_level_percentage: string;
  remarks: string | null;
  created_at: string;
}

/* ------------------ FORMAT DATE ---------------------- */

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/* ------------------ MAIN ---------------------- */

export default function ErrorMonitoringTable({
  onDeleteSuccess,
}: {
  onDeleteSuccess?: () => void;
}) {
  const router = useRouter();

  const [data, setData] = React.useState<ErrorMonitoringRecord[]>([]);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [loading, setLoading] = React.useState(true);

  const [page, setPage] = React.useState(1);
  const pageSize = 10;
  const [totalPages, setTotalPages] = React.useState(1);

  const [search, setSearch] = React.useState("");

  const { data: session } = useSession();
  const userId = session?.user?.id;

  const storageKey = `recent_error_monitoring_search_${userId}`;

  const [searchInput, setSearchInput] = React.useState("");
  const [recentSearches, setRecentSearches] = React.useState<string[]>([]);
  const [showRecentDropdown, setShowRecentDropdown] = React.useState(false);

  const [rowSelection, setRowSelection] = React.useState({});
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [bulkDeleting, setBulkDeleting] = React.useState(false);

  const searchWrapperRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!userId) return;

    const saved = localStorage.getItem(storageKey);
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, [storageKey, userId]);

  React.useEffect(() => {
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

  const handleBulkDelete = async () => {
    const selectedIds = Object.keys(rowSelection)
      .map((rowIndex) => data[Number(rowIndex)]?.file_id)
      .filter(Boolean);

    if (!selectedIds.length) {
      toast.error("Please select at least one record.");
      return;
    }

    try {
      setBulkDeleting(true);

      const loadingToast = toast.loading(
        `Deleting ${selectedIds.length} record(s)...`,
      );

      const res = await fetch("/api/errormonitoring", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });

      const json = await res.json();

      if (!json.success) throw new Error(json.message);

      toast.success(`${selectedIds.length} record(s) deleted`, {
        id: loadingToast,
      });

      setRowSelection({});
      setBulkDeleteOpen(false);
      loadRecords();
      onDeleteSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "Bulk delete failed");
    } finally {
      setBulkDeleting(false);
    }
  };

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

  const removeRecentSearch = (value: string) => {
    const updated = recentSearches.filter((v) => v !== value);
    setRecentSearches(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  /* ------------------ FETCH ---------------------- */
  const loadRecords = React.useCallback(async () => {
    try {
      setLoading(true);

      const res = await fetch(
        `/api/errormonitoring?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(search)}`,
      );

      if (!res.ok) throw new Error("Failed to load records");

      const json = await res.json();

      setData(json.data || []);

      setTotalPages(Math.max(1, Math.ceil((json.total || 0) / pageSize)));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  React.useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  /* ------------------ COLUMNS ---------------------- */

  const columns = React.useMemo<ColumnDef<ErrorMonitoringRecord>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              className="cursor-pointer"
              checked={table.getIsAllPageRowsSelected()}
              onChange={table.getToggleAllPageRowsSelectedHandler()}
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              className="cursor-pointer"
              checked={row.getIsSelected()}
              disabled={!row.getCanSelect()}
              onChange={row.getToggleSelectedHandler()}
            />
          </div>
        ),
        size: 40,
        meta: {
          className: "px-2",
          headerClassName: "px-2",
        },
      },
      {
        id: "icon",
        header: "",
        enableSorting: false,
        cell: () => (
          <div className="flex items-center justify-center">
            <FileWarning className="w-4 h-4 text-gray-500" />
          </div>
        ),
        size: 40,
        meta: {
          className: "px-2",
          headerClassName: "px-2",
        },
      },

      {
        accessorKey: "file_name",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            File Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
      },

      {
        accessorKey: "created_at",
        header: "Date",
        cell: ({ getValue }) => (
          <span className="text-sm whitespace-nowrap">
            {formatDateTime(getValue<string>())}
          </span>
        ),
      },

      {
        accessorKey: "extraction_status",
        header: "Extraction Status",
      },

      {
        accessorKey: "extraction_confidence_level_percentage",
        header: "Confidence %",
        cell: ({ getValue }) => (
          <span className="font-medium text-red-600">{getValue<string>()}</span>
        ),
      },

      {
        accessorKey: "remarks",
        header: "Remarks",
        cell: ({ row }) =>
          row.original.remarks ? (
            <div className="max-w-[500px] text-sm whitespace-normal break-words">
              {row.original.remarks}
            </div>
          ) : (
            <span className="italic text-gray-400">—</span>
          ),
      },

      /* ---------- UPDATED ACTION COLUMN ---------- */

      {
        id: "action",
        header: () => <div className="text-center">Action</div>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            {/* VIEW BUTTON */}

            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                router.push(
                  `/dashboard/errormonitoring/${row.original.file_id}`,
                )
              }
            >
              <Eye size={16} /> View
            </Button>
          </div>
        ),
      },
    ],
    [router],
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      rowSelection,
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  /* ------------------ UI ---------------------- */

  return (
    <div className="space-y-6">
      <div ref={searchWrapperRef} className="flex items-center gap-2 relative">
        <div className="relative">
          <Input
            placeholder="Search file name..."
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
            className="w-[600px]"
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

        <Button
          onClick={applySearch}
          className="bg-blue-700 text-white hover:bg-blue-500 mt-2 flex items-center gap-2"
        >
          <Search className="w-4 h-4" />
          Search
        </Button>

        <Button
          variant="destructive"
          className="mt-2"
          disabled={bulkDeleting}
          onClick={() => {
            if (!Object.keys(rowSelection).length) {
              toast.error("Please select at least one document.");
              return;
            }
            setBulkDeleteOpen(true);
          }}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          {bulkDeleting
            ? "Deleting..."
            : `Delete Selected (${table.getSelectedRowModel().rows.length})`}
        </Button>
      </div>

      {/* TABLE */}

      <div className="border rounded-lg bg-white shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead
                    key={h.id}
                    className={h.column.columnDef.meta?.headerClassName}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-10"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : data.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cell.column.columnDef.meta?.className}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-6 text-gray-500"
                >
                  No records found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* PAGINATION */}

        <div className="flex justify-between items-center px-4 py-4 border-t">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>

          <span>
            Page <b>{page}</b> of <b>{totalPages}</b>
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Selected Documents?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The selected document will be
              permanently removed.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkDeleteOpen(false)}
              disabled={bulkDeleting}
            >
              Cancel
            </Button>

            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
            >
              {bulkDeleting ? "Deleting..." : "Confirm Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
