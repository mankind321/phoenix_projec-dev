/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

import {
  Upload,
  FileIcon,
  X,
  CloudUpload,
  Paperclip,
  FileText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { toast } from "sonner";

import { useRealtimeTest } from "@/hooks/useRealtimeTest";

import ErrorMonitoringTable from "./errormonitoringcard";
import DocumentListTab from "./documentlist";

const documentTypes = [
  "Property Brochure",
  "Offering Memorandum",
  "Rent Roll",
  "Site Plan",
  "Others",
];

export default function DocumentUploadSection() {
  const { data: session } = useSession();

  // ------------------------------
  // STATE
  // ------------------------------
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState("");
  const [activeTab, setActiveTab] = useState("upload");

  const [errorCount, setErrorCount] = useState(0);
  const [documentCount, setDocumentCount] = useState(0);

  const reachedLimit = files.length >= 1000;
  const maxFiles = 1000;

  const allowedMimeTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
  ];

  const mimeTypeLabels: Record<string, string> = {
    "application/pdf": "PDF",
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/gif": "GIF",
    "image/webp": "WEBP",
  };

  const getAllowedFileTypesLabel = () =>
    allowedMimeTypes.map((t) => mimeTypeLabels[t] || t).join(", ");

  const fetchErrorCount = useCallback(async () => {
    try {
      const res = await fetch("/api/errormonitoring/count");

      if (!res.ok) throw new Error("Failed to fetch error count");

      const json = await res.json();

      setErrorCount(json.total ?? 0);
    } catch (err) {
      console.error("Error fetching error count:", err);
    }
  }, []);

  const fetchDocumentCount = useCallback(async () => {
    try {
      const res = await fetch("/api/document/count");

      if (!res.ok) throw new Error("Failed to fetch document count");

      const json = await res.json();

      setDocumentCount(json.total ?? 0);
    } catch (err) {
      console.error("Document count fetch error:", err);
    }
  }, []);

  useRealtimeTest(true, {
    // RENT ROLL → TENANT VIEW READY
    onTenantReady: () => {
      fetchDocumentCount();
      window.dispatchEvent(new Event("document-list-updated"));
    },

    // OM / SITE PLAN / BROCHURE → REVIEW PAGE
    onReviewReady: () => {
      fetchErrorCount();
    },

    // FAILED → ERROR LIST
    onExtractionFailed: () => {
      fetchErrorCount();
    },
  });

  useEffect(() => {
    const savedTab = sessionStorage.getItem("documentsTab");

    if (savedTab) {
      setActiveTab(savedTab);
    }
    fetchErrorCount();
    fetchDocumentCount();
  }, [fetchDocumentCount, fetchErrorCount]);

  useEffect(() => {
    const handler = () => {
      fetchDocumentCount();
    };

    window.addEventListener("document-list-updated", handler);

    return () => {
      window.removeEventListener("document-list-updated", handler);
    };
  }, [fetchDocumentCount]);

  // ------------------------------
  // FILE HANDLING
  // ------------------------------
  function addFiles(selected: File[]) {
    const validFiles: File[] = [];

    selected.forEach((file) => {
      if (!allowedMimeTypes.includes(file.type)) {
        toast.warning("File type not allowed", {
          description: `${file.name} is not supported. Allowed types: ${getAllowedFileTypesLabel()}`,
        });
        return;
      }

      validFiles.push(file);
    });

    if (!validFiles.length) return;

    const total = [...files, ...validFiles];

    if (total.length > maxFiles) {
      toast.warning(`Max ${maxFiles} files allowed`);
      setFiles(total.slice(0, maxFiles));
      return;
    }

    setFiles(total);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;

    addFiles(Array.from(e.target.files));

    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();

    addFiles(Array.from(e.dataTransfer.files));
  }

  function removeFile(name: string) {
    setFiles(files.filter((f) => f.name !== name));
  }

  // ------------------------------
  // PRECHECK FUNCTION
  // ------------------------------
  async function runPrecheck(): Promise<boolean> {
    const fileNames = files.map((file) => file.name);

    try {
      const res = await fetch("/api/upload/precheck", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file_names: fileNames,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        const failedFiles = json.failed_files || [];

        if (failedFiles.length > 0) {
          const failedList = failedFiles
            .map((f: any, index: number) => `${index + 1}. ${f.file_name}`)
            .join("\n");

          toast.error(
            `Upload blocked. ${failedFiles.length} file(s) are still in the Error Document List. Delete it first before uploading`,
            {
              description: (
                <div className="max-h-40 overflow-y-auto whitespace-pre-line text-sm">
                  {failedList}
                </div>
              ),
              duration: 12000,
            },
          );
        } else {
          toast.error("Upload blocked", {
            description: json.message || "Unknown precheck error",
          });
        }

        return false;
      }

      return true;
    } catch (error: any) {
      toast.error("Precheck failed", {
        description: error.message,
      });

      return false;
    }
  }

  // ------------------------------
  // UPLOAD FUNCTION
  // ------------------------------
  async function handleUpload() {
    if (!session) {
      toast.error("You must be logged in.");
      return;
    }

    if (!files.length) {
      toast.warning("No files selected.");
      return;
    }

    if (!docType) {
      toast.error("Please select document type.");
      return;
    }

    setUploading(true);

    try {
      // STEP 1: PRECHECK ALL FILES
      const passed = await runPrecheck();
      console.log(passed);
      if (!passed) {
        setUploading(false);
        console.log("This is running");
        return;
      }

      const toastId = toast.loading(`Uploading 0 of ${files.length} files...`);

      // STEP 2: UPLOAD FILES
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        toast.message(`Preparing ${file.name} (${i + 1}/${files.length})`, {
          id: toastId,
        });

        // Get signed URL
        const signedUrlRes = await fetch("/api/upload/document", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            file_name: file.name,
            content_type: file.type,
            file_size: file.size,
            document_type: docType,
          }),
        });

        const signedUrlJson = await signedUrlRes.json();

        if (!signedUrlRes.ok || !signedUrlJson.success) {
          throw new Error(
            signedUrlJson.message || `Failed to prepare ${file.name}`,
          );
        }

        const { signed_url } = signedUrlJson;

        toast.message(`Uploading ${file.name} (${i + 1}/${files.length})`, {
          id: toastId,
        });

        // Upload to GCS
        const uploadRes = await fetch(signed_url, {
          method: "PUT",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
          body: file,
        });

        if (!uploadRes.ok) {
          const errorText = await uploadRes.text();

          throw new Error(`Upload failed: ${file.name}\n${errorText}`);
        }
      }

      toast.dismiss();

      toast.success("All files uploaded successfully.");

      setFiles([]);

      // notify document list to refresh
      window.dispatchEvent(new Event("document-list-updated"));
    } catch (error: any) {
      toast.dismiss();

      toast.error("Upload failed", {
        description: error.message,
      });
    } finally {
      setUploading(false);
    }
  }

  // ------------------------------
  // UI
  // ------------------------------
  return (
    <div className="w-11/12 mx-auto mt-6 space-y-6">
      {/* HEADER */}
      <div>
        <div className="flex items-center gap-2">
          <FileText className="w-6 h-6 text-gray-700" />

          <h2 className="text-xl font-semibold text-gray-800">
            Document Management
          </h2>
        </div>

        <p className="text-sm text-gray-500">
          Upload, Search and Filter Documents.
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value);
          sessionStorage.setItem("documentsTab", value);

          if (value === "errorList") {
            fetchErrorCount();
          }
        }}
        className="w-full"
      >
        <TabsList className="mb-6">
          <TabsTrigger value="upload">Upload Document</TabsTrigger>

          <TabsTrigger value="list">
            Document List
            {documentCount > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-blue-600 text-white rounded-full">
                {documentCount}
              </span>
            )}
          </TabsTrigger>

          <TabsTrigger value="errorList">
            Error Document List
            {errorCount > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-red-500 text-white rounded-full">
                {errorCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <div className="space-y-6">
            {!session && (
              <p className="text-red-500 text-sm">
                You must be logged in to upload documents.
              </p>
            )}

            {/* Document Type */}
            <div>
              <label className="text-sm font-medium text-gray-700 mr-3">
                Document Type <span className="text-red-500">*</span>
              </label>

              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-100 mt-1 p-2 border rounded-md"
                disabled={!session?.user || reachedLimit}
              >
                <option value="">Select Document Type</option>

                {documentTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Dropzone */}
            <div
              onDrop={!docType || reachedLimit ? undefined : handleDrop}
              onDragOver={(e) => docType && !reachedLimit && e.preventDefault()}
              className={`border-2 border-dashed rounded-lg py-10 px-6 text-center
              ${
                !docType || reachedLimit
                  ? "opacity-50 border-gray-300 cursor-not-allowed"
                  : "cursor-pointer hover:border-blue-400 border-gray-300"
              }`}
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
                disabled={!session?.user || reachedLimit || !docType}
              />

              <Button
                asChild
                disabled={!session?.user || reachedLimit || !docType}
                className="mt-4 bg-blue-700 hover:bg-blue-400"
              >
                <label
                  htmlFor="fileUpload"
                  className="flex gap-2 cursor-pointer"
                >
                  <Paperclip />
                  Choose Files
                </label>
              </Button>
            </div>

            {/* File list */}
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

            {/* Upload button */}
            {files.length > 0 && (
              <div className="flex justify-end">
                <Button onClick={handleUpload} disabled={uploading || !docType}>
                  <CloudUpload className="mr-2" />
                  {uploading ? "Uploading..." : "Upload"}
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="list">
          <DocumentListTab />
        </TabsContent>

        <TabsContent value="errorList">
          <ErrorMonitoringTable onDeleteSuccess={fetchErrorCount} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
