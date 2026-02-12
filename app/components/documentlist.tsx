/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
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
import { Can } from "./can";

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

  // ------------------------------
  // DOWNLOAD (MOVED HERE)
  // ------------------------------
  function normalizeGsUrl(url: string) {
    return url.replace(`gs://${process.env.NEXT_PUBLIC_GCP_BUCKET}/`, "");
  }

  const handleDelete = useCallback(
    async (documentId: string) => {
      if (!confirm("Are you sure you want to delete this document?")) return;

      try {
        const res = await fetch(`/api/document?id=${documentId}`, {
          method: "DELETE",
        });

        const data = await res.json();

        if (!data.success) throw new Error(data.message);

        toast.success("Document deleted successfully");

        // reload list
        loadDocuments();
      } catch (err: any) {
        toast.error(err.message || "Failed to delete document");
      }
    },
    [loadDocuments],
  );

  const handleDownload = useCallback((url: string) => {
    const clean = normalizeGsUrl(url);
    window.location.href = `/api/gcp/download?path=${encodeURIComponent(
      clean,
    )}`;
  }, []);

  // ------------------------------
  // TABLE COLUMNS (MOVED HERE)
  // ------------------------------
  const columns: ColumnDef<any>[] = useMemo(
    () => [
      {
        id: "icon",
        header: "",
        cell: () => (
          <div className="text-center">
            <FileText className="w-5 h-5 text-gray-500 mx-auto" />
          </div>
        ),
      },
      {
        accessorKey: "file_url",
        header: "Filename",
        cell: ({ row }) => row.original.file_url?.split("/").pop(),
      },
      {
        accessorKey: "user_name",
        header: "Uploaded By",
      },
      {
        accessorKey: "doc_type",
        header: "Document Type",
      },
      {
        id: "related",
        header: "Property / Tenant",
        cell: ({ row }) => {
          const doc = row.original;
          return !doc.property_id && doc.lease_id
            ? doc.lease_tenant
            : doc.property_name || "—";
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
            {/* Download */}
            <Button
              size="sm"
              onClick={() => handleDownload(row.original.file_url)}
              className="flex items-center gap-1 bg-blue-700 hover:bg-blue-400 text-white"
            >
              <Download className="w-4 h-4" />
              Download
            </Button>

            {/* Delete */}
            <Can role={["Admin", "Manager"]}>
              <Button
                size="sm"
                onClick={() => handleDelete(row.original.document_id)}
                className="flex items-center gap-1 bg-red-700 hover:bg-red-500 text-white"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </Can>
          </div>
        ),
      },
    ],
    [handleDelete, handleDownload],
  );

  const table = useReactTable({
    data: documents,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // ------------------------------
  // UI
  // ------------------------------
  return (
    <>
      {/* Search + Filters */}
      <div className="flex items-center justify-between mb-4">
        <div className="relative w-100">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5 mt-1" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9 rounded-full"
          />
        </div>

        <div className="flex gap-3">
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
            className="bg-blue-700 text-white"
            onClick={() => {
              setDateFrom(draftDateFrom);
              setDateTo(draftDateTo);
              setPage(1);
            }}
          >
            Apply
          </Button>

          <Button
            className="bg-red-700 text-white"
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
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border rounded-md bg-white">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead key={header.id}>
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
                    <TableCell key={cell.id}>
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
    </>
  );
}
