/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ClipboardList,
  DollarSign,
  FileText,
  User,
  Users,
  Download,
  Pencil,
  Save,
  XCircle,
  Info,
} from "lucide-react";
import { toast } from "sonner";

interface LeaseData {
  lease: any;
  contacts: any[];
}

export default function LeaseViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id: leaseId } = React.use(params);

  const [data, setData] = useState<LeaseData | null>(null);
  const [loading, setLoading] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [draftLease, setDraftLease] = useState<any>(null);

  // PROPERTY LIST
  const [properties, setProperties] = useState<any[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);

  const [saving, setSaving] = useState(false);

  const [downloadingFile, setDownloadingFile] = useState(false);

  // ---------------- LOAD LEASE ----------------
  useEffect(() => {
    if (!leaseId) return;

    const fetchLease = async () => {
      try {
        const res = await fetch(`/api/lease/${leaseId}`);
        const json = await res.json();
        setData(json.data);
      } catch (error) {
        console.error("Error loading lease:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLease();
  }, [leaseId]);

  useEffect(() => {
    if (data?.lease) {
      setDraftLease({ ...data.lease });
    }
  }, [data]);

  // ---------------- LOAD PROPERTIES (EDIT MODE) ----------------
  useEffect(() => {
    if (!isEditing) return;

    const loadProperties = async () => {
      setLoadingProperties(true);
      try {
        const res = await fetch("/api/properties/list-2");
        const json = await res.json();
        if (json?.success) {
          setProperties(json.items || []);
        }
      } catch (err) {
        console.error("Failed to load properties", err);
      } finally {
        setLoadingProperties(false);
      }
    };

    loadProperties();
  }, [isEditing]);

  // ---------------- ACTIONS ----------------
  const handleEdit = () => {
    setDraftLease({ ...data?.lease });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setDraftLease({ ...data?.lease });
    setIsEditing(false);
  };

  const handleDownloadLeaseFile = async () => {
    if (!lease?.file_url) {
      toast.error("No file available.");
      return;
    }

    try {
      setDownloadingFile(true);

      const downloadUrl = `/api/gcp/download?path=${encodeURIComponent(
        lease.file_url,
      )}`;

      // Check file existence first
      const res = await fetch(downloadUrl, {
        method: "HEAD",
      });

      if (!res.ok) {
        if (res.status === 404) {
          toast.error("File not found.");
        } else if (res.status === 401) {
          toast.error("Unauthorized access.");
        } else {
          toast.error("File is not available.");
        }
        return;
      }

      // File exists → download
      window.open(downloadUrl, "_blank");

      toast.success("Download started.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to download file.");
    } finally {
      setDownloadingFile(false);
    }
  };

  const handleSave = async () => {
    if (saving) return;

    try {
      setSaving(true);

      const dirtyPayload = buildDirtyPayload(data!.lease, draftLease);

      // ✅ normalize comments
      const normalizedDraftComments = normalizeNullableText(
        draftLease.comments,
      );
      const normalizedOriginalComments = normalizeNullableText(
        data!.lease.comments,
      );

      if (normalizedDraftComments !== normalizedOriginalComments) {
        dirtyPayload.comments = normalizedDraftComments;
      }

      // ✅ normalize numeric fields
      const numericFields = [
        "price",
        "annual_rent",
        "rent_psf",
        "pass_tmru",
        "noi",
      ];

      numericFields.forEach((field) => {
        if (field in dirtyPayload) {
          const value = dirtyPayload[field];
          dirtyPayload[field] =
            value === "" || value === null || value === undefined
              ? null
              : Number(value);
        }
      });

      if (Object.keys(dirtyPayload).length === 0) {
        toast.info("No changes to save");
        return;
      }

      const res = await fetch(`/api/lease/${leaseId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dirtyPayload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(json.message || "Failed to update lease");
        return;
      }

      setData((prev) =>
        prev ? { ...prev, lease: { ...prev.lease, ...dirtyPayload } } : prev,
      );

      setIsEditing(false);
      toast.success("Lease updated successfully");
    } catch (err) {
      console.error("PUT failed", err);
      toast.error("Unexpected error while saving");
    } finally {
      setSaving(false);
    }
  };

  const handlePropertyChange = (propertyId: string) => {
    const selected = properties.find((p) => p.id === propertyId);
    if (!selected) return;

    setDraftLease({
      ...draftLease,
      property_id: selected.id, // ✅ REQUIRED
      property_name: selected.property_name,
      property_type: selected.property_type,
      property_address: selected.property_address,
      property_landlord: selected.property_landlord,
    });
  };

  // ---------------- GUARDS ----------------
  if (loading)
    return (
      <p className="text-center mt-10 text-gray-600">
        Loading Tenant Information..
      </p>
    );

  if (!data)
    return (
      <p className="text-center mt-10 text-red-500">
        Tenant Information not found or has been removed.
      </p>
    );

  if (!draftLease)
    return (
      <p className="text-center mt-10 text-gray-600">
        Preparing Lease Information data…
      </p>
    );

  const { lease, contacts } = data;

  return (
    <div className="w-11/12 mx-auto mt-10 space-y-10">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-3xl font-semibold text-gray-900 flex items-center gap-2">
          <FileText className="w-7 h-7 text-blue-600" />
          Tenant Lease Information
        </h1>

        <div className="flex items-center gap-3">
          {!isEditing ? (
            <Button
              onClick={handleEdit}
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 px-4"
            >
              <Pencil className="w-4 h-4" />
              Update
            </Button>
          ) : (
            <>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button
                onClick={handleCancel}
                className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 px-4"
              >
                <XCircle className="w-4 h-4" />
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {/* BASIC */}
      <InfoSection icon={<User />} title="Basic Information">
        <Grid2>
          <InfoItem
            label="Tenant"
            value={isEditing ? draftLease.tenant : lease.tenant}
            editable={isEditing}
            onChange={(v) => setDraftLease({ ...draftLease, tenant: v })}
          />
          <InfoItem
            label="Landlord"
            value={isEditing ? draftLease.landlord : lease.landlord}
            editable={isEditing}
            onChange={(v) => setDraftLease({ ...draftLease, landlord: v })}
          />
          <InfoItem
            label="Unit"
            value={isEditing ? draftLease.suite_unit : lease.suite_unit}
            editable={isEditing}
            onChange={(v) => setDraftLease({ ...draftLease, suite_unit: v })}
          />
          {/* STATUS */}
          <div className="space-y-1">
            <Label className="text-gray-700 font-medium">Status</Label>

            {isEditing ? (
              <select
                value={draftLease.status || ""}
                onChange={(e) =>
                  setDraftLease({ ...draftLease, status: e.target.value })
                }
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                <option value="">Select Status</option>
                <option value="Available">Available</option>
                <option value="Occupied">Occupied</option>
                <option value="Expired">Expired</option>
              </select>
            ) : (
              <p className="border rounded-md bg-gray-50 px-3 py-2 text-sm">
                {lease.status || "—"}
              </p>
            )}
          </div>
        </Grid2>
      </InfoSection>

      {/* PROPERTY */}
      <InfoSection icon={<Building2 />} title="Property Details">
        <Grid2>
          <div className="space-y-1">
            <Label className="text-gray-700 font-medium">Property Name</Label>

            {isEditing ? (
              <select
                value={
                  properties.find(
                    (p) => p.property_name === draftLease.property_name,
                  )?.id || ""
                }
                onChange={(e) => handlePropertyChange(e.target.value)}
                disabled={loadingProperties}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                <option value="">Select Property</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.property_name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="border rounded-md bg-gray-50 px-3 py-2 text-sm">
                {lease.property_name || "—"}
              </p>
            )}
          </div>

          <InfoItem label="Property Type" value={draftLease.property_type} />
          <InfoItem
            label="Property Address"
            value={draftLease.property_address}
          />
          <InfoItem
            label="Property Landlord"
            value={draftLease.property_landlord}
          />
        </Grid2>
      </InfoSection>

      {/* DATES */}
      <InfoSection icon={<CalendarDays />} title="Lease Dates">
        <Grid2>
          <InfoItem
            label="Start Date"
            type="date"
            value={isEditing ? draftLease.lease_start : lease.lease_start}
            editable={isEditing}
            onChange={(v) => setDraftLease({ ...draftLease, lease_start: v })}
          />
          <InfoItem
            label="End Date"
            type="date"
            value={isEditing ? draftLease.lease_end : lease.lease_end}
            editable={isEditing}
            onChange={(v) => setDraftLease({ ...draftLease, lease_end: v })}
          />
          <InfoItem
            label="Availability Date"
            type="date"
            value={
              isEditing ? draftLease.availability_date : lease.availability_date
            }
            editable={isEditing}
            onChange={(v) =>
              setDraftLease({ ...draftLease, availability_date: v })
            }
          />
        </Grid2>
      </InfoSection>

      {/* FINANCIAL */}
      <InfoSection icon={<DollarSign />} title="Financial Information">
        <Grid2>
          <InfoItem
            label="Price"
            type="number"
            value={isEditing ? draftLease.price : formatUSD(lease.price)}
            editable={isEditing}
            onChange={(v) => setDraftLease({ ...draftLease, price: v })}
          />

          <InfoItem
            label="Current Annual Rent"
            type="number"
            value={
              isEditing ? draftLease.annual_rent : formatUSD(lease.annual_rent)
            }
            editable={isEditing}
            onChange={(v) => setDraftLease({ ...draftLease, annual_rent: v })}
          />

          <InfoItem
            label="Base Rent PSF"
            type="number"
            value={isEditing ? draftLease.rent_psf : formatUSD(lease.rent_psf)}
            editable={isEditing}
            onChange={(v) => setDraftLease({ ...draftLease, rent_psf: v })}
          />

          <InfoItem
            label="Pass-TMRU (NNN) PSF"
            type="number"
            value={
              isEditing ? draftLease.pass_tmru : formatUSD(lease.pass_tmru)
            }
            editable={isEditing}
            onChange={(v) => setDraftLease({ ...draftLease, pass_tmru: v })}
          />

          <InfoItem
            label="Net Operating Income (NOI)"
            type="number"
            value={isEditing ? draftLease.noi : formatUSD(lease.noi)}
            editable={isEditing}
            onChange={(v) => setDraftLease({ ...draftLease, noi: v })}
          />
        </Grid2>
      </InfoSection>

      {/* BROKERS */}
      <InfoSection icon={<Users />} title="Brokers">
        {contacts.length === 0 ? (
          <p className="text-gray-500">No Brokers assigned.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Listing Company</TableHead>
                <TableHead>Broker</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Website</TableHead>
                <TableHead>Comments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((c: any) => (
                <TableRow key={c.contact_assignment_id}>
                  <TableCell>{c.listing_company || "—"}</TableCell>
                  <TableCell>{c.broker_name || "—"}</TableCell>
                  <TableCell>{c.phone || "—"}</TableCell>
                  <TableCell>{c.email || "—"}</TableCell>
                  <TableCell>{c.website || "—"}</TableCell>
                  <TableCell>{c.comments || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </InfoSection>

      <InfoSection icon={<Info />} title="Comments">
        {isEditing ? (
          <textarea
            value={draftLease.comments || ""}
            onChange={(e) =>
              setDraftLease({ ...draftLease, comments: e.target.value })
            }
            className="w-full border rounded-md px-3 py-2 text-sm min-h-[100px]"
          />
        ) : (
          <p className="border rounded-md bg-gray-50 px-4 py-3 text-sm text-gray-700">
            {lease.comments || "No comments available."}
          </p>
        )}
      </InfoSection>

      {/* FILE */}
      <InfoSection icon={<ClipboardList />} title="Attached Files">
        {lease.file_url ? (
          <Button
            onClick={handleDownloadLeaseFile}
            disabled={downloadingFile}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 disabled:bg-gray-400"
          >
            <Download className="w-4 h-4" />
            {downloadingFile ? "Checking..." : "Download File"}
          </Button>
        ) : (
          <p className="text-gray-500">No files uploaded.</p>
        )}
      </InfoSection>

      {/* AUDIT INFO */}
      <InfoSection icon={<User />} title="Audit Information">
        <Grid2>
          <InfoItem label="Uploaded By" value={lease.created_by_name || "—"} />

          <InfoItem
            label="Uploaded At"
            value={
              lease.created_at
                ? new Date(lease.created_at).toLocaleString()
                : "—"
            }
          />

          <InfoItem
            label="Last Updated By"
            value={lease.updated_by_name || "—"}
          />

          <InfoItem
            label="Last Updated At"
            value={
              lease.updated_by_name && lease.updated_at
                ? new Date(lease.updated_at).toLocaleString()
                : "—"
            }
          />
        </Grid2>
      </InfoSection>

      <Button
        variant="outline"
        className="flex items-center gap-2"
        onClick={() => router.back()}
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </Button>
    </div>
  );
}

/* ---------- SHARED COMPONENTS ---------- */

function InfoSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
        <span className="text-blue-600">{icon}</span>
        {title}
      </h3>
      <div className="p-5 border rounded-xl bg-white shadow-sm">{children}</div>
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{children}</div>
  );
}

function InfoItem({
  label,
  value,
  editable,
  onChange,
  type = "text",
  hidden = false,
}: {
  label: string;
  value: any;
  editable?: boolean;
  onChange?: (v: string) => void;
  type?: string;
  hidden?: boolean;
}) {
  return (
    <div className={`space-y-1 ${hidden ? "hidden" : ""}`}>
      <Label className="text-gray-700 font-medium">{label}</Label>

      {editable ? (
        <input
          type={type}
          step={type === "number" ? "0.01" : undefined}
          inputMode={type === "number" ? "decimal" : undefined}
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full border rounded-md px-3 py-2 text-sm"
        />
      ) : (
        <p className="border rounded-md bg-gray-50 px-3 py-2 text-sm">
          {value || "—"}
        </p>
      )}
    </div>
  );
}

function formatUSD(value: any) {
  const num = Number(value);
  if (isNaN(num)) return "—";
  return num.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function buildDirtyPayload(original: any, draft: any) {
  const payload: Record<string, any> = {};

  Object.keys(draft).forEach((key) => {
    if (draft[key] !== original[key]) {
      payload[key] = draft[key];
    }
  });

  return payload;
}

function normalizeNullableText(value: any) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
