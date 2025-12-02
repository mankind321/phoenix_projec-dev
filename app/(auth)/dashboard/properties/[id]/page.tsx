/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

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
} from "lucide-react";

import Image from "next/image";

// Carousel
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

// Dialog (Zoom Feature)
import {
  Dialog,
  DialogTrigger,
  DialogContent,
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

  if (loading)
    return <p className="text-center mt-10 text-gray-600">Loading property...</p>;

  if (!data)
    return (
      <p className="text-center mt-10 text-red-500">
        Property not found or has been removed.
      </p>
    );

  const { property, leases, documents, contacts } = data;

  return (
    <div className="w-11/12 mx-auto mt-10 space-y-10">

      {/* PAGE TITLE */}
      <div className="text-center mb-5">
        <h1 className="text-3xl font-semibold text-gray-900 flex items-center justify-center gap-2">
          <Building2 className="w-7 h-7 text-blue-600" />
          Property Information
        </h1>
      </div>

      {/* =======================================================
                IMAGES (CAROUSEL + FULL RES ZOOM)
      ======================================================= */}
      {documents.length === 0 ? (
        <div className="relative w-full max-w-3xl mx-auto h-60 md:h-80">
          <Image
            src="https://placehold.co/600x400.png?text=No+Image"
            alt="No Image Available"
            fill
            className="object-cover bg-gray-200"
            sizes="100vw"
            placeholder="blur"
            blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAQAAACENnwnAAAAD0lEQVR42mNgoBpgYGBgAAAAMgAB9O3bGAAAAABJRU5ErkJggg=="
            unoptimized
          />
        </div>
      ) : (
        <Carousel className="w-full max-w-3xl mx-auto">
          <CarouselContent>
            {documents.map((doc, idx) => (
              <CarouselItem key={idx}>
                <div className="p-1">
                  <div className="relative w-full h-60 md:h-80 overflow-hidden">

                    <Dialog>
                      <DialogTrigger asChild>
                        <Image
                          src={doc.file_url}
                          alt={`Property Image ${idx + 1}`}
                          fill
                          className="object-cover rounded-md cursor-zoom-in"
                          sizes="100vw"
                          placeholder="blur"
                          blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAQAAACENnwnAAAAD0lEQVR42mNgoBpgYGBgAAAAMgAB9O3bGAAAAABJRU5ErkJggg=="
                          priority={idx === 0}
                        />
                      </DialogTrigger>

                      {/* FULLSCREEN ZOOM */}
                      <DialogContent
                        className="bg-black rounded-lg p-2 w-[75vw] max-h-[75vh] max-w-none flex items-center justify-center"
                      >
                        <DialogTitle className="sr-only">Image Preview</DialogTitle>

                        <div className="max-w-full max-h-full overflow-auto">
                          <Image
                            src={doc.file_url}
                            alt="Zoomed Image"
                            unoptimized
                            width={2000}
                            height={2000}
                            className="object-contain max-w-full max-h-[75vh]"
                          />
                        </div>
                      </DialogContent>

                    </Dialog>

                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>

          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      )}

      {/* BASIC INFO */}
      <InfoSection icon={<Info />} title="Basic Information">
        <Grid2>
          <InfoItem label="Name" value={property.name} />
          <InfoItem label="Type" value={property.type} />
          <InfoItem label="Landlord" value={property.landlord} />
          <InfoItem label="Status" value={property.status} />
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
          <InfoItem label="Sale Price (USD)" value={property.price_usd} />
          <InfoItem label="Cap Rate" value={property.cap_rate} />
          <InfoItem label="Sale Date" value={property.sale_date} />
        </Grid2>
      </InfoSection>

      {/* LEASES */}
      <InfoSection icon={<Users />} title="Leases">
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="active">Active Leases</TabsTrigger>
            <TabsTrigger value="expired">Expired Leases</TabsTrigger>
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
                    <TableHead>Landload</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Annual Rent</TableHead>
                    <TableHead>Price</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {leases.active.map((lease) => (
                    <TableRow key={lease.lease_id}>
                      <TableCell>{lease.tenant}</TableCell>
                      <TableCell>{lease.landlord}</TableCell>
                      <TableCell>{lease.lease_start}</TableCell>
                      <TableCell>{lease.lease_end}</TableCell>
                      <TableCell>{formatUSD(lease.annual_rent)}</TableCell>
                      <TableCell>{formatUSD(lease.price)}</TableCell>
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
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Annual Rent</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {leases.expired.map((lease) => (
                    <TableRow key={lease.lease_id}>
                      <TableCell>{lease.tenant}</TableCell>
                      <TableCell>{lease.lease_start}</TableCell>
                      <TableCell>{lease.lease_end}</TableCell>
                      <TableCell>{formatUSD(lease.annual_rent)}</TableCell>
                      <TableCell>{formatUSD(lease.price)}</TableCell>
                      <TableCell>{lease.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
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


      {/* COMMENTS */}
      <InfoSection icon={<ClipboardList />} title="Comments">
        <p className="border rounded-md bg-gray-50 px-4 py-3 text-sm text-gray-700">
          {property.comments || "No comments available."}
        </p>
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