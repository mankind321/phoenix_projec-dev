/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  MapPinned,
  Database,
  Building2,
  Calendar,
  DollarSign,
  Briefcase,
} from "lucide-react";

/* ----------------------------------------------------
TYPE — FULL document_registry STRUCTURE
---------------------------------------------------- */

interface ErrorMonitoringData {
  document: any;
}

export default function ErrorMonitoringViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = React.use(params);

  const [data, setData] = useState<ErrorMonitoringData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/errormonitoring/${id}`);

        const json = await res.json();

        if (json.success) setData(json.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (loading) return <CenterText text="Loading error monitoring record..." />;

  if (!data) return <CenterText text="Record not found." color="red" />;

  const { document } = data;

  return (
    <div className="w-11/12 mx-auto mt-10 space-y-8">
      {/* TITLE */}

      <PageTitle />

      {/* PROCESSING */}

      <InfoSection title="File Information" icon={<Database />}>
        <Grid3>
          <InfoItem label="File Name" value={document.file_name} />
          <InfoItem
            label="Extraction Status"
            value={renderStatus(document.extraction_status)}
          />
          <InfoItem
            label="Confidence %"
            value={document.extraction_confidence_level_percentage}
          />
          <InfoItem label="Remarks" value={document.remarks} />
        </Grid3>
      </InfoSection>

      {/* PROPERTY */}

      <InfoSection title="Property Information" icon={<Building2 />}>
        <Grid3>
          <InfoItem label="Property Key" value={document.property_key?.replace(/[\[\]']/g, "")} />
          <InfoItem label="Property Name" value={document.property_name?.replace(/[\[\]']/g, "")} />
          <InfoItem label="Property Type" value={document.property_type?.replace(/[\[\]']/g, "")} />
          <InfoItem label="Property Status" value={document.property_status?.replace(/[\[\]']/g, "")} />
        </Grid3>
      </InfoSection>

      {/* LOCATION */}

      <InfoSection title="Location Information" icon={<MapPinned />}>
        <Grid3>
          <InfoItem label="Address" value={document.address?.replace(/[\[\]']/g, "")} />
          <InfoItem label="Street" value={document.street?.replace(/[\[\]']/g, "")} />
          <InfoItem label="City" value={document.city?.replace(/[\[\]']/g, "")} />
          <InfoItem label="State" value={document.state?.replace(/[\[\]']/g, "")} />
          <InfoItem label="Zip Code" value={document.zip_code?.replace(/[\[\]']/g, "")} />
          <InfoItem label="Country" value={document.country?.replace(/[\[\]']/g, "")} />
          <InfoItem
            label="Geocoded Address"
            value={document.geocoded_address?.replace(/[\[\]']/g, "")}
          />
          <InfoItem label="Latitude" value={document.latitude?.replace(/[\[\]']/g, "")} />
          <InfoItem label="Longitude" value={document.longitude?.replace(/[\[\]']/g, "")} />
        </Grid3>
      </InfoSection>

      {/* FINANCIAL */}

      <InfoSection title="Financial Information" icon={<DollarSign />}>
        <Grid3>
          <InfoItem label="Price" value={document.price?.replace(/[\[\]']/g, "")} />
          <InfoItem label="Asking Price" value={document.asking_price?.replace(/[\[\]']/g, "")} />
          <InfoItem label="Annual Rent" value={document.annual_rent?.replace(/[\[\]']/g, "")} />
          <InfoItem label="Rent PSF" value={document.rent_psf?.replace(/[\[\]']/g, "")} />
          <InfoItem label="Cap Rate" value={document.cap_rate?.replace(/[\[\]']/g, "")} />
        </Grid3>
      </InfoSection>

      {/* LEASE */}

      <InfoSection title="Lease Information" icon={<Calendar />}>
        <Grid3>
          <InfoItem label="Lease Start" value={document.lease_start?.replace(/[\[\]']/g, "")} />
          <InfoItem label="Lease End" value={document.lease_end?.replace(/[\[\]']/g, "")} />
          <InfoItem label="Sale Date" value={document.sale_date?.replace(/[\[\]']/g, "")} />
          <InfoItem
            label="Availability Date"
            value={document.availability_date?.replace(/[\[\]']/g, "")}
          />
        </Grid3>
      </InfoSection>

      {/* BROKER */}

      <InfoSection title="Broker Information" icon={<Briefcase />}>
        <Grid3>
          <InfoItem
            label="Broker"
            value={document.broker?.replace(/[\[\]']/g, "")}
          />

          <InfoItem
            label="Broker Email"
            value={document.broker_email_address?.replace(/[\[\]']/g, "")}
          />

          <InfoItem
            label="Broker Phone"
            value={document.broker_phone_number?.replace(/[\[\]']/g, "")}
          />

          <InfoItem label="Broker Brand" value={document.broker_brand} />
          <InfoItem label="Broker Website" value={document.broker_website} />
          <InfoItem label="Listing Company" value={document.listing_company} />
          <InfoItem label="Relationship" value={document.relationship} />
        </Grid3>
      </InfoSection>

      <Button variant="outline" onClick={() => router.push("/dashboard/documents")}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>
    </div>
  );
}

/* ----------------------------------------------------
HELPERS
---------------------------------------------------- */

function renderStatus(status: string) {
  if (!status) return "—";

  if (status === "PASSED")
    return (
      <span className="text-green-600 flex items-center gap-2">
        <CheckCircle className="w-4 h-4" />
        PASSED
      </span>
    );

  if (status === "FAILED")
    return (
      <span className="text-red-600 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" />
        FAILED
      </span>
    );

  return status;
}

function formatDate(value: any) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function CenterText({ text, color = "gray" }: any) {
  return <p className={`text-center mt-10 text-${color}-600`}>{text}</p>;
}

/* ----------------------------------------------------
UI COMPONENTS
---------------------------------------------------- */

function PageTitle() {
  return (
    <h1 className="text-3xl font-semibold text-center flex justify-center items-center gap-2">
      <AlertTriangle className="w-7 h-7 text-red-600" />
      Error Document Details
    </h1>
  );
}

function InfoSection({ title, icon, children }: any) {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-xl font-semibold mb-3">
        {icon}
        {title}
      </h2>

      <div className="border rounded-lg p-5 bg-white shadow-sm">{children}</div>
    </div>
  );
}

function Grid3({ children }: any) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {children}
    </div>
  );
}

function InfoItem({ label, value }: any) {
  return (
    <div>
      <Label className="mb-2">{label}</Label>
      <div className="border rounded px-3 py-2 bg-gray-50 text-sm">
        {value || "—"}
      </div>
    </div>
  );
}
