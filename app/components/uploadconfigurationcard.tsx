/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";

import {
  Upload,
  FileIcon,
  X,
  CloudUpload,
  Paperclip,
  FileText,
  Search,
  Download,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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

export default function DocumentUploadSection() {
  const { data: session } = useSession();

  // Upload states
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  // List states
  const [documents, setDocuments] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  // Pagination
  const [loadingList, setLoadingList] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const maxFiles = 10;

  const allowedMimeTypes = [
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/pdf",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
  ];

  // ===============================
  // 📌 UPLOAD LOGIC (UNCHANGED)
  // ===============================

  function addFiles(selected: File[]) {
    const valid = selected.filter((f) => allowedMimeTypes.includes(f.type));

    if (valid.length !== selected.length) {
      toast.warning("Only TXT, DOC, DOCX, PDF, XLS, XLSX, and CSV files are allowed.");
    }

    const total = [...files, ...valid];

    if (total.length > maxFiles) {
      toast.warning(`Max ${maxFiles} files allowed`);
      return setFiles(total.slice(0, maxFiles));
    }

    setFiles(total);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(Array.from(e.target.files));
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    addFiles(Array.from(e.dataTransfer.files));
  }

  function removeFile(name: string) {
    setFiles(files.filter((f) => f.name !== name));
  }

  async function handleUpload() {
    if (!session) return toast.error("You must be logged in to upload.");
    if (files.length === 0) return toast.warning("No files selected");

    setUploading(true);
    let completed = 0;
    const failed: string[] = [];

    const toastId = toast.loading(`Uploading 0 of ${files.length}...`);

    for (const file of files) {
      try {
        const res = await fetch(`/api/upload/document?name=${encodeURIComponent(file.name)}`);
        const data = await res.json();
        if (!data.success) throw new Error("Failed to get upload URL");

        const uploadRes = await fetch(data.uploadUrl, {
          method: "PUT",
          body: file,
        });

        if (!uploadRes.ok) throw new Error("Upload failed");

        await fetch("/api/upload/document/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            objectName: data.objectName,
            fileUrl: `gs://${process.env.NEXT_PUBLIC_GCP_BUCKET}/${data.objectName}`,
            userId: session.user.id,
            uploadedByUserName: session.user.username,
          }),
        });
      } catch (err) {
        failed.push(file.name);
      }

      completed++;
      toast.message(`Uploading ${completed} of ${files.length}...`, { id: toastId });
    }

    toast.dismiss(toastId);
    setUploading(false);
    setFiles([]);
    loadDocuments();

    if (failed.length > 0) {
      toast.error(`Failed: ${failed.join(", ")}`);
    } else {
      toast.success("Upload complete!");
    }
  }

  // ===============================
  // 📌 DOCUMENT LIST LOGIC
  // ===============================

  const loadDocuments = useCallback(async () => {
    setLoadingList(true);

    try {
      const res = await fetch(
        `/api/document?search=${encodeURIComponent(search)}&page=${page}&pageSize=${pageSize}`
      );

      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      setDocuments(data.documents);
      setTotal(data.total);
    } catch (err) {
      toast.error("Failed to load document list");
    } finally {
      setLoadingList(false);
    }
  }, [search, page]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // ===============================
  // 📌 DOWNLOAD (UPDATED)
  // ===============================

  function normalizeGsUrl(url: string) {
    return url.replace(`gs://${process.env.NEXT_PUBLIC_GCP_BUCKET}/`, "");
  }

  const handleDownload = useCallback((url: string) => {
    const clean = normalizeGsUrl(url);
    window.location.href = `/api/gcp/download?path=${encodeURIComponent(clean)}`;
  }, []);

  // ===============================
  // 📌 TABLE COLUMNS (TanStack)
  // ===============================

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
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownload(row.original.file_url)}
            className="flex items-center gap-1 bg-blue-700 hover:bg-blue-400 text-white hover:text-white"
          >
            <Download className="w-4 h-4" />
            Download
          </Button>
        ),
      },
    ],
    [handleDownload]
  );

  // Build table
  const table = useReactTable({
    data: documents,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // ===============================
  // 📌 PAGINATION UI
  // ===============================

  const Pagination = () => (
    <div className="flex items-center justify-between px-3 py-3 border-t bg-white">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => setPage(page - 1)}
        className="flex items-center gap-1"
      >
        <ChevronLeft className="w-4 h-4" />
        Previous
      </Button>

      <span className="text-sm">
        Page <b>{page}</b> of <b>{totalPages}</b>
      </span>

      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => setPage(page + 1)}
        className="flex items-center gap-1"
      >
        Next
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );

  // ===============================
  // 📌 UI (Upload + List)
  // ===============================

  return (
    <div className="w-11/12 mx-auto mt-6 space-y-6">

      {/* HEADER */}
      <div>
        <div className="flex items-center gap-2">
          <FileText className="w-6 h-6 text-gray-700" />
          <h2 className="text-xl font-semibold text-gray-800">Document Management</h2>
        </div>
        <p className="text-sm text-gray-500">Upload, Search and Filter Documents.</p>
      </div>

      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="upload">Upload Document</TabsTrigger>
          <TabsTrigger value="list">Document List</TabsTrigger>
        </TabsList>

        {/* ------------------------------ */}
        {/* UPLOAD TAB (UNCHANGED)         */}
        {/* ------------------------------ */}
        <TabsContent value="upload">
          <div className="space-y-6">
            {!session && (
              <p className="text-red-500 text-sm">
                ⚠️ You must be logged in to upload documents.
              </p>
            )}

            {/* Dropzone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className={`border-2 border-dashed rounded-lg py-10 px-6 text-center cursor-pointer 
                ${session ? "hover:border-blue-400 border-gray-300" : "opacity-50 border-gray-200"}`}
            >
              <Upload className="h-10 w-10 text-gray-400 mb-3" />
              <h3 className="text-base font-medium">Upload Documents</h3>
              <p className="text-sm text-gray-500">
                Drag & drop files or click to browse
              </p>

              <input
                type="file"
                className="hidden"
                id="fileUpload"
                multiple
                onChange={handleFileInput}
                disabled={!session}
              />

              <Button asChild disabled={!session} className="mt-4 bg-blue-700 hover:bg-blue-400">
                <label htmlFor="fileUpload" className="flex gap-2 cursor-pointer">
                  <Paperclip />
                  Choose Files
                </label>
              </Button>
            </div>

            {files.length > 0 && (
              <ul className="space-y-2 mt-4">
                {files.map((file) => (
                  <li
                    key={file.name}
                    className="flex items-center justify-between p-3 bg-gray-50 border rounded-md"
                  >
                    <div className="flex items-center gap-2">
                      <FileIcon className="text-blue-500" />
                      <span>{file.name}</span>
                    </div>
                    <button
                      onClick={() => removeFile(file.name)}
                      disabled={uploading}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {files.length > 0 && (
              <div className="flex justify-end">
                <Button disabled={uploading || !session} onClick={handleUpload}>
                  <CloudUpload className="mr-2" />
                  {uploading ? "Uploading..." : "Upload"}
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ------------------------------ */}
        {/* LIST TAB (UPGRADED TABLE)      */}
        {/* ------------------------------ */}
        <TabsContent value="list">
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
                className="pl-9 text-base h-10 rounded-full border border-gray-200 focus-visible:ring-0 shadow-none"
              />
            </div>
          </div>

          {/* TABLE */}
          <div className="overflow-x-auto border border-gray-200 bg-white rounded-md">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((group) => (
                  <TableRow key={group.id}>
                    {group.headers.map((header) => (
                      <TableHead key={header.id}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>

              <TableBody>
                {loadingList ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="py-10 text-center">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="py-6 text-center">
                      No documents found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* PAGINATION */}
            <Pagination />
          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
}
