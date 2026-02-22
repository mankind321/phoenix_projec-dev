/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Download,
  ChevronLeft,
  ChevronRight,
  FileText,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
} from "@tanstack/react-table";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import { Can } from "./can";

import { useSession } from "next-auth/react";
import { Clock, X, Search } from "lucide-react";
import React, { useRef } from "react";

export default function DocumentListTab() {
  // ------------------------------
  // STATE (MOVED HERE)
  // ------------------------------
  const [documents, setDocuments] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loadingList, setLoadingList] = useState(false);

  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const [draftDateFrom, setDraftDateFrom] = useState("");
  const [draftDateTo, setDraftDateTo] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: session } = useSession();
  const userId = session?.user?.id;

  const storageKey = `recent_document_search_${userId}`;

  const [searchInput, setSearchInput] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showRecentDropdown, setShowRecentDropdown] = useState(false);

  const [rowSelection, setRowSelection] = useState({});

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const searchWrapperRef = useRef<HTMLDivElement>(null);

  // ------------------------------
  // DATA FETCH (MOVED HERE)
  // ------------------------------
  const loadDocuments = useCallback(async () => {
    setLoadingList(true);

    const params = new URLSearchParams({
      search,
      page: String(page),
      pageSize: String(pageSize),
    });

    if (dateFrom) params.append("dateFrom", dateFrom);
    if (dateTo) params.append("dateTo", dateTo);

    try {
      const res = await fetch(`/api/document?${params.toString()}`);
      const data = await res.json();

      if (!data.success) throw new Error(data.message);

      setDocuments(data.documents);
      setTotal(data.total);
    } catch {
      toast.error("Failed to load document list");
    } finally {
      setLoadingList(false);
    }
  }, [search, page, dateFrom, dateTo]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

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

  useEffect(() => {
    if (!userId) return;

    const saved = localStorage.getItem(storageKey);
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, [storageKey, userId]);

  useEffect(() => {
    const handler = () => {
      loadDocuments();
    };

    window.addEventListener("document-list-updated", handler);

    return () => {
      window.removeEventListener("document-list-updated", handler);
    };
  }, [loadDocuments]);

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

  // ------------------------------
  // DOWNLOAD (MOVED HERE)
  // ------------------------------
  function normalizeGsUrl(url: string) {
    return url.replace(`gs://${process.env.NEXT_PUBLIC_GCP_BUCKET}/`, "");
  }

  /**const handleDelete = useCallback(
    async (documentId: string) => {
      if (!confirm("Are you sure you want to delete this document?")) return;

      try {
        const res = await fetch(`/api/document?id=${documentId}`, {
          method: "DELETE",
        });

        const data = await res.json();

        if (!data.success) throw new Error(data.message);

        toast.success("Document deleted successfully");

        // reload own list
        loadDocuments();

        // notify other components (optional future use)
        window.dispatchEvent(new Event("document-list-updated"));
      } catch (err: any) {
        toast.error(err.message || "Failed to delete document");
      }
    },
    [loadDocuments],
  );**/

  const handleBulkDelete = useCallback(async () => {
    const selectedIds = Object.keys(rowSelection)
      .map((rowIndex) => documents[Number(rowIndex)]?.document_id)
      .filter(Boolean);

    if (!selectedIds.length) {
      toast.error("Please select at least one document.");
      return;
    }

    try {
      setDeleting(true);

      const loadingToast = toast.loading(
        `Deleting ${selectedIds.length} document(s)...`,
      );

      const res = await fetch("/api/document", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });

      const data = await res.json();

      if (!data.success) throw new Error(data.message);

      toast.success(`${selectedIds.length} document(s) deleted`, {
        id: loadingToast,
      });

      setRowSelection({});
      setConfirmOpen(false);
      loadDocuments();
      window.dispatchEvent(new Event("document-list-updated"));
    } catch (err: any) {
      toast.error(err.message || "Bulk delete failed");
    } finally {
      setDeleting(false);
    }
  }, [rowSelection, documents, loadDocuments]);

  const handleDownload = useCallback(
    async (documentId: string, url: string) => {
      try {
        setDownloadingId(documentId);

        const clean = normalizeGsUrl(url);

        const downloadUrl = `/api/gcp/download?path=${encodeURIComponent(
          clean,
        )}`;

        console.log(downloadUrl);

        // Step 1: Check if exists using HEAD
        const check = await fetch(downloadUrl, {
          method: "HEAD",
        });

        if (!check.ok) {
          if (check.status === 404) {
            toast.error("Document file not found.");
          } else if (check.status === 401) {
            toast.error("You are not authorized.");
          } else {
            toast.error("Document is not available.");
          }
          return;
        }

        // Step 2: Download if exists
        window.location.href = downloadUrl;

        toast.success("Download started");
      } catch (error) {
        console.error(error);
        toast.error("Failed to download document");
      } finally {
        setDownloadingId(null);
      }
    },
    [],
  );

  // ------------------------------
  // TABLE COLUMNS (MOVED HERE)
  // ------------------------------
  const columns: ColumnDef<any>[] = useMemo(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Can role={["Admin", "Manager"]}>
            <div className="flex items-center justify-center">
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
            <div className="flex items-center justify-center">
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
          className: "px-2", // 👈 reduce horizontal padding
        },
      },
      {
        id: "icon",
        header: "",
        cell: () => (
          <div className="flex items-center justify-center">
            <FileText className="w-5 h-5 text-gray-500" />
          </div>
        ),
        size: 40,
        meta: {
          className: "px-2",
        },
      },
      {
        accessorKey: "file_url",
        header: "Filename",
        cell: ({ row }) => {
          const filename = row.original.file_url?.split("/").pop();

          return (
            <div className="whitespace-normal break-all max-w-[300px]">
              {filename}
            </div>
          );
        },
      },
      {
        accessorKey: "user_name",
        header: "Uploaded By",
      },
      {
        accessorKey: "doc_type",
        header: "Document Type",
        cell: ({ row }) => {
          const value = row.getValue("doc_type") as string;

          if (!value) return "";

          // Convert to First Letter Uppercase
          const formatted = value
            .toLowerCase()
            .replace(/\b\w/g, (char) => char.toUpperCase());

          return formatted;
        },
      },
      {
        id: "related",
        header: "Property / Tenant",
        cell: ({ row }) => {
          const doc = row.original;

          const value =
            !doc.property_id && doc.lease_id
              ? doc.lease_tenant
              : doc.property_name || "—";

          return (
            <div className="whitespace-normal break-words max-w-[250px]">
              {value}
            </div>
          );
        },
      },

      {
        accessorKey: "uploaded_on",
        header: "Date",
        cell: ({ row }) => new Date(row.original.uploaded_on).toLocaleString(),
      },
      {
        id: "actions",
        header: "Action",
        cell: ({ row }) => (
          <div className="flex gap-2">
            {" "}
            {/* Download */}{" "}
            <Button
              size="sm"
              disabled={downloadingId === row.original.document_id}
              onClick={() =>
                handleDownload(row.original.document_id, row.original.file_url)
              }
              className="flex items-center gap-1 bg-blue-700 hover:bg-blue-400 text-white disabled:bg-gray-400"
            >
              {" "}
              <Download className="w-4 h-4" />{" "}
              {downloadingId === row.original.document_id
                ? "Checking..."
                : "Download"}{" "}
            </Button>{" "}
          </div>
        ),
      },
    ],
    [downloadingId, handleDownload],
  );

  const table = useReactTable({
    data: documents,
    columns,
    state: {
      rowSelection,
    },
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
  });

  // ------------------------------
  // UI
  // ------------------------------
  return (
    <>
      {/* Search + Filters */}
      <div className="flex items-center justify-between mb-4">
        <div
          ref={searchWrapperRef}
          className="relative flex items-center gap-2"
        >
          <div className="relative">
            <Input
              placeholder="Search by Document Name, Uploader, Type, or Property/Tenant."
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
              className="w-[500px]"
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
        </div>

        <div className="flex gap-3 mt-2">
          <Input
            type="date"
            value={draftDateFrom}
            onChange={(e) => setDraftDateFrom(e.target.value)}
          />
          <Input
            type="date"
            value={draftDateTo}
            onChange={(e) => setDraftDateTo(e.target.value)}
          />

          <Button
            className="bg-blue-700 text-white mt-2"
            onClick={() => {
              setDateFrom(draftDateFrom);
              setDateTo(draftDateTo);
              setPage(1);
            }}
          >
            Apply
          </Button>

          <Button
            className="bg-red-700 text-white mt-2"
            onClick={() => {
              setDraftDateFrom("");
              setDraftDateTo("");
              setDateFrom("");
              setDateTo("");
              setPage(1);
            }}
          >
            Clear
          </Button>

          <Can role={["Admin", "Manager"]}>
            <Button
              onClick={() => {
                if (!Object.keys(rowSelection).length) {
                  toast.error("Please select at least one document.");
                  return;
                }
                setConfirmOpen(true);
              }}
              disabled={deleting}
              className="mb-3 bg-red-700 hover:bg-red-500 text-white mt-2"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Selected ({table.getSelectedRowModel().rows.length})
            </Button>
          </Can>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border rounded-md bg-white">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={header.column.columnDef.meta?.className}
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
            {loadingList ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-8"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length ? (
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
                  className="text-center py-6"
                >
                  No documents found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </Button>

          <span className="text-sm">
            Page <b>{page}</b> of <b>{totalPages}</b>
          </span>

          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Selected Documents?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The selected documents will be
              permanently removed.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>

            <Button
              className="bg-red-700 hover:bg-red-500 text-white"
              onClick={handleBulkDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Confirm Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
