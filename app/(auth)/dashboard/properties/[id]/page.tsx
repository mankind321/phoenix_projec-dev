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
} from "lucide-react";

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

        if (json.success) setData(json.data);
        else console.error(json.message);
      } catch (error) {
        console.error("Error loading property:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProperty();
  }, [propertyId]);

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

  return (
    <div className="w-11/12 mx-auto mt-10 space-y-10">
      {/* PAGE TITLE */}
      <div className="text-center mb-5">
        <h1 className="text-3xl font-semibold text-gray-900 flex items-center justify-center gap-2">
          <Building2 className="w-7 h-7 text-blue-600" />
          Property Information
        </h1>
      </div>

      {/* BASIC INFO */}
      <InfoSection icon={<Info />} title="Basic Information">
        <Grid2>
          <InfoItem label="Name" value={property.name} />
          <InfoItem label="Type" value={property.type} />
          <InfoItem label="Landlord" value={property.landlord} />
          <InfoItem label="Status" value={property.status} />
          <div>
            {data?.documentFiles?.file_url ? (
              <Button
                onClick={handleDownloadBrochure}
                disabled={!data?.documentFiles?.file_url || downloadingBrochure}
                className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 text-lg disabled:bg-gray-400"
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
          <InfoItem label="Address" value={property.address} />
          <InfoItem label="City" value={property.city} />
          <InfoItem label="State" value={property.state} />

          <div className="space-y-1">
            <Label className="text-gray-700 font-medium">Location</Label>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
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
          <InfoItem label="Sale Price" value={formatUSD(property.price)} />
          <InfoItem label="Cap Rate" value={property.cap_rate} />
          <InfoItem label="Sale Date" value={property.sale_date} />
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Landlord</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Annual Rent</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead className="text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {leases.active.map((lease) => (
                    <TableRow key={lease.lease_id}>
                      <TableCell>{display(lease.tenant)}</TableCell>
                      <TableCell>{display(lease.suite_unit)}</TableCell>
                      <TableCell>{display(lease.landlord)}</TableCell>
                      <TableCell>{display(lease.status)}</TableCell>
                      <TableCell>{display(lease.lease_start)}</TableCell>
                      <TableCell>{display(lease.lease_end)}</TableCell>
                      <TableCell>
                        {display(formatUSD(lease.annual_rent))}
                      </TableCell>
                      <TableCell>{display(formatUSD(lease.price))}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          onClick={() =>
                            router.push(`/dashboard/leases/${lease.lease_id}`)
                          }
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Eye size={16} />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {/* EXPIRED */}
          <TabsContent value="expired">
            {leases.expired.length === 0 ? (
              <p className="text-gray-500">No expired leases.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Landlord</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Annual Rent</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead className="text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {leases.expired.map((lease) => (
                    <TableRow key={lease.lease_id}>
                      <TableCell>{display(lease.tenant)}</TableCell>
                      <TableCell>{display(lease.suite_unit)}</TableCell>
                      <TableCell>{display(lease.landlord)}</TableCell>
                      <TableCell>{display(lease.status)}</TableCell>
                      <TableCell>{display(lease.lease_start)}</TableCell>
                      <TableCell>{display(lease.lease_end)}</TableCell>
                      <TableCell>
                        {display(formatUSD(lease.annual_rent))}
                      </TableCell>
                      <TableCell>{display(formatUSD(lease.price))}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          onClick={() =>
                            router.push(`/dashboard/leases/${lease.lease_id}`)
                          }
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Eye size={16} />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
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
        <p className="border rounded-md bg-gray-50 px-4 py-3 text-sm text-gray-700">
          {property.comments || "No comments available."}
        </p>
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

function InfoItem({ label, value }: { label: string; value: any }) {
  return (
    <div className="space-y-1">
      <Label className="text-gray-700 font-medium">{label}</Label>
      <p className="border rounded-md bg-gray-50 px-3 py-2 text-gray-800 text-sm">
        {value || "—"}
      </p>
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

  try {
    let cleaned = input.trim();

    // Remove outer brackets if present
    if (cleaned.startsWith("[") && cleaned.endsWith("]")) {
      cleaned = cleaned.slice(1, -1);
    }

    // Replace single quotes → double quotes (to make JSON safe)
    cleaned = cleaned.replace(/'/g, '"');

    // Try parsing as JSON array
    let arr: string[] = [];

    if (cleaned.includes(",")) {
      arr = JSON.parse(`[${cleaned}]`);
    } else {
      arr = [cleaned];
    }

    return arr.map(
      (item) =>
        item
          ?.trim()
          .replace(/^["']|["']$/g, "") // ✅ remove starting/ending quotes
          .replace(/\./g, "-"), // ✅ replace dot with dash
    );
  } catch (err) {
    console.error("normalizeBrokerText error:", err);

    // fallback (safe split)
    return input
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map((x) =>
        x
          .trim()
          .replace(/^["']|["']$/g, "")
          .replace(/\./g, "-"),
      );
  }
}
