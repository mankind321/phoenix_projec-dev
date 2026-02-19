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
  RotateCcw,
  Plus,
  ChevronLeft,
  ChevronRight,
  Users,
  LogOutIcon,
  LogOut,
} from "lucide-react";

import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import { toast } from "sonner";

import { Clock, X, Search as SearchIcon } from "lucide-react";
import { useRef } from "react";

interface User {
  userid: number;
  first_name: string;
  middle_name?: string;
  last_name: string;
  date_of_birth: string;
  gender?: string;
  email: string;
  mobile: string;
  address: string;
  license_number: string;
  license_issued_by: string;
  license_expiration: string;
  username?: string;
  manager?: string;
  accountid: string;
}

// ========================
// DELETE MODAL
// ========================
function DeleteUserModal({ open, onClose, user, onDeleted }: any) {
  const [isDeleting, setIsDeleting] = React.useState(false);
  if (!user) return null;

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/users/${user.userid}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        toast.success(`User ${user.first_name} deleted.`);
        onDeleted();
        onClose();
      } else {
        toast.error(data.message || "Failed to delete user.");
      }
    } catch (err) {
      toast.error("Unexpected error.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogDescription>
            Delete{" "}
            <b>
              {user.first_name} {user.last_name}
            </b>
            ? This cannot be undone.
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
            {isDeleting ? "Deleting…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ========================
// MAIN TABLE
// ========================
export default function UserTable() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [users, setUsers] = React.useState<User[]>([]);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");

  // Pagination — match Document Table
  const [page, setPage] = React.useState(1);
  const pageSize = 10;
  const [totalRecords, setTotalRecords] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);

  const [isLoading, setIsLoading] = React.useState(true);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState<User | null>(null);
  const [loggingOutUserId, setLoggingOutUserId] = React.useState<number | null>(
    null,
  );

  const userId = session?.user?.id;
  const storageKey = `recent_user_search_${userId}`;

  const [searchInput, setSearchInput] = React.useState("");
  const [recentSearches, setRecentSearches] = React.useState<string[]>([]);
  const [showRecentDropdown, setShowRecentDropdown] = React.useState(false);

  const searchWrapperRef = useRef<HTMLDivElement>(null);

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

    setGlobalFilter(trimmed);
    setPage(1);
    setShowRecentDropdown(false);
  };

  const removeRecentSearch = (value: string) => {
    const updated = recentSearches.filter((v) => v !== value);
    setRecentSearches(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  // ========================
  // FETCH USERS
  // ========================
  const loadUsers = React.useCallback(async () => {
    if (status !== "authenticated") return;

    try {
      setIsLoading(true);

      const res = await fetch(
        `/api/users?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(globalFilter)}`,
      );
      const data = await res.json();

      setUsers(data.data ?? []);
      setTotalRecords(data.total ?? 0);
      setTotalPages(Math.max(1, Math.ceil((data.total ?? 0) / pageSize)));
    } catch (err) {
      toast.error("Failed to load users.");
    } finally {
      setIsLoading(false);
    }
  }, [status, page, pageSize, globalFilter]);

  const handleForceLogout = async (user: User) => {
    if (!user.accountid) {
      toast.error("Missing account ID.");
      return;
    }

    setLoggingOutUserId(user.userid);

    try {
      const res = await fetch(
        `/api/users/${user.accountid}/force-logout`, // ✅ UUID
        { method: "POST" },
      );

      console.log("Account ID:", user.accountid);

      const data = await res.json();

      if (data.success) {
        toast.success(
          `User ${user.first_name} ${user.last_name} has been logged out`,
        );
      } else {
        toast.error(data.message || "Failed to force logout user.");
      }
    } catch {
      toast.error("Unexpected error.");
    } finally {
      setLoggingOutUserId(null);
    }
  };

  React.useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // ========================
  // COLUMNS
  // ========================
  const columns = React.useMemo<ColumnDef<User>[]>(
    () => [
      {
        id: "icon",
        header: "",
        enableSorting: false,
        size: 40,
        cell: () => (
          <div className="flex justify-center">
            <Users className="w-4 h-4 text-gray-500" />
          </div>
        ),
      },
      {
        id: "full_name",
        accessorFn: (row) =>
          `${row.first_name} ${row.middle_name || ""} ${row.last_name}`.trim(),
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Full Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
      },
      { accessorKey: "email", header: "Email" },
      { accessorKey: "mobile", header: "Mobile" },
      { accessorKey: "username", header: "Username" },
      { accessorKey: "manager", header: "Manager" },

      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const user = row.original;

          return (
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  router.push(`/dashboard/users/edit?id=${user.userid}`)
                }
              >
                <Edit size={15} />
              </Button>

              <Button
                className="bg-blue-700 hover:bg-blue-500 text-white hover:text-white"
                size="sm"
                variant="secondary"
                disabled={loggingOutUserId === user.userid}
                onClick={() => handleForceLogout(user)}
                title="Force Logout"
              >
                <LogOut size={15} />
              </Button>

              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  setSelectedUser(user);
                  setDeleteOpen(true);
                }}
              >
                <Trash2 size={15} />
              </Button>
            </div>
          );
        },
      },
    ],
    [loggingOutUserId, router],
  );

  // ========================
  // TABLE INSTANCE
  // ========================
  const table = useReactTable({
    data: users,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // ========================
  // AUTH CHECKS
  // ========================
  if (status === "loading")
    return <p className="text-center mt-10">Checking session…</p>;
  if (status !== "authenticated")
    return <p className="text-center mt-10">Please login.</p>;

  // ========================
  // RENDER UI
  // ========================
  return (
    <div className="w-11/12 mx-auto mt-6 space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-3 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-gray-700" />
            <h2 className="text-xl font-semibold text-gray-800">User List</h2>
          </div>
          <p className="text-sm text-gray-500">
            Manage and view all registered users.
          </p>
        </div>

        <div
          ref={searchWrapperRef}
          className="flex items-center gap-3 w-full md:w-auto relative"
        >
          {/* Search Input */}
          <div className="relative w-full md:w-[350px]">
            <Input
              placeholder="Search users..."
              value={searchInput}
              onChange={(e) => {
                const value = e.target.value;

                setSearchInput(value);
                setShowRecentDropdown(true);

                // reload all users when cleared
                if (!value.trim()) {
                  setGlobalFilter("");
                  setPage(1);
                }
              }}
              onFocus={() => setShowRecentDropdown(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applySearch();
              }}
              className="w-full"
            />

            {/* Recent Search Dropdown */}
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

          {/* Search Button */}
          <Button
            onClick={applySearch}
            className="bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2"
          >
            <SearchIcon className="w-4 h-4" />
            Search
          </Button>

          {/* Add User */}
          <Button
            className="bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => router.push("/dashboard/users/add")}
          >
            <Plus size={18} />
            Add User
          </Button>
        </div>
      </div>

      {/* ============================= */}
      {/* TABLE — MATCH DOCUMENT LAYOUT */}
      {/* ============================= */}
      <div className="overflow-x-auto border border-gray-200 bg-white rounded-lg shadow-sm">
        <Table>
          <TableHeader className="bg-gray-100">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="text-left font-semibold text-gray-700 p-3"
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
            ) : users.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-t hover:bg-gray-50 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="p-3">
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
                  No matching records found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* PAGINATION */}
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

      {/* DELETE MODAL */}
      <DeleteUserModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        user={selectedUser}
        onDeleted={loadUsers}
      />
    </div>
  );
}
