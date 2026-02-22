/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
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
  ArrowUpDown,
  Edit,
  Trash2,
  Plus,
  ChevronLeft,
  ChevronRight,
  Contact,
  Contact2,
  SearchIcon,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Clock, X } from "lucide-react";

import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { Can } from "./can";

/* ------------------ TYPE ---------------------- */
interface Contact {
  contact_id: string;
  unique_id: string;
  user_id: string;

  agent_name: string | null;
  listing_company: string;
  broker_name: string;
  phone: string;
  email: string;
  website: string;
  comments: string;

  created_by: string;
  createdbyuser: string | null;

  updated_by: string;
  updatedbyuser: string | null;

  created_at: string;
  updated_at: string;
}

/* ------------------ MAIN COMPONENT ---------------------- */
export default function ContactTable() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [contacts, setContacts] = React.useState<Contact[]>([]);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  // Pagination (match Document Table)
  const [page, setPage] = React.useState(1);
  const pageSize = 10;
  const [totalRecords, setTotalRecords] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);

  const [searchInput, setSearchInput] = React.useState("");
  const [recentSearches, setRecentSearches] = React.useState<string[]>([]);
  const [showRecentDropdown, setShowRecentDropdown] = React.useState(false);

  const [rowSelection, setRowSelection] = React.useState({});
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [bulkDeleting, setBulkDeleting] = React.useState(false);

  const searchWrapperRef = React.useRef<HTMLDivElement>(null);

  const userId = React.useMemo(() => {
    if (status !== "authenticated") return null;
    return session?.user?.id ?? null;
  }, [status, session]);

  /* ------------------ FETCH DATA ---------------------- */
  const loadContacts = React.useCallback(
    async (signal?: AbortSignal) => {
      if (status !== "authenticated") return;

      try {
        setIsLoading(true);

        const res = await fetch(
          `/api/contacts?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(globalFilter)}`,
          { signal }, // 👈 IMPORTANT
        );

        if (!res.ok) throw new Error("Failed to load contacts");

        const data = await res.json();

        if (!signal?.aborted) {
          setContacts(data.data || []);
          setTotalRecords(data.total || 0);
          setTotalPages(Math.max(1, Math.ceil((data.total || 0) / pageSize)));
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [status, page, pageSize, globalFilter],
  );

  React.useEffect(() => {
    const controller = new AbortController();

    loadContacts(controller.signal);

    return () => controller.abort(); // 👈 prevents state update after unmount
  }, [loadContacts]);

  /* ------------------ TABLE COLUMNS ---------------------- */
  const columns = React.useMemo<ColumnDef<Contact>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Can role={["Admin", "Manager"]}>
            <div className="flex justify-center">
              <input
                type="checkbox"
                className="cursor-pointer"
                checked={table.getIsAllPageRowsSelected()}
                onChange={table.getToggleAllPageRowsSelectedHandler()}
              />
            </div>
          </Can>
        ),
        cell: ({ row }) => (
          <Can role={["Admin", "Manager"]}>
            <div className="flex justify-center">
              <input
                type="checkbox"
                className="cursor-pointer"
                checked={row.getIsSelected()}
                disabled={!row.getCanSelect()}
                onChange={row.getToggleSelectedHandler()}
              />
            </div>
          </Can>
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
        size: 40,
        minSize: 40,
        maxSize: 40,
        enableSorting: false,
        cell: () => (
          <div className="flex justify-center w-[40px]">
            <Contact2 className="w-4 h-4 text-gray-500 flex-shrink-0" />
          </div>
        ),
      },

      {
        accessorKey: "broker_name",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Broker Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        size: 200,
      },

      {
        accessorKey: "listing_company",
        header: "Listing Company",
        size: 200,
      },

      {
        accessorKey: "phone",
        header: "Phone",
        size: 150,
      },

      {
        accessorKey: "email",
        header: "Email",
        size: 220,
      },

      {
        accessorKey: "website",
        header: "Website",
        size: 180,
        cell: ({ row }) =>
          row.original.website ? (
            <a
              href={row.original.website}
              target="_blank"
              className="text-blue-600 underline truncate block max-w-[180px]"
            >
              {row.original.website}
            </a>
          ) : (
            <span className="text-gray-400">—</span>
          ),
      },

      {
        id: "actions",
        header: () => (
          <div className="text-right w-[120px] min-w-[120px]">Actions</div>
        ),
        cell: ({ row }) => {
          const item = row.original;

          return (
            <div className="flex justify-end gap-2 w-[120px] min-w-[120px]">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  router.push(`/dashboard/contact/edit?id=${item.contact_id}`)
                }
              >
                <Edit size={16} /> Update
              </Button>
            </div>
          );
        },
      },
    ],
    [router],
  );

  React.useEffect(() => {
    if (status !== "authenticated" || !userId) return;

    const key = `recent_contact_search_${userId}`;

    const saved = localStorage.getItem(key);
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, [status, userId]);

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
      .map((rowIndex) => contacts[Number(rowIndex)]?.contact_id)
      .filter(Boolean);

    if (!selectedIds.length) {
      toast.error("Please select at least one contact.");
      return;
    }

    try {
      setBulkDeleting(true);

      const loadingToast = toast.loading(
        `Deleting ${selectedIds.length} contact(s)...`,
      );

      const res = await fetch("/api/contacts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });

      const json = await res.json();

      if (!json.success) throw new Error(json.message);

      toast.success(`${selectedIds.length} contact(s) deleted`, {
        id: loadingToast,
      });

      setRowSelection({});
      setBulkDeleteOpen(false);
      loadContacts();
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
    const key = `recent_contact_search_${userId}`;
    localStorage.setItem(key, JSON.stringify(updated));
  };

  const applySearch = () => {
    const trimmed = searchInput.trim();

    // Save only if not empty
    if (trimmed) {
      saveRecentSearch(trimmed);
    }

    // Always apply filter (even empty)
    setGlobalFilter(trimmed);

    setPage(1);
    setShowRecentDropdown(false);
  };

  const removeRecentSearch = (value: string) => {
    const updated = recentSearches.filter((v) => v !== value);
    setRecentSearches(updated);
    const key = `recent_contact_search_${userId}`;
    localStorage.setItem(key, JSON.stringify(updated));
  };

  /* ------------------ TABLE INSTANCE ---------------------- */
  const table = useReactTable({
    data: contacts,
    columns,
    state: {
      sorting,
      globalFilter,
      rowSelection,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  /* ------------------ RENDER ---------------------- */
  return (
    <div className="w-11/12 mx-auto mt-6 space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-3 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Contact className="w-6 h-6 text-gray-700" />
            <h2 className="text-xl font-semibold text-gray-800">
              Contact List
            </h2>
          </div>
          <p className="text-sm text-gray-500">Manage broker contacts.</p>
        </div>

        <div
          ref={searchWrapperRef}
          className="flex gap-3 items-center w-full md:w-auto relative"
        >
          {/* Search input + dropdown */}
          <div className="relative w-full md:w-[350px]">
            <Input
              placeholder="Search contacts..."
              value={searchInput}
              onChange={(e) => {
                const value = e.target.value;

                setSearchInput(value);
                setShowRecentDropdown(true);

                // ✅ If input is cleared, reload ALL contacts immediately
                if (!value.trim()) {
                  setGlobalFilter("");
                  setPage(1);
                }
              }}
              onFocus={() => {
                setShowRecentDropdown(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  applySearch();
                }
              }}
              className="w-full"
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
                          setGlobalFilter(item);
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

          {/* Search button */}
          <Button
            onClick={applySearch}
            className="bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2 mt-2"
          >
            <SearchIcon className="w-4 h-4" />
            Search
          </Button>

          {/* Add Contact button */}
          <Button
            className="bg-blue-600 text-white hover:bg-blue-700 mt-2"
            onClick={() => router.push("/dashboard/contact/add")}
          >
            <Plus size={18} /> Add Contact
          </Button>

          {/* Delete selected button */}
          <Can role={["Admin", "Manager"]}>
            <Button
              variant="destructive"
              className="mt-2"
              disabled={bulkDeleting}
              onClick={() => {
                if (!Object.keys(rowSelection).length) {
                  toast.error("Please select at least one contact.");
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
          </Can>
        </div>
      </div>

      {/* ============================= */}
      {/* TABLE — MATCH DOCUMENT STYLE */}
      {/* ============================= */}
      <div className="w-full border border-gray-200 bg-white rounded-lg shadow-sm overflow-hidden">
        <Table className="w-full">
          <TableHeader className="bg-gray-100">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={
                      header.column.columnDef.meta?.headerClassName ??
                      "p-2 font-semibold text-gray-700"
                    }
                    style={{ width: header.getSize() }}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-10 text-center"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : contacts.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-t hover:bg-gray-50 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={
                        cell.column.columnDef.meta?.className ??
                        "p-2 max-w-0 truncate"
                      }
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
                  className="py-6 text-center text-gray-500"
                >
                  No contacts found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* ============================= */}
        {/* PAGINATION (MATCH DOCUMENT UI) */}
        {/* ============================= */}
        <div className="flex items-center justify-between px-4 py-4 border-t bg-white rounded-b-lg">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>

          <span className="text-sm text-gray-700">
            Page <b>{page}</b> of <b>{totalPages}</b>
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="flex items-center gap-1"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Selected Contacts?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Selected contacts will be
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
