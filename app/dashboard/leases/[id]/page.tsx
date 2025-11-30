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
  Info,
  User,
  Users,
  Download,
} from "lucide-react";

/** interface LeaseData {
  lease_id: string;
  tenant: string;
  landlord: string;
  property_name: string;
  property_address: string;
  property_type: string;
  property_landlord: string;

  lease_start: string;
  lease_end: string;
  availability_date: string;

  annual_rent: number;
  rent_psf: number;
  price: number;
  price_usd: string;
  annual_rent_usd: string;

  comments: string;
  file_url: string;

  status?:string;
}**/
interface LeaseData{
  lease: any,
  contacts: any[]
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

  // Load lease
  useEffect(() => {
    if (!leaseId) return;

    const fetchLease = async () => {
      try {
        const res = await fetch(`/api/lease/${leaseId}`);
        const data = await res.json();
        setData(data.data);
      } catch (error) {
        console.error("Error loading lease:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLease();
  }, [leaseId]);

  

  if (loading)
    return <p className="text-center mt-10 text-gray-600">Loading lease...</p>;

  if (!data)
    return (
      <p className="text-center mt-10 text-red-500">
        Lease not found or has been removed.
      </p>
    );
  
    const { lease, contacts } = data;

  return (
    <div className="w-11/12 mx-auto mt-10 space-y-10">

      {/* ========== PAGE TITLE ========== */}
      <div className="text-center space-y-2 mb-5">
        <h1 className="text-3xl font-semibold text-gray-900 flex items-center justify-center gap-2">
          <FileText className="w-7 h-7 text-blue-600" />
          Lease Information
        </h1>
        <p className="text-gray-500 text-sm">
          Lease ID: <span className="font-medium">{leaseId}</span>
        </p>
      </div>

      {/* ========== CONTENT SECTIONS ========== */}
      <div className="space-y-10 mt-5">

        {/* ---------------- BASIC ---------------- */}
        <InfoSection icon={<User />} title="Basic Information">
          <Grid2>
            <InfoItem label="Tenant" value={lease.tenant} />
            <InfoItem label="Landlord" value={lease.landlord} />
            <InfoItem label="Status" value={lease.status} />
          </Grid2>
        </InfoSection>

        {/* ---------------- PROPERTY ---------------- */}
        <InfoSection icon={<Building2 />} title="Property Details">
          <Grid2>
            <InfoItem label="Property Name" value={lease.property_name} />
            <InfoItem label="Property Type" value={lease.property_type} />
            <InfoItem label="Property Address" value={lease.property_address} />
            <InfoItem label="Property Landlord" value={lease.property_landlord} />
          </Grid2>
        </InfoSection>

        {/* ---------------- DATES ---------------- */}
        <InfoSection icon={<CalendarDays />} title="Lease Dates">
          <Grid2>
            <InfoItem label="Start Date" value={lease.lease_start} />
            <InfoItem label="End Date" value={lease.lease_end} />
            <InfoItem label="Availability Date" value={lease.availability_date} />
          </Grid2>
        </InfoSection>

        {/* ---------------- FINANCIAL ---------------- */}
        <InfoSection icon={<DollarSign />} title="Financial Information">
          <Grid2>
            <InfoItem label="Price" value={formatUSD(lease.price)} />

            <InfoItem label="Annual Rent" value={formatUSD(lease.annual_rent)} />

            <InfoItem label="Rent PSF" value={formatUSD(lease.rent_psf)} />
          </Grid2>
        </InfoSection>

        {/* CONTACTS */}
      <InfoSection icon={<Users />} title="Related Contacts">
        {contacts.length === 0 ? (
          <p className="text-gray-500">No contacts assigned to this property.</p>
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
                  <TableCell>{c.relationship || "—"}</TableCell>
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

        {/* ---------------- COMMENTS ---------------- */}
        <InfoSection icon={<Info />} title="Comments">
          <p className="border rounded-md bg-gray-50 px-4 py-3 text-sm text-gray-700">
            {lease.comments || "No comments available."}
          </p>
        </InfoSection>

        {/* ---------------- FILE ---------------- */}
        <InfoSection icon={<ClipboardList />} title="Attached Files">
          {lease.file_url ? (
            <Button
            onClick={() =>
              window.open(`/api/gcp/download?path=${encodeURIComponent(lease.file_url)}`, "_blank")
            }
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download File
          </Button>
          ) : (
            <p className="text-gray-500">No files uploaded.</p>
          )}
        </InfoSection>
      </div>

      {/* ========== BACK BUTTON ========== */}
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
   SHARED UI COMPONENTS (CLEAN + MODERN)
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
      <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
        <span className="text-blue-600">{icon}</span>
        {title}
      </h3>

      <div className="p-5 border rounded-xl bg-white shadow-sm">
        {children}
      </div>
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {children}
    </div>
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
