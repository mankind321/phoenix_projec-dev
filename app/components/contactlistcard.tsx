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
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

/* ------------------ DELETE MODAL ---------------------- */
function DeleteContactModal({ open, onClose, contact, onDeleted }: any) {
  const [isDeleting, setIsDeleting] = React.useState(false);

  if (!contact) return null;

  const handleConfirmDelete = async () => {
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/contacts/${contact.contact_id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        toast.success(`Contact ${contact.broker_name} deleted successfully.`);
        onDeleted();
        onClose();
      } else {
        toast.error(data.message || "Failed to delete contact.");
      }
    } catch (_) {
      toast.error("Something went wrong.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Contact</DialogTitle>
          <DialogDescription>
            Delete <b>{contact.broker_name}</b>? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirmDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting…" : "Confirm Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [selectedContact, setSelectedContact] =
    React.useState<Contact | null>(null);

  /* ------------------ FETCH DATA ---------------------- */
  const loadContacts = React.useCallback(async () => {
    if (status !== "authenticated") return;

    try {
      setIsLoading(true);

      const res = await fetch(
        `/api/contacts?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(
          globalFilter
        )}`
      );

      if (!res.ok) throw new Error("Failed to load contacts");

      const data = await res.json();
      setContacts(data.data || []);
      setTotalRecords(data.total || 0);
      setTotalPages(Math.max(1, Math.ceil((data.total || 0) / pageSize)));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [status, page, pageSize, globalFilter]);

  React.useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  /* ------------------ TABLE COLUMNS ---------------------- */
  const columns = React.useMemo<ColumnDef<Contact>[]>(
    () => [
      {
        id: "icon",
        header: "",
        size: 40,
        enableSorting: false,
        cell: () => (
          <div className="flex justify-center">
            <Contact2 className="w-5 h-5 text-gray-500" />
          </div>
        ),
      },

      {
        accessorKey: "broker_name",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
          >
            Broker Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
      },

      { accessorKey: "listing_company", header: "Listing Company" },
      { accessorKey: "phone", header: "Phone" },
      { accessorKey: "email", header: "Email" },

      {
        accessorKey: "website",
        header: "Website",
        cell: ({ row }) => (
          <a
            href={row.original.website}
            target="_blank"
            className="text-blue-600 underline"
          >
            {row.original.website}
          </a>
        ),
      },

      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const item = row.original;

          return (
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  router.push(`/dashboard/contact/edit?id=${item.contact_id}`)
                }
              >
                <Edit size={16} />
              </Button>
              
              <Can role={["Admin","Manager"]}>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    setSelectedContact(item);
                    setDeleteOpen(true);
                  }}
                >
                  <Trash2 size={16} />
                </Button>
              </Can>
            </div>
          );
        },
      },
    ],
    [router]
  );

  /* ------------------ TABLE INSTANCE ---------------------- */
  const table = useReactTable({
    data: contacts,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
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
              Broker List
            </h2>
          </div>
          <p className="text-sm text-gray-500">Manage broker contacts.</p>
        </div>

        <div className="flex gap-3 items-center w-full md:w-auto">
          <Input
            placeholder="Search contacts..."
            value={globalFilter}
            onChange={(e) => {
              setGlobalFilter(e.target.value);
              setPage(1);
            }}
            className="w-full md:w-[350px]"
          />

          <Button
            className="bg-blue-600 text-white hover:bg-blue-700 mt-2"
            onClick={() => router.push("/dashboard/contact/add")}
          >
            <Plus size={18} /> Add Contact
          </Button>
        </div>
      </div>

      {/* ============================= */}
      {/* TABLE — MATCH DOCUMENT STYLE */}
      {/* ============================= */}
      <div className="overflow-x-auto border border-gray-200 bg-white rounded-lg shadow-sm">
        <Table>
          <TableHeader className="bg-gray-100">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="p-3 font-semibold text-gray-700"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
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
                    <TableCell key={cell.id} className="p-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
      
      <DeleteContactModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        contact={selectedContact}
        onDeleted={loadContacts}
      />
    </div>
  );
}
