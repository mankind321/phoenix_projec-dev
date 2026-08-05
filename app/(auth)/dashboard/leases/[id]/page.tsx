/* eslint-disable react-hooks/exhaustive-deps */
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
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  const [leaseSchedules, setLeaseSchedules] = useState<any[]>([]);

  const [leaseScheduleChanges, setLeaseScheduleChanges] = useState({
    added: [] as any[],
    updated: [] as any[],
    deleted: [] as any[],
  });

  const [showAddLeaseDialog, setShowAddLeaseDialog] = useState(false);

  const [showEditLeaseDialog, setShowEditLeaseDialog] = useState(false);

  const [editingLeaseDate, setEditingLeaseDate] = useState<any>(null);

  const [leaseDateForm, setLeaseDateForm] = useState({
    start_date: "",
    end_date: "",
    rent_psf: "",
  });

  const [showDeleteLeaseDialog, setShowDeleteLeaseDialog] = useState(false);

  const [leaseScheduleToDelete, setLeaseScheduleToDelete] = useState<any>(null);

  const [originalLeaseSchedules, setOriginalLeaseSchedules] = useState<any[]>(
    [],
  );
  const pendingLeaseDateChanges =
    leaseScheduleChanges.added.length +
    leaseScheduleChanges.updated.length +
    leaseScheduleChanges.deleted.length;

  // ---------------- LOAD LEASE ----------------
  useEffect(() => {
    if (!leaseId) return;

    const fetchLease = async () => {
      try {
        const leaseRes = await fetch(`/api/lease/${leaseId}`);

        const leaseJson = await leaseRes.json();
        setData(leaseJson.data);

        await loadLeaseSchedule();
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

    setLeaseSchedules(originalLeaseSchedules.map((x: any) => ({ ...x })));

    setLeaseScheduleChanges({
      added: [],
      updated: [],
      deleted: [],
    });

    setShowAddLeaseDialog(false);
    setShowEditLeaseDialog(false);
    setShowDeleteLeaseDialog(false);

    setEditingLeaseDate(null);
    setLeaseScheduleToDelete(null);

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

  const handleDeleteLeaseDate = () => {
    if (!leaseScheduleToDelete) return;

    const isNew = String(leaseScheduleToDelete.rent_schedule_id).startsWith(
      "new-",
    );

    // Remove from the table
    setLeaseSchedules((prev) =>
      prev.filter(
        (item) =>
          item.rent_schedule_id !== leaseScheduleToDelete.rent_schedule_id,
      ),
    );

    if (isNew) {
      // Remove from pending added list
      setLeaseScheduleChanges((prev) => ({
        ...prev,
        added: prev.added.filter(
          (item) =>
            item.rent_schedule_id !== leaseScheduleToDelete.rent_schedule_id,
        ),
      }));
    } else {
      setLeaseScheduleChanges((prev) => ({
        ...prev,

        // Remove from updated list if it was edited before deleting
        updated: prev.updated.filter(
          (item) =>
            item.rent_schedule_id !== leaseScheduleToDelete.rent_schedule_id,
        ),

        // Add to deleted list (avoid duplicates)
        deleted: [
          ...prev.deleted.filter(
            (item) =>
              item.rent_schedule_id !== leaseScheduleToDelete.rent_schedule_id,
          ),
          leaseScheduleToDelete,
        ],
      }));
    }

    toast.success("Lease schedule marked for deletion.");

    setLeaseScheduleToDelete(null);
    setShowDeleteLeaseDialog(false);
  };
  const handleSave = async () => {
    if (saving) return;

    try {
      setSaving(true);

      const dirtyPayload = buildDirtyPayload(data!.lease, draftLease);

      // Normalize comments
      const normalizedDraftComments = normalizeNullableText(
        draftLease.comments,
      );
      const normalizedOriginalComments = normalizeNullableText(
        data!.lease.comments,
      );

      if (normalizedDraftComments !== normalizedOriginalComments) {
        dirtyPayload.comments = normalizedDraftComments;
      }

      // Normalize numeric fields
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

      const hasLeaseChanges = Object.keys(dirtyPayload).length > 0;

      const hasScheduleChanges =
        leaseScheduleChanges.added.length > 0 ||
        leaseScheduleChanges.updated.length > 0 ||
        leaseScheduleChanges.deleted.length > 0;

      if (!hasLeaseChanges && !hasScheduleChanges) {
        toast.info("No changes to save");
        return;
      }

      // ---------------------------------------------------
      // SAVE LEASE
      // ---------------------------------------------------
      if (hasLeaseChanges) {
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
          prev
            ? {
                ...prev,
                lease: {
                  ...prev.lease,
                  ...dirtyPayload,
                },
              }
            : prev,
        );
      }

      // ---------------------------------------------------
      // ADD LEASE SCHEDULES
      // ---------------------------------------------------
      for (const item of leaseScheduleChanges.added) {
        const res = await fetch(`/api/lease/${leaseId}/schedule`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            start_date: item.start_date,
            end_date: item.end_date,
            rent_psf: item.rent_psf,
          }),
        });

        const json = await res.json();

        if (!res.ok || !json.success) {
          toast.error(json.message ?? "Unable to add lease schedule.");
          return;
        }
      }

      // ---------------------------------------------------
      // UPDATE LEASE SCHEDULES
      // ---------------------------------------------------
      for (const item of leaseScheduleChanges.updated) {
        const res = await fetch(
          `/api/lease/${leaseId}/schedule/${item.rent_schedule_id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              start_date: item.start_date,
              end_date: item.end_date,
              rent_psf: item.rent_psf,
            }),
          },
        );

        const json = await res.json();

        if (!res.ok || !json.success) {
          toast.error(json.message ?? "Unable to update lease schedule.");
          return;
        }
      }

      // ---------------------------------------------------
      // DELETE LEASE SCHEDULES
      // ---------------------------------------------------
      for (const item of leaseScheduleChanges.deleted) {
        const res = await fetch(
          `/api/lease/${leaseId}/schedule/${item.rent_schedule_id}`,
          {
            method: "DELETE",
          },
        );

        const json = await res.json();

        if (!res.ok || !json.success) {
          toast.error(json.message ?? "Unable to delete lease schedule.");
          return;
        }
      }

      // ---------------------------------------------------
      // RESET
      // ---------------------------------------------------
      setLeaseScheduleChanges({
        added: [],
        updated: [],
        deleted: [],
      });

      await loadLeaseSchedule();

      setShowAddLeaseDialog(false);
      setShowEditLeaseDialog(false);
      setShowDeleteLeaseDialog(false);

      setEditingLeaseDate(null);
      setLeaseScheduleToDelete(null);

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

  const handleAddLeaseDate = () => {
    if (!leaseDateForm.start_date) {
      toast.error("Start Date is required.");
      return;
    }

    if (!leaseDateForm.rent_psf) {
      toast.error("Rent PSF is required.");
      return;
    }

    const newSchedule = {
      rent_schedule_id: `new-${Date.now()}`,
      start_date: leaseDateForm.start_date,
      end_date: leaseDateForm.end_date || null,
      rent_psf: Number(leaseDateForm.rent_psf),
      __state: "added",
    };

    // Show immediately in the table
    setLeaseSchedules((prev) => [...prev, newSchedule]);

    // Track pending add
    setLeaseScheduleChanges((prev) => ({
      ...prev,
      added: [...prev.added, newSchedule],
    }));

    toast.success("Lease schedule added. Click Save to apply changes.");

    setLeaseDateForm({
      start_date: "",
      end_date: "",
      rent_psf: "",
    });

    setShowAddLeaseDialog(false);
  };

  const handleUpdateLeaseDate = () => {
    if (!editingLeaseDate) return;

    if (!leaseDateForm.start_date) {
      toast.error("Start Date is required.");
      return;
    }

    if (!leaseDateForm.rent_psf) {
      toast.error("Rent PSF is required.");
      return;
    }

    const updatedSchedule = {
      ...editingLeaseDate,
      start_date: leaseDateForm.start_date,
      end_date: leaseDateForm.end_date || null,
      rent_psf: Number(leaseDateForm.rent_psf),
    };

    // Update table immediately
    setLeaseSchedules((prev) =>
      prev.map((item) =>
        item.rent_schedule_id === updatedSchedule.rent_schedule_id
          ? updatedSchedule
          : item,
      ),
    );

    // If it's a newly-added row, update it in the "added" list only
    if (String(updatedSchedule.rent_schedule_id).startsWith("new-")) {
      setLeaseScheduleChanges((prev) => ({
        ...prev,
        added: prev.added.map((item) =>
          item.rent_schedule_id === updatedSchedule.rent_schedule_id
            ? updatedSchedule
            : item,
        ),
      }));
    } else {
      // Existing DB record → mark as updated
      setLeaseScheduleChanges((prev) => ({
        ...prev,
        updated: [
          ...prev.updated.filter(
            (item) =>
              item.rent_schedule_id !== updatedSchedule.rent_schedule_id,
          ),
          updatedSchedule,
        ],
      }));
    }

    toast.success("Lease schedule updated. Click Save to apply changes.");

    setLeaseDateForm({
      start_date: "",
      end_date: "",
      rent_psf: "",
    });

    setEditingLeaseDate(null);
    setShowEditLeaseDialog(false);
  };

  const loadLeaseSchedule = async () => {
    try {
      const res = await fetch(`/api/lease/${leaseId}/schedule`);
      const json = await res.json();

      if (json.success) {
        const schedules = (json.items ?? []).map((x: any) => ({
          ...x,
        }));

        setLeaseSchedules(schedules);

        setOriginalLeaseSchedules(schedules.map((x: any) => ({ ...x })));
      }
    } catch (err) {
      console.error("Failed to load lease schedule", err);
    }
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
                disabled={
                  saving ||
                  (Object.keys(buildDirtyPayload(data!.lease, draftLease))
                    .length === 0 &&
                    pendingLeaseDateChanges === 0)
                }
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

          <InfoItem
            label="Size (Square Feet/SF)"
            type="number"
            value={isEditing ? draftLease.size : (getLeaseSize(lease) ?? "—")}
            editable={isEditing}
            onChange={(v) => setDraftLease({ ...draftLease, size: v })}
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
          {/* ✅ NEW: View Property Button as InfoItem */}
          {!isEditing && lease?.property_id && (
            <div className="space-y-1">
              <Button
                variant="outline"
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white hover:text-white"
                onClick={() =>
                  router.push(`/dashboard/properties/${lease.property_id}`)
                }
              >
                <Info className="w-4 h-4" />
                View Property Information
              </Button>
            </div>
          )}
        </Grid2>
      </InfoSection>

      {/* DATES */}
      <InfoSection
        icon={<CalendarDays />}
        title={
          <div className="flex items-center gap-2">
            <span>Lease Dates</span>

            {!isEditing && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 cursor-pointer text-blue-500 hover:text-blue-700" />
                  </TooltipTrigger>

                  <TooltipContent>
                    <p>Click Update to manage lease dates.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {isEditing && pendingLeaseDateChanges > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">
                {pendingLeaseDateChanges} Pending Change
                {pendingLeaseDateChanges > 1 ? "s" : ""}
              </span>
            )}
          </div>
        }
      >
        <div className="flex justify-end mb-6">
          {isEditing && (
            <div className="flex justify-end mb-6">
              <Button
                className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
                onClick={() => {
                  setLeaseDateForm({
                    start_date: "",
                    end_date: "",
                    rent_psf: "",
                  });

                  setShowAddLeaseDialog(true);
                }}
              >
                <Plus className="w-4 h-4" />
                Add Lease Dates
              </Button>
            </div>
          )}
        </div>
        <Table containerClassName="max-h-[350px] border rounded-lg">
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">#</TableHead>

              <TableHead>Start Date</TableHead>

              <TableHead>End Date</TableHead>

              <TableHead>Rent PSF</TableHead>

              {isEditing && <TableHead>Status</TableHead>}

              {isEditing && (
                <TableHead className="text-center w-48">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>

          <TableBody>
            {leaseSchedules.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={isEditing ? 6 : 4}
                  className="text-center py-8 text-gray-500"
                >
                  No lease dates found.
                </TableCell>
              </TableRow>
            ) : (
              leaseSchedules.map((item, index) => {
                const isAdded = leaseScheduleChanges.added.some(
                  (x) => x.rent_schedule_id === item.rent_schedule_id,
                );

                const isUpdated = leaseScheduleChanges.updated.some(
                  (x) => x.rent_schedule_id === item.rent_schedule_id,
                );

                return (
                  <TableRow
                    key={item.rent_schedule_id}
                    className={
                      isAdded ? "bg-green-50" : isUpdated ? "bg-yellow-50" : ""
                    }
                  >
                    <TableCell>{index + 1}</TableCell>

                    <TableCell>
                      {new Date(item.start_date).toLocaleDateString()}
                    </TableCell>

                    <TableCell>
                      {item.end_date
                        ? new Date(item.end_date).toLocaleDateString()
                        : "—"}
                    </TableCell>

                    <TableCell>
                      {item.rent_psf
                        ? `$${Number(item.rent_psf).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                        : "—"}
                    </TableCell>

                    {isEditing && (
                      <TableCell>
                        {isAdded ? (
                          <span className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                            Added
                          </span>
                        ) : isUpdated ? (
                          <span className="rounded bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700">
                            Modified
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    )}

                    {isEditing && (
                      <TableCell>
                        <div className="flex justify-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!isEditing}
                            className="disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => {
                              if (!isEditing) return;

                              setEditingLeaseDate(item);

                              setLeaseDateForm({
                                start_date:
                                  item.start_date?.substring(0, 10) ?? "",
                                end_date: item.end_date?.substring(0, 10) ?? "",
                                rent_psf: item.rent_psf?.toString() ?? "",
                              });

                              setShowEditLeaseDialog(true);
                            }}
                          >
                            <Pencil className="w-4 h-4 mr-1" />
                            Edit
                          </Button>

                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={!isEditing}
                            className="disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => {
                              if (!isEditing) return;

                              setLeaseScheduleToDelete(item);
                              setShowDeleteLeaseDialog(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
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
              isEditing
                ? draftLease.annual_rent
                : (() => {
                    const annual = getLeaseAnnualRent(lease);
                    return annual ? formatUSD(annual) : "—";
                  })()
            }
            editable={isEditing}
            onChange={(v) => setDraftLease({ ...draftLease, annual_rent: v })}
          />

          <InfoItem
            label="Current Monthly Rent"
            value={(() => {
              const monthly = getLeaseMonthlyRent(
                isEditing ? draftLease : lease,
              );

              return monthly ? formatUSD(monthly) : "—";
            })()}
          />

          <InfoItem
            label="Base Rent PSF"
            type="number"
            value={
              isEditing
                ? draftLease.rent_psf
                : (() => {
                    const psf = getLeaseRentPsf(lease);

                    return psf
                      ? `$${psf.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`
                      : "—";
                  })()
            }
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

      <Dialog
        open={showAddLeaseDialog || showEditLeaseDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddLeaseDialog(false);
            setShowEditLeaseDialog(false);
            setEditingLeaseDate(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingLeaseDate ? (
                <>
                  <Pencil className="w-5 h-5 text-blue-600" />
                  Edit Lease Dates
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5 text-green-600" />
                  Add Lease Dates
                </>
              )}
            </DialogTitle>

            <DialogDescription>
              {editingLeaseDate
                ? "Update the lease schedule."
                : "Add a lease period and its Rent PSF."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <InfoItem
              label="Start Date"
              type="date"
              editable
              value={leaseDateForm.start_date}
              onChange={(v) =>
                setLeaseDateForm({
                  ...leaseDateForm,
                  start_date: v,
                })
              }
            />

            <InfoItem
              label="End Date"
              type="date"
              editable
              value={leaseDateForm.end_date}
              onChange={(v) =>
                setLeaseDateForm({
                  ...leaseDateForm,
                  end_date: v,
                })
              }
            />

            <InfoItem
              label="Rent PSF"
              type="number"
              editable
              value={leaseDateForm.rent_psf}
              onChange={(v) =>
                setLeaseDateForm({
                  ...leaseDateForm,
                  rent_psf: v,
                })
              }
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddLeaseDialog(false);
                setShowEditLeaseDialog(false);
                setEditingLeaseDate(null);

                setLeaseDateForm({
                  start_date: "",
                  end_date: "",
                  rent_psf: "",
                });
              }}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Cancel
            </Button>

            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={
                editingLeaseDate ? handleUpdateLeaseDate : handleAddLeaseDate
              }
            >
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showDeleteLeaseDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowDeleteLeaseDialog(false);
            setLeaseScheduleToDelete(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Delete Lease Schedule
            </DialogTitle>

            <DialogDescription>
              Are you sure you want to delete this lease schedule?
              <br />
              <br />
              <span className="font-medium">
                {leaseScheduleToDelete?.start_date &&
                  new Date(
                    leaseScheduleToDelete.start_date,
                  ).toLocaleDateString()}
              </span>{" "}
              to{" "}
              <span className="font-medium">
                {leaseScheduleToDelete?.end_date
                  ? new Date(
                      leaseScheduleToDelete.end_date,
                    ).toLocaleDateString()
                  : "Open Ended"}
              </span>
              <br />
              <br />
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteLeaseDialog(false);
                setLeaseScheduleToDelete(null);
              }}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Cancel
            </Button>

            <Button variant="destructive" onClick={handleDeleteLeaseDate}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- SHARED COMPONENTS ---------- */

function InfoSection({
  title,
  icon,
  children,
}: {
  title: React.ReactNode;
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
          value={
            typeof value === "number" && Number.isNaN(value)
              ? ""
              : (value ?? "")
          }
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

  const numericFields = [
    "price",
    "annual_rent",
    "rent_psf",
    "pass_tmru",
    "noi",
    "size",
  ];

  Object.keys(draft).forEach((key) => {
    if (numericFields.includes(key)) {
      if (Number(original[key] ?? 0) !== Number(draft[key] ?? 0)) {
        payload[key] = draft[key];
      }

      return;
    }

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

function getLeaseSize(lease: any): number | null {
  const size = Math.round(Number(lease.size));

  if (size > 0) {
    return size;
  }

  const rentPsf = Number(lease.rent_psf);

  if (rentPsf <= 0) {
    return null;
  }

  const annualRent = Number(lease.annual_rent);

  if (annualRent > 0) {
    return Math.round(annualRent / rentPsf);
  }

  const monthlyRent = Number(lease.monthly_rent);

  if (monthlyRent > 0) {
    return Math.round((monthlyRent * 12) / rentPsf);
  }

  return null;
}

function getLeaseRentPsf(lease: any): number | null {
  const rentPsf = Number(lease.rent_psf);

  if (rentPsf > 0) {
    return rentPsf;
  }

  const size = getLeaseSize(lease);

  if (!size || size <= 0) {
    return null;
  }

  const annualRent = Number(lease.annual_rent);

  if (annualRent > 0) {
    return annualRent / size;
  }

  const monthlyRent = Number(lease.monthly_rent);

  if (monthlyRent > 0) {
    return (monthlyRent * 12) / size;
  }

  return null;
}

function getLeaseAnnualRent(lease: any): number | null {
  const annualRent = Number(lease.annual_rent);

  if (annualRent > 0) {
    return annualRent;
  }

  const monthlyRent = Number(lease.monthly_rent);

  if (monthlyRent > 0) {
    return monthlyRent * 12;
  }

  const size = getLeaseSize(lease);
  const rentPsf = getLeaseRentPsf(lease);

  if (size && rentPsf) {
    return size * rentPsf;
  }

  return null;
}

function getLeaseMonthlyRent(lease: any): number | null {
  const monthlyRent = Number(lease.monthly_rent);

  if (monthlyRent > 0) {
    return monthlyRent;
  }

  const annualRent = getLeaseAnnualRent(lease);

  if (annualRent) {
    return annualRent / 12;
  }

  return null;
}
