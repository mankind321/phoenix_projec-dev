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

/* ------------------ TYPE ---------------------- */

export interface ErrorMonitoringRecord {
  file_id: string;
  file_name: string;
  extraction_status: string;
  extraction_confidence_level_percentage: string;
  remarks: string | null;
  created_at: string;
}

/* ------------------ DELETE MODAL ---------------------- */

function DeleteErrorMonitoringModal({
  open,
  onClose,
  record,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  record: ErrorMonitoringRecord | null;
  onDeleted: () => void;
}) {
  const [isDeleting, setIsDeleting] = React.useState(false);

  if (!record) return null;

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/errormonitoring/${record.file_id}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok || !json.success)
        throw new Error(json.error || "Delete failed");

      toast.success(`"${record.file_name}" deleted successfully.`);

      onDeleted();
      onClose();

    } catch (err: any) {

      toast.error(err.message);

    } finally {

      setIsDeleting(false);

    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>

        <DialogHeader>

          <DialogTitle>Delete Record</DialogTitle>

          <DialogDescription>
            Delete <b>{record.file_name}</b>? This action cannot be undone.
          </DialogDescription>

        </DialogHeader>

        <DialogFooter>

          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>

          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting…" : "Confirm Delete"}
          </Button>

        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
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

export default function ErrorMonitoringTable() {

  const router = useRouter();

  const [data, setData] = React.useState<ErrorMonitoringRecord[]>([]);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [loading, setLoading] = React.useState(true);

  const [page, setPage] = React.useState(1);
  const pageSize = 10;
  const [totalPages, setTotalPages] = React.useState(1);

  const [search, setSearch] = React.useState("");

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [selected, setSelected] =
    React.useState<ErrorMonitoringRecord | null>(null);

  /* ------------------ FETCH ---------------------- */

  const loadRecords = React.useCallback(async () => {

    try {

      setLoading(true);

      const res = await fetch(
        `/api/errormonitoring?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(search)}`
      );

      if (!res.ok)
        throw new Error("Failed to load records");

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

  const columns = React.useMemo<ColumnDef<ErrorMonitoringRecord>[]>(() => [

    {
      id: "icon",
      header: "",
      enableSorting: false,
      cell: () => (
        <div className="flex justify-center">
          <FileWarning className="w-5 h-5 text-gray-500" />
        </div>
      ),
    },

    {
      accessorKey: "file_name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() =>
            column.toggleSorting(column.getIsSorted() === "asc")
          }
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
        <span className="font-medium text-red-600">
          {getValue<string>()}
        </span>
      ),
    },

    {
      accessorKey: "remarks",
      header: "Remarks",
      cell: ({ row }) =>
        row.original.remarks
          ? (
            <div className="max-w-[500px] text-sm whitespace-normal break-words">
              {row.original.remarks}
            </div>
          )
          : (
            <span className="italic text-gray-400">—</span>
          ),
    },

    /* ---------- UPDATED ACTION COLUMN ---------- */

    {
      id: "action",
      header: () => <div className="text-right">Action</div>,
      cell: ({ row }) => (

        <div className="flex justify-end gap-2">

          {/* VIEW BUTTON */}

          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              router.push(`/dashboard/errormonitoring/${row.original.file_id}`)
            }
          >
            <Eye size={16} /> View
          </Button>


          {/* DELETE BUTTON */}

          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              setSelected(row.original);
              setDeleteOpen(true);
            }}
          >
            <Trash2 size={16} /> Delete
          </Button>

        </div>

      ),
    },

  ], [router]);

  const table = useReactTable({

    data,
    columns,

    state: { sorting },

    onSortingChange: setSorting,

    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),

  });

  /* ------------------ UI ---------------------- */

  return (

    <div className="space-y-6">

      <div className="flex justify-between">

        <Input
          placeholder="Search file name..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-[320px]"
        />

      </div>


      {/* TABLE */}

      <div className="border rounded-lg bg-white shadow-sm overflow-x-auto">

        <Table>

          <TableHeader>

            {table.getHeaderGroups().map((hg) => (

              <TableRow key={hg.id}>

                {hg.headers.map((h) => (

                  <TableHead key={h.id}>

                    {flexRender(
                      h.column.columnDef.header,
                      h.getContext()
                    )}

                  </TableHead>

                ))}

              </TableRow>

            ))}

          </TableHeader>

          <TableBody>

            {loading
              ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="text-center py-10"
                  >
                    Loading…
                  </TableCell>
                </TableRow>
              )
              : data.length
              ? table.getRowModel().rows.map((row) => (

                  <TableRow key={row.id}>

                    {row.getVisibleCells().map((cell) => (

                      <TableCell key={cell.id}>

                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}

                      </TableCell>

                    ))}

                  </TableRow>

                ))
              : (
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


      <DeleteErrorMonitoringModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        record={selected}
        onDeleted={loadRecords}
      />

    </div>

  );

}
