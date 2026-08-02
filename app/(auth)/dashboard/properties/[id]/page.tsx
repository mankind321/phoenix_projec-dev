/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { toast } from "sonner";

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
  ClipboardList,
  DollarSign,
  Info,
  MapPinned,
  Users,
  Download,
  View,
  Eye,
  Pencil,
  CircleX,
  Save,
} from "lucide-react";
import { Can } from "@/app/components/can";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Badge } from "@/components/ui/badge";

interface PropertyData {
  property: any;
  leases: {
    active: any[];
    expired: any[];
  };
  documents: {
    file_url: string;
    doc_type: string;
  }[];
  documentFiles: {
    file_url: string;
    doc_type: string;
  };
  contacts: any[]; // NEW
}

export default function PropertyViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id: propertyId } = React.use(params);

  const [data, setData] = useState<PropertyData | null>(null);
  const [loading, setLoading] = useState(true);

  const [downloadingBrochure, setDownloadingBrochure] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const [rentSchedule, setRentSchedule] = useState<any[]>([]);

  const [selectedSchedules, setSelectedSchedules] = useState<
    Record<string, string>
  >({});

  const [leaseCounts, setLeaseCounts] = useState({
    active: 0,
    expired: 0,
  });

  useEffect(() => {
    if (!propertyId) return;

    const fetchLeaseCounts = async () => {
      try {
        const res = await fetch(
          `/api/lease/count-status?property_id=${propertyId}`,
        );
        const json = await res.json();

        if (json.success) {
          setLeaseCounts({
            active: json.data.active ?? 0,
            expired: json.data.expired ?? 0,
          });
        }
      } catch (err) {
        console.error("Failed to load lease counts:", err);
      }
    };

    fetchLeaseCounts();
  }, [propertyId]);

  useEffect(() => {
    if (!propertyId) return;

    const fetchProperty = async () => {
      try {
        const res = await fetch(`/api/properties/${propertyId}`);
        const json = await res.json();

        if (json.success) {
          setData(json.data);

          const defaults: Record<string, string> = {};

          [
            ...(json.data.leases.active ?? []),
            ...(json.data.leases.expired ?? []),
          ].forEach((lease: any) => {
            if (lease.rent_schedules?.length) {
              defaults[lease.lease_id] =
                lease.rent_schedules[0].rent_schedule_id;
            }
          });

          setSelectedSchedules(defaults);

          const p = json.data.property;

          setForm({
            name: p.name,
            type: p.type,
            landlord: p.landlord,
            status: p.status,
            address: p.address,
            city: p.city,
            state: p.state,
            size: p.size, // ✅ ADD
            price: p.price,
            cap_rate: p.cap_rate,
            sale_date: p.sale_date,
            comments: p.comments,
            tenancytype: p.tenancytype,
          });
        } else console.error(json.message);
      } catch (error) {
        console.error("Error loading property:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProperty();
  }, [propertyId]);

  useEffect(() => {
    if (!propertyId) return;

    const fetchRentSchedule = async () => {
      try {
        const res = await fetch(
          `/api/properties/rent-schedule?property_id=${propertyId}`,
        );
        const json = await res.json();

        if (json.success) {
          setRentSchedule(json.items ?? []);
        }
      } catch (err) {
        console.error("Failed to load rent schedule:", err);
      }
    };

    fetchRentSchedule();
  }, [propertyId]);

  function handleChange(field: string, value: any) {
    setForm((prev: any) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function handleSave() {
    try {
      setSaving(true);

      const res = await fetch(`/api/properties/${propertyId}`, {
        method: "PUT", // ✅ MATCH BE
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name ?? null,
          type: form.type ?? null,
          landlord: form.landlord ?? null,
          status: form.status ?? null,
          address: form.address ?? null,
          city: form.city ?? null,
          state: form.state ?? null,
          size: form.size ? Number(form.size) : null, // ✅ ADD
          price: form.price ? Number(form.price) : null,
          cap_rate: form.cap_rate ?? null,
          sale_date: form.sale_date || null,
          comments: form.comments ?? null,
          tenancytype: form.tenancytype ?? null,
        }),
      });

      const json = await res.json();

      if (!json.success) {
        toast.error(json.message || "Update failed");
        return;
      }

      toast.success("Property Information updated successfully");

      // ✅ Use BE response (source of truth)
      setData((prev: any) => ({
        ...prev,
        property: json.data ?? {
          ...prev.property,
          ...form,
        },
      }));

      // ✅ Sync form with DB response
      setForm(json.data ?? form);

      setIsEditing(false);
    } catch (err) {
      console.error(err);
      toast.error("Error saving property");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (!data) return;
    setForm({
      name: data.property.name,
      type: data.property.type,
      landlord: data.property.landlord,
      status: data.property.status,
      address: data.property.address,
      city: data.property.city,
      state: data.property.state,
      size: data.property.size, // ✅ ADD
      price: data.property.price,
      cap_rate: data.property.cap_rate,
      sale_date: data.property.sale_date,
      comments: data.property.comments,
      tenancytype: data.property.tenancytype,
    });
    setIsEditing(false);
  }

  function normalizeGsUrl(url: string) {
    if (!url) return "";

    const bucket = process.env.NEXT_PUBLIC_GCP_BUCKET;

    // gs://bucket/path
    if (url.startsWith("gs://")) {
      return url.replace(`gs://${bucket}/`, "");
    }

    // https://storage.googleapis.com/bucket/path
    if (url.includes("storage.googleapis.com")) {
      const parts = url.split(`/${bucket}/`);
      return parts.length > 1 ? parts[1] : "";
    }

    return url;
  }

  async function handleDownloadBrochure() {
    const fileUrl = data?.documentFiles?.file_url;

    if (!fileUrl) {
      toast.error("Document not found.");
      return;
    }

    try {
      setDownloadingBrochure(true);

      let downloadUrl = "";

      // CASE 1: Direct signed URL
      if (fileUrl.startsWith("https://storage.googleapis.com")) {
        downloadUrl = fileUrl;
      } else {
        // CASE 2: gs:// or relative path
        const clean = normalizeGsUrl(fileUrl);

        if (!clean) {
          toast.error("Invalid file path.");
          return;
        }

        downloadUrl = `/api/gcp/download?path=${encodeURIComponent(clean)}`;
      }

      // 🔎 Validate first (prevents XML error page)
      const headCheck = await fetch(downloadUrl, { method: "HEAD" });

      if (!headCheck.ok) {
        toast.error("Document not found.");
        return;
      }

      // Only open if exists
      window.open(downloadUrl, "_blank");
      toast.success("Download started.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to download file.");
    } finally {
      setDownloadingBrochure(false);
    }
  }

  if (loading)
    return (
      <p className="text-center mt-10 text-gray-600">Loading property...</p>
    );

  if (!data)
    return (
      <p className="text-center mt-10 text-red-500">
        Property Information not found.
      </p>
    );

  const property = data.property;
  const leases = data.leases;
  const documentFiles = data.documentFiles;
  const contacts = data.contacts;

  const mapsQuery =
    property.latitude && property.longitude
      ? `${property.latitude},${property.longitude}`
      : encodeURIComponent(
          `${property.address}, ${property.city}, ${property.state}`,
        );

  const getSelectedSchedule = (lease: any) => {
    if (!lease.rent_schedules?.length) return null;

    return (
      lease.rent_schedules.find(
        (x: any) => x.rent_schedule_id === selectedSchedules[lease.lease_id],
      ) ?? lease.rent_schedules[0]
    );
  };

  return (
    <div className="w-11/12 mx-auto mt-10 space-y-10">
      {/* PAGE TITLE */}
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-3xl font-semibold text-gray-900 flex items-center gap-2">
          <Building2 className="w-7 h-7 text-blue-600" />
          Property Information
        </h1>
        <Can role={["Admin", "Manager"]}>
          {!isEditing ? (
            <Button
              onClick={() => setIsEditing(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Pencil />
              Update
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Save />
                {saving ? "Saving..." : "Save"}
              </Button>

              <Button
                variant="outline"
                onClick={handleCancel}
                className="bg-red-600 text-white hover:bg-red-700 hover:text-white"
              >
                <CircleX /> Cancel
              </Button>
            </div>
          )}
        </Can>
      </div>

      {/* BASIC INFO */}
      <InfoSection icon={<Info />} title="Basic Information">
        <Grid2>
          <InfoItem
            label="Name"
            value={isEditing ? form.name : property.name}
            editable={isEditing}
            onChange={(v) => handleChange("name", v)}
          />

          <InfoItem
            label="Type"
            value={isEditing ? form.type : property.type}
            editable={isEditing}
            onChange={(v) => handleChange("type", v)}
          />

          <InfoItem
            label="Landlord"
            value={isEditing ? form.landlord : property.landlord}
            editable={isEditing}
            onChange={(v) => handleChange("landlord", v)}
          />

          <InfoItem
            label="Status"
            value={isEditing ? form.status : property.status}
            editable={isEditing}
            onChange={(v) => handleChange("status", v)}
          />

          <InfoItem
            label="Tenancy Type"
            value={
              isEditing
                ? form.tenancytype
                : formatTenancyType(property.tenancytype)
            }
            editable={isEditing}
            type="select"
            options={[
              { label: "Single Tenant", value: "SingleTenant" },
              { label: "Multi Tenant", value: "MultiTenant" },
            ]}
            onChange={(v) => handleChange("tenancytype", v)}
          />

          <InfoItem
            label="Property Size (Square Feet/SF)"
            value={
              isEditing
                ? form.size
                : property.size
                  ? `${Math.round(Number(property.size))}`
                  : "—"
            }
            editable={isEditing}
            onChange={(v) => handleChange("size", v)}
          />

          <div>
            <Label className="text-gray-700 font-medium">File</Label>
            {data?.documentFiles?.file_url ? (
              <Button
                onClick={handleDownloadBrochure}
                disabled={
                  !data?.documentFiles?.file_url ||
                  downloadingBrochure ||
                  isEditing // ✅ ADD THIS
                }
                className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 text-lg disabled:bg-gray-400 mt-2"
              >
                <Download className="w-5 h-5" />
                {downloadingBrochure
                  ? "Checking..."
                  : "Download Property Brochure"}
              </Button>
            ) : (
              <p className="text-gray-500">No files uploaded.</p>
            )}
          </div>
        </Grid2>
      </InfoSection>

      {/* LOCATION */}
      <InfoSection icon={<Building2 />} title="Property Location">
        <Grid2>
          <InfoItem
            label="Address"
            value={isEditing ? form.address : property.address}
            editable={isEditing}
            onChange={(v) => handleChange("address", v)}
          />

          <InfoItem
            label="City"
            value={isEditing ? form.city : property.city}
            editable={isEditing}
            onChange={(v) => handleChange("city", v)}
          />

          <InfoItem
            label="State"
            value={isEditing ? form.state : property.state}
            editable={isEditing}
            onChange={(v) => handleChange("state", v)}
          />

          <div className="space-y-1">
            <Label className="text-gray-700 font-medium">Location</Label>
            <a
              href={
                isEditing
                  ? "#"
                  : `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`
              }
              onClick={(e) => {
                if (isEditing) e.preventDefault();
              }}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-white ${
                isEditing
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              <MapPinned className="w-4 h-4" />
              Open in Google Maps
            </a>
          </div>
        </Grid2>
      </InfoSection>

      {/* FINANCIAL */}
      <InfoSection icon={<DollarSign />} title="Financial Details">
        <Grid2>
          <InfoItem
            label="Sale Price"
            value={isEditing ? form.price : formatUSD(property.price)}
            editable={isEditing}
            onChange={(v) => handleChange("price", v)}
          />

          <InfoItem
            label="Cap Rate"
            value={isEditing ? form.cap_rate : property.cap_rate}
            editable={isEditing}
            onChange={(v) =>
              handleChange("cap_rate", v.replace(/[^0-9./%]/g, ""))
            }
          />

          <InfoItem
            label="Sale Date"
            value={isEditing ? form.sale_date : property.sale_date}
            editable={isEditing}
            onChange={(v) => handleChange("sale_date", v)}
          />
        </Grid2>
      </InfoSection>

      {/* LEASES */}
      <InfoSection icon={<Users />} title="Tenant">
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="active" className="flex items-center">
              Leases
              {leaseCounts.active > 0 && (
                <BadgeCount value={leaseCounts.active} />
              )}
            </TabsTrigger>

            <TabsTrigger value="expired" className="flex items-center">
              Expired Leases
              {leaseCounts.expired > 0 && (
                <BadgeCount value={leaseCounts.expired} variant="red" />
              )}
            </TabsTrigger>
          </TabsList>

          {/* ACTIVE */}
          <TabsContent value="active">
            {leases.active.length === 0 ? (
              <p className="text-gray-500">No active leases.</p>
            ) : (
              <div className="max-h-[400px] overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-center">
                        Square Feet/SF
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[260px]">Lease Period</TableHead>
                      <TableHead>PSF</TableHead>
                      <TableHead>Monthly Rent</TableHead>
                      <TableHead>Annual Rent</TableHead>
                      <TableHead className="text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {leases.active.map((lease) => (
                      <TableRow key={lease.lease_id}>
                        <TableCell>{display(lease.tenant)}</TableCell>

                        <TableCell>{display(lease.suite_unit)}</TableCell>
                        <TableCell className="text-right pr-10">
                          {(() => {
                            const size = getLeaseSize(lease);

                            return size !== null ? String(size) : "-";
                          })()}
                        </TableCell>

                        <TableCell>
                          <Badge
                            className={
                              lease.status === "Occupied"
                                ? "bg-green-100 text-green-700 hover:bg-green-100"
                                : lease.status === "Available"
                                  ? "bg-blue-100 text-blue-700 hover:bg-blue-100"
                                  : "bg-red-100 text-red-700 hover:bg-red-100"
                            }
                          >
                            {lease.status}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <Select
                            value={selectedSchedules[lease.lease_id]}
                            onValueChange={(value) => {
                              setSelectedSchedules((prev) => ({
                                ...prev,

                                [lease.lease_id]: value,
                              }));
                            }}
                          >
                            <SelectTrigger className="w-[240px]">
                              <SelectValue />
                            </SelectTrigger>

                            <SelectContent>
                              {lease.rent_schedules?.map((schedule: any) => (
                                <SelectItem
                                  key={schedule.rent_schedule_id}
                                  value={schedule.rent_schedule_id}
                                >
                                  {new Date(
                                    schedule.start_date,
                                  ).toLocaleDateString()}

                                  {" - "}

                                  {schedule.end_date
                                    ? new Date(
                                        schedule.end_date,
                                      ).toLocaleDateString()
                                    : "Open Ended"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>

                        <TableCell>
                          {(() => {
                            const schedule = getSelectedSchedule(lease);

                            const psf =
                              schedule?.rent_psf ?? getLeaseRentPsf(lease);

                            return psf != null
                              ? `$${psf.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}`
                              : "-";
                          })()}
                        </TableCell>

                        <TableCell>
                          {(() => {
                            const schedule = getSelectedSchedule(lease);

                            const size = getLeaseSize(lease);

                            const monthlyRent =
                              schedule && size
                                ? (schedule.rent_psf * size) / 12
                                : getLeaseMonthlyRent(lease);

                            return monthlyRent ? formatUSD(monthlyRent) : "-";
                          })()}
                        </TableCell>

                        <TableCell>
                          {(() => {
                            const schedule = getSelectedSchedule(lease);

                            const size = getLeaseSize(lease);

                            const annualRent =
                              schedule && size
                                ? schedule.rent_psf * size
                                : getLeaseAnnualRent(lease);

                            return annualRent ? formatUSD(annualRent) : "-";
                          })()}
                        </TableCell>

                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            onClick={() =>
                              router.push(`/dashboard/leases/${lease.lease_id}`)
                            }
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <Eye size={16} className="mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* EXPIRED */}
          <TabsContent value="expired">
            {leases.expired.length === 0 ? (
              <p className="text-gray-500">No expired leases.</p>
            ) : (
              <div className="max-h-[400px] overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Size/SF</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead className="text-right">PSF</TableHead>
                      <TableHead className="text-right">Monthly Rent</TableHead>
                      <TableHead className="text-right">Annual Rent</TableHead>
                      <TableHead className="text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {leases.expired.map((lease) => (
                      <TableRow key={lease.lease_id}>
                        <TableCell>{display(lease.tenant)}</TableCell>

                        <TableCell>{display(lease.suite_unit)}</TableCell>

                        <TableCell>
                          {(() => {
                            const size = getLeaseSize(lease);

                            return size !== null ? String(size) : "-";
                          })()}
                        </TableCell>

                        <TableCell>{display(lease.status)}</TableCell>

                        <TableCell>{display(lease.lease_start)}</TableCell>

                        <TableCell>{display(lease.lease_end)}</TableCell>

                        <TableCell>
                          {(() => {
                            const psf = getLeaseRentPsf(lease);

                            return psf != null
                              ? `$${psf.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}`
                              : "-";
                          })()}
                        </TableCell>

                        <TableCell>
                          {(() => {
                            const monthlyRent = getLeaseMonthlyRent(lease);

                            return monthlyRent ? formatUSD(monthlyRent) : "-";
                          })()}
                        </TableCell>

                        <TableCell>
                          {(() => {
                            const annualRent = getLeaseAnnualRent(lease);

                            return annualRent ? formatUSD(annualRent) : "-";
                          })()}
                        </TableCell>

                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            onClick={() =>
                              router.push(`/dashboard/leases/${lease.lease_id}`)
                            }
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <Eye size={16} className="mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </InfoSection>

      {/* RENT SCHEDULE */}
      <InfoSection icon={<DollarSign />} title="Rent Schedule">
        {rentSchedule.length === 0 ? (
          <p className="text-gray-500">No rent schedule available.</p>
        ) : (
          (() => {
            // ✅ Column visibility (include RAW fallback fields)
            const columnVisibility = {
              startDate: rentSchedule.some(
                (r) => r.startDate || r.startDateRaw,
              ),
              endDate: rentSchedule.some((r) => r.endDate || r.endDateRaw),
              monthlyRent: hasAnyValue(rentSchedule, "monthlyRent"),
              annualRent: hasAnyValue(rentSchedule, "annualRent"),
              psf: hasAnyValue(rentSchedule, "psf"),
              capRate: hasAnyValue(rentSchedule, "capRate"),
              rentIncreasePercent: hasAnyValue(
                rentSchedule,
                "rentIncreasePercent",
              ),
            };

            return (
              <div className="max-h-[400px] overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Term</TableHead>

                      {columnVisibility.startDate && (
                        <TableHead>Start Date</TableHead>
                      )}

                      {columnVisibility.endDate && (
                        <TableHead>End Date</TableHead>
                      )}

                      {columnVisibility.monthlyRent && (
                        <TableHead>Monthly Rent</TableHead>
                      )}

                      {columnVisibility.annualRent && (
                        <TableHead>Annual Rent</TableHead>
                      )}

                      {columnVisibility.rentIncreasePercent && (
                        <TableHead>Rent Increase %</TableHead>
                      )}

                      {columnVisibility.psf && <TableHead>PSF</TableHead>}

                      {columnVisibility.capRate && (
                        <TableHead>Cap Rate</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {rentSchedule.map((r) => {
                      const startDateValue =
                        r.startDate ?? r.startDateRaw ?? "-";

                      const endDateValue = r.endDate ?? r.endDateRaw ?? "-";

                      return (
                        <TableRow key={r.id}>
                          <TableCell>{r.term || "-"}</TableCell>

                          {columnVisibility.startDate && (
                            <TableCell>{startDateValue}</TableCell>
                          )}

                          {columnVisibility.endDate && (
                            <TableCell>{endDateValue}</TableCell>
                          )}

                          {columnVisibility.monthlyRent && (
                            <TableCell>
                              {r.monthlyRent ? formatUSD(r.monthlyRent) : "-"}
                            </TableCell>
                          )}

                          {columnVisibility.annualRent && (
                            <TableCell>
                              {r.annualRent ? formatUSD(r.annualRent) : "-"}
                            </TableCell>
                          )}

                          {columnVisibility.rentIncreasePercent && (
                            <TableCell>
                              {r.rentIncreasePercent
                                ? `${r.rentIncreasePercent}%`
                                : "-"}
                            </TableCell>
                          )}

                          {columnVisibility.psf && (
                            <TableCell>
                              {r.psf ? `$${Number(r.psf).toFixed(2)}` : "-"}
                            </TableCell>
                          )}

                          {columnVisibility.capRate && (
                            <TableCell>
                              {r.capRate ? `${r.capRate}%` : "-"}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            );
          })()
        )}
      </InfoSection>

      {/* CONTACTS */}
      <InfoSection icon={<Users />} title="Brokers">
        {contacts.length === 0 ? (
          <p className="text-gray-500">
            No contacts assigned to this property.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Relationship</TableHead>
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
                  <TableCell>
                    {display(normalizeBrokerText(c.relationship).join(", "))}
                  </TableCell>

                  <TableCell>{display(c.listing_company)}</TableCell>

                  <TableCell>
                    {display(normalizeBrokerText(c.broker_name).join(", "))}
                  </TableCell>

                  <TableCell>
                    {display(normalizeBrokerText(c.phone).join(", "))}
                  </TableCell>

                  <TableCell>
                    {display(
                      normalizeBrokerText(c.email)
                        .map((e) => e.replace(/-/g, ".")) // ✅ restore dots
                        .join(", "),
                    )}
                  </TableCell>

                  <TableCell>{display(c.website)}</TableCell>

                  <TableCell>{display(c.comments)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </InfoSection>

      {/* COMMENTS */}
      <InfoSection icon={<ClipboardList />} title="Comments">
        {isEditing ? (
          <textarea
            className="w-full border rounded-md px-3 py-2 text-sm"
            value={form.comments || ""}
            onChange={(e) => handleChange("comments", e.target.value)}
          />
        ) : (
          <p className="border rounded-md bg-gray-50 px-4 py-3 text-sm text-gray-700">
            {property.comments || "No comments available."}
          </p>
        )}
      </InfoSection>

      {/* AUDIT INFORMATION */}
      <InfoSection icon={<Info />} title="Audit Information">
        <Grid2>
          <InfoItem
            label="Uploaded By"
            value={property.created_by_name || "—"}
          />

          <InfoItem
            label="Uploaded At"
            value={
              property.created_at
                ? new Date(property.created_at).toLocaleString()
                : "—"
            }
          />
        </Grid2>
      </InfoSection>

      {/* BACK BUTTON */}
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

/* -------------------------------------------
   SHARED UI COMPONENTS
--------------------------------------------*/

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
      <h3 className="text-xl font-semibold flex items-center gap-2 text-gray-800">
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
  editable = false,
  onChange,
  type = "text",
  options = [],
}: {
  label: string;
  value: any;
  editable?: boolean;
  onChange?: (val: string) => void;
  type?: "text" | "select";
  options?: { label: string; value: string }[];
}) {
  return (
    <div className="space-y-1">
      <Label className="text-gray-700 font-medium">{label}</Label>

      {editable ? (
        type === "select" ? (
          <select
            className="border rounded-md px-3 py-2 text-sm w-full"
            value={value || ""}
            onChange={(e) => onChange?.(e.target.value)}
          >
            <option value="">Select...</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            className="border rounded-md px-3 py-2 text-sm w-full"
            value={value || ""}
            onChange={(e) => onChange?.(e.target.value)}
          />
        )
      ) : (
        <p className="border rounded-md bg-gray-50 px-3 py-2 text-gray-800 text-sm">
        {formatDisplayValue(value)}
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
    maximumFractionDigits: 2,
  });
}

function display(value?: string) {
  return value ? value : <span className="text-xl">———</span>;
}

function BadgeCount({
  value,
  variant = "blue",
}: {
  value: number;
  variant?: "blue" | "red";
}) {
  if (!value) return null;

  const styles =
    variant === "red" ? "bg-red-700 text-white" : "bg-blue-700 text-white";

  return (
    <span
      className={`ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold rounded-full ${styles}`}
    >
      {value}
    </span>
  );
}

export function normalizeBrokerText(
  input: string | null | undefined,
): string[] {
  if (!input) return [];

  let cleaned = String(input).trim();

  if (!cleaned) return [];

  // PostgreSQL array
  // {"John","Mary"}
  if (cleaned.startsWith("{") && cleaned.endsWith("}")) {
    cleaned = cleaned.slice(1, -1);
  }

  // Try JSON array first
  // ["John","Mary"]
  if (cleaned.startsWith("[") && cleaned.endsWith("]")) {
    try {
      const parsed = JSON.parse(cleaned);

      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x).trim()).filter(Boolean);
      }
    } catch {
      // continue to fallback
    }

    cleaned = cleaned.slice(1, -1);
  }

  // Remove surrounding quotes if entire value is quoted
  cleaned = cleaned.replace(/^["']|["']$/g, "");

  // Split comma-separated values
  return cleaned
    .split(",")
    .map((item) => item.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

function formatTenancyType(value?: string | null): string {
  if (!value) return "—";

  const map: Record<string, string> = {
    SingleTenant: "Single Tenant",
    MultiTenant: "Multi Tenant",
  };

  return map[value] || value;
}

function hasAnyValue(data: any[], field: string) {
  return data.some(
    (row) =>
      row[field] !== null && row[field] !== undefined && row[field] !== "",
  );
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

function formatDisplayValue(value: any): string {
  if (value == null || value === "") return "—";

  if (Array.isArray(value)) {
    return [...new Set(value)]
      .filter(Boolean)
      .join(", ");
  }

  const text = String(value).trim();

  // PostgreSQL array
  if (
    (text.startsWith("{") && text.endsWith("}")) ||
    (text.startsWith("[") && text.endsWith("]"))
  ) {
    const values = normalizeBrokerText(text);

    return [...new Set(values)].join(", ");
  }

  return text;
}