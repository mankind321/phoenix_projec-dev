/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  DollarSign,
  Info,
  MapPinned,
  Users,
  CheckCircle,
  XCircle,
  Loader2,
  Download,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  contacts: any[];
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
  const [processing, setProcessing] = useState(false);

  const [downloadingBrochure, setDownloadingBrochure] = useState(false);

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

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

    // gs://bucket/path
    if (url.startsWith("gs://")) {
      return url.replace(`gs://${process.env.NEXT_PUBLIC_GCP_BUCKET}/`, "");
    }

    // https://storage.googleapis.com/bucket/path
    if (url.includes("storage.googleapis.com")) {
      return url.split(`/${process.env.NEXT_PUBLIC_GCP_BUCKET}/`)[1];
    }

    // already normalized
    return url;
  }

  /* -------------------------------------------
   DOWNLOAD BROCHURE FUNCTION
  --------------------------------------------*/
  async function handleDownloadBrochure() {
    if (!documentFiles?.file_url) {
      toast.error("No brochure available.");
      return;
    }

    try {
      setDownloadingBrochure(true);

      const fileUrl = documentFiles.file_url;

      console.log("fileUrl:", fileUrl);

      // CASE 1: Signed URL → use directly
      if (fileUrl.startsWith("https://storage.googleapis.com")) {
        window.open(fileUrl, "_blank");
        toast.success("Download started.");
        return;
      }

      // CASE 2: gs:// URL → use API
      const clean = normalizeGsUrl(fileUrl);

      const downloadUrl = `/api/gcp/download?path=${encodeURIComponent(clean)}`;

      window.open(downloadUrl, "_blank");

      toast.success("Download started.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to download file.");
    } finally {
      setDownloadingBrochure(false);
    }
  }

  /* -------------------------------------------
     APPROVE FUNCTION
  --------------------------------------------*/
  async function handleApprove() {
    if (!propertyId) return;

    setProcessing(true);

    toast.promise(
      (async () => {
        const res = await fetch("/api/review/action", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            propertyId,
            action: "approve",
          }),
        });

        const json = await res.json();

        if (!res.ok)
          throw new Error(json.error || "Failed to approve property");

        return json;
      })(),
      {
        loading: "Approving property...",

        success: () => {
          // ✅ notify sidebar to refresh Review badge
          window.dispatchEvent(new Event("review-count-updated"));

          router.push("/dashboard/review");
          router.refresh();

          return "Property approved successfully";
        },

        error: "Failed to approve property",

        finally: () => {
          setProcessing(false);
        },
      },
    );
  }

  /* -------------------------------------------
     REJECT FUNCTION
  --------------------------------------------*/
  async function handleReject() {
    if (!propertyId) return;

    setProcessing(true);

    toast.promise(
      (async () => {
        const res = await fetch(`/api/properties/${propertyId}`, {
          method: "DELETE",
        });

        const json = await res.json();

        if (!res.ok)
          throw new Error(json.message || "Failed to delete property");

        return json;
      })(),
      {
        loading: "Rejecting and deleting property...",

        success: () => {
          // ✅ notify sidebar to refresh Review badge
          window.dispatchEvent(new Event("review-count-updated"));

          router.push("/dashboard/review");
          router.refresh();

          return "Property rejected and deleted successfully";
        },

        error: "Failed to reject property",

        finally: () => {
          setProcessing(false);
        },
      },
    );
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

  const { property, documentFiles, contacts } = data;

  return (
    <div className="w-11/12 mx-auto mt-10 space-y-10">
      {/* PAGE TITLE */}
      <div className="text-center mb-5">
        <h1 className="text-3xl font-semibold text-gray-900 flex items-center justify-center gap-2">
          <Building2 className="w-7 h-7 text-blue-600" />
          Review Property Information
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
            {documentFiles.file_url ? (
              <Button
                onClick={handleDownloadBrochure}
                disabled={!documentFiles?.file_url || downloadingBrochure}
                className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 text-lg disabled:bg-gray-400"
              >
                {downloadingBrochure ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Download className="w-5 h-5" />
                )}

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
              href={`https://www.google.com/maps?q=${property.latitude},${property.longitude}`}
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
                <TableHead>Broker</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Relationship</TableHead>
                <TableHead>Listing Company</TableHead>
                <TableHead>Website</TableHead>
                <TableHead>Comments</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {contacts.map((c: any) => (
                <TableRow key={c.contact_assignment_id}>
                  <TableCell>{c.broker_name || "—"}</TableCell>
                  <TableCell>{c.phone || "—"}</TableCell>
                  <TableCell>{c.email || "—"}</TableCell>
                  <TableCell>{c.relationship || "—"}</TableCell>
                  <TableCell>{c.listing_company || "—"}</TableCell>
                  <TableCell>{c.website || "—"}</TableCell>
                  <TableCell>{c.comments || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </InfoSection>

      {/* BACK BUTTON */}
      {/* ACTION BUTTONS ROW */}
      <div className="flex items-center justify-between pt-4 border-t">
        {/* LEFT SIDE → Back */}
        <Button
          variant="outline"
          className="flex items-center gap-2"
          onClick={() => router.back()}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        {/* RIGHT SIDE → Approve / Reject */}
        <div className="flex gap-3">
          <Button
            disabled={processing}
            onClick={() => setApproveOpen(true)}
            className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
          >
            {processing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            Approve
          </Button>

          <Button
            disabled={processing}
            onClick={() => setRejectOpen(true)}
            className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
          >
            {processing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            Reject
          </Button>
        </div>
      </div>

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Property?</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve this property?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={processing}
              onClick={() => setApproveOpen(false)}
            >
              Cancel
            </Button>

            <Button
              disabled={processing}
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleApprove}
            >
              {processing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Confirm Approve"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Property?</DialogTitle>
            <DialogDescription>
              This will permanently delete the property information. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={processing}
              onClick={() => setRejectOpen(false)}
            >
              Cancel
            </Button>

            <Button
              disabled={processing}
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleReject}
            >
              {processing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Confirm Reject"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  });
}
