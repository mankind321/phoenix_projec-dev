"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronUp,
  FileText,
  Download,
  Loader2,
  Cog,
} from "lucide-react";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { useSession } from "next-auth/react";


interface AuditLog {
  id: number;
  user_id: number; // ✅ Added
  username: string;
  role: string;
  action_type: string;
  table_name: string;
  record_id?: string;
  description?: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
  priority?: "low" | "medium" | "high";
}


const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "low":
      return "bg-green-100 text-green-700";
    case "medium":
      return "bg-yellow-100 text-yellow-700";
    case "high":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
};

export default function AuditTrailDashboard() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [fromDate, setFromDate] = useState<string | null>(null);
  const [toDate, setToDate] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState("custom");
 const [users, setUsers] = useState<
  {
    userId: number;
    username: string;
    role: string;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
    fullName: string;
  }[]
>([]);
   

  const { data: session } = useSession();

  async function loadData() {
      const res = await fetch(`/api/audit-trail?page=1`, {
      headers: {
        Authorization: `Bearer ${session?.user?.supabaseAccessToken}`,
      },
    });
    return res
  }
  loadData().then(console.log);


  const applyDatePreset = (preset: string) => {
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().split("T")[0];

    if (preset === "today") {
      const date = fmt(today);
      setFromDate(date);
      setToDate(date);
    } else if (preset === "last7") {
      const to = fmt(today);
      const from = fmt(new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000));
      setFromDate(from);
      setToDate(to);
    } else if (preset === "thisMonth") {
      const to = fmt(today);
      const from = fmt(new Date(today.getFullYear(), today.getMonth(), 1));
      setFromDate(from);
      setToDate(to);
    } else {
      // custom — enable date inputs
      setFromDate(null);
      setToDate(null);
    }
  };

  const downloadPdf = () => {
    const params = new URLSearchParams();

    if (search) params.append("search", search);
    if (actionFilter !== "all") params.append("action", actionFilter);
    if (userFilter !== "all") params.append("user", userFilter);
    if (fromDate) params.append("fromDate", fromDate);
    if (toDate) params.append("toDate", toDate);

    window.open(`/api/audit-trail/export?${params.toString()}`, "_blank");
  };

  // ✅ Fetch logs from API (with filters)
  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);

      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("pageSize", pageSize.toString());

      if (search) params.append("search", search);
      if (actionFilter !== "all") params.append("action", actionFilter);
      if (userFilter !== "all") params.append("user", userFilter);
      if (fromDate) params.append("fromDate", fromDate);
      if (toDate) params.append("toDate", toDate);

      const res = await fetch(`/api/audit-trail?${params.toString()}`);
      const data = await res.json();

      console.log("🔥 API Response /api/audit-trail:", data);
      console.log("🔥 Logs:", data.logs);
      console.log("🔥 Pagination:", data.pagination);
      console.log("🔥 User Filter:", userFilter);

      if (data.success) {
        setLogs(data.logs || []);
        setTotalPages(data.pagination.totalPages || 1);
      }

      setIsLoading(false);
    };

    fetchLogs();
  }, [page, pageSize, search, actionFilter, userFilter, fromDate, toDate]);

  useEffect(() => {
    setPage(1);
  }, [search, actionFilter, userFilter, fromDate, toDate, datePreset]);

  useEffect(() => {
    async function fetchUsers() {
      const res = await fetch("/api/users/list"); // Backend: returns visible users based on role
      const data = await res.json();
      if (data.success) setUsers(data.users);
    }
    fetchUsers();
  }, []);

  

  return (
    <div className="w-11/12 mx-auto mt-6 space-y-6">

      {/* ====================== */}
      {/* 🧭 FILTER SECTION (NO CARD) */}
      {/* ====================== */}
      <div>
        <div>
          <div className="flex items-center gap-2">
            <Cog className="w-6 h-6 text-gray-700" />
            <h2 className="text-xl font-semibold text-gray-800">
              System Audit Trail
            </h2>
          </div>
          <p className="text-sm text-gray-500">
            Log and review all user and system events for transparency and accountability.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-3 mt-3">
          {/* 🔍 Search */}
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">Search</p>
            <Input
              placeholder="Search events..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* ⚙️ Action Filter */}
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">Action</p>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="CREATE">Create</SelectItem>
                <SelectItem value="UPDATE">Update</SelectItem>
                <SelectItem value="DELETE">Delete</SelectItem>
                <SelectItem value="VIEW">View</SelectItem>
                <SelectItem value="LOGIN">Login</SelectItem>
                <SelectItem value="LOGOUT">Logout</SelectItem>
                <SelectItem value="EXPORT">Export</SelectItem>
                <SelectItem value="IMPORT">Import</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 👤 User Filter */}
          {session?.user?.role !== "Agent" && (
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">User</p>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.userId} value={String(u.userId)}>
                      {u.fullName || u.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Export button */}
          <div className="flex items-end justify-end">
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
              onClick={downloadPdf}
            >
              <Download className="w-4 h-4" /> Export Log
            </Button>
          </div>

          {/* 📅 Date Preset */}
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">Date Filter</p>
            <Select
              value={datePreset}
              onValueChange={(v) => {
                setDatePreset(v);
                applyDatePreset(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="last7">Last 7 Days</SelectItem>
                <SelectItem value="thisMonth">This Month</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom Date Range */}
          {datePreset === "custom" && (
            <>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">From</p>
                <Input
                  type="date"
                  value={fromDate ?? ""}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setPage(1);
                  }}
                />
              </div>

              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">To</p>
                <Input
                  type="date"
                  value={toDate ?? ""}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* ====================== */}
      {/* 📋 SYSTEM LOG LIST (NO CARD) */}
      {/* ====================== */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-800">System Activity Log</h2>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-8 text-gray-500">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Loading logs...
          </div>
        ) : logs.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No audit records found.</p>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => {
              const uniqueKey = `${log.id ?? log.created_at}-${log.username ?? log.role}`;

              return (
                <div
                  key={uniqueKey}
                  className="border border-gray-100 rounded-md bg-gray-50 p-4 hover:bg-gray-100 transition"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-full ${
                          log.action_type === "DELETE"
                            ? "bg-red-100 text-red-500"
                            : log.action_type === "UPDATE"
                            ? "bg-yellow-100 text-yellow-600"
                            : log.action_type === "CREATE"
                            ? "bg-green-100 text-green-600"
                            : "bg-blue-100 text-blue-600"
                        } flex items-center justify-center`}
                      >
                        <FileText className="w-4 h-4" />
                      </div>

                      <div>
                        <h3 className="font-semibold text-gray-800 text-sm">
                          {log.description || log.action_type}
                        </h3>

                        <p className="text-xs text-gray-500 mt-1">
                          {log.username} ({log.role}) •{" "}
                          {new Date(log.created_at).toLocaleString()} • IP: {log.ip_address}
                        </p>

                        <p className="text-xs text-gray-500">
                          Entity: {log.table_name} — Record ID: {log.record_id ?? "N/A"}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${getPriorityColor(
                        log.priority || "low"
                      )}`}
                    >
                      {log.priority || "low"}
                    </span>
                  </div>

                  <button
                    onClick={() =>
                      setExpanded(expanded === uniqueKey ? null : uniqueKey)
                    }
                    className="text-sm text-blue-600 mt-2 flex items-center gap-1 hover:underline"
                  >
                    {expanded === uniqueKey ? (
                      <>
                        <ChevronUp className="w-4 h-4" /> Hide Details
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" /> View Details
                      </>
                    )}
                  </button>

                  {expanded === uniqueKey && (
                    <div className="mt-2 text-sm text-gray-600 bg-white rounded-md p-3 border">
                      <p>
                        <strong>Action:</strong> {log.action_type}
                      </p>
                      <p>
                        <strong>Table:</strong> {log.table_name}
                      </p>
                      <p>
                        <strong>User Agent:</strong> {log.user_agent}
                      </p>
                      <p>
                        <strong>IP Address:</strong> {log.ip_address}
                      </p>
                      <p>
                        <strong>Timestamp:</strong>{" "}
                        {new Date(log.created_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Pagination */}
            <div className="flex justify-between items-center mt-6 border-t pt-4">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                ⬅ Prev
              </Button>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Page</span>
                <Input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={page}
                  onChange={(e) => {
                    const newPage = Number(e.target.value);
                    if (newPage >= 1 && newPage <= totalPages) setPage(newPage);
                  }}
                  className="w-16 text-center"
                />
                <span className="text-sm text-gray-600">of {totalPages}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Show</span>
                <Select
                  value={pageSize.toString()}
                  onValueChange={(v) => {
                    setPageSize(parseInt(v));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-gray-600">per page</span>
              </div>

              <Button
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next ➡
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}