/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";

import {
  Building2,
  User,
  Phone,
  Mail,
  Globe,
  Send,
  FileText,
} from "lucide-react";

import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

//
// =============================================
// TYPE DEFINITIONS
// =============================================
//

// Returned by GET /api/contacts/:id
interface ContactRecord {
  id: string;
  user_id: string;

  listing_company: string;
  broker_name: string;
  phone: string;
  email: string;
  website: string;
  comments: string;

  unique_id?: string;

  property_id?: string | null;
  lease_id?: string | null;

  relation_text?: string | null;
  relation_comment?: string | null;

  created_at?: string;
  updated_at?: string;
}

// Payload for POST / PUT
interface ContactFormData {
  user_id: string;
  listing_company: string;
  broker_name: string;
  phone: string;
  email: string;
  website: string | null;
  comments: string | null;
  unique_id?: string;
}

// Dropdown types
interface PropertyItem {
  id: string;
  name: string;
}

interface LeaseItem {
  id: string;
  tenant?: string;
  name?: string;
  property_id?: string | null;
}

//
// =============================================
// COMPONENT START
// =============================================
//

export default function ContactFormPage() {
  const router = useRouter();
  const params = useSearchParams();
  const contactId = params.get("id");
  const isEditMode = Boolean(contactId);

  const { data: session, status } = useSession();

  //
  // FORM STATE
  //
  const [form, setForm] = useState<ContactFormData>({
    user_id: "",
    listing_company: "",
    broker_name: "",
    phone: "",
    email: "",
    website: "",
    comments: "",
  });

  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [leases, setLeases] = useState<LeaseItem[]>([]);

  const [selectedProperty, setSelectedProperty] = useState("");
  const [selectedLease, setSelectedLease] = useState("");

  const [relationText, setRelationText] = useState("");
  const [relationComment, setRelationComment] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  //
  // =============================================
  // LOAD PROPERTY & LEASE OPTIONS
  // =============================================
  //
  useEffect(() => {
    (async () => {
      try {
        const p = await fetch("/api/contacts/property_list").then((r) =>
          r.json(),
        );
        const l = await fetch("/api/contacts/lease_list").then((r) => r.json());

        setProperties(p.items ?? []);
        setLeases(l.items ?? []);
      } catch {
        toast.error("Failed to load dropdown data");
      }
    })();
  }, []);

  //
  // =============================================
  // LOAD USER SESSION
  // =============================================
  //
  useEffect(() => {
    if (status === "loading") return;

    if (!session?.user?.id) {
      setError("Unauthorized.");
      return;
    }

    setForm((prev) => ({ ...prev, user_id: session.user.id }));
    setLoading(false);
  }, [status, session]);

  //
  // =============================================
  // LOAD RECORD IF EDITING
  // =============================================
  //
  useEffect(() => {
    if (!isEditMode || !contactId || !session?.user?.id) return;

    (async () => {
      try {
        setLoading(true);

        const res = await fetch(`/api/contacts/${contactId}`);
        const payload = await res.json();

        const contact: ContactRecord =
          payload?.data ?? payload?.contact ?? payload;

        if (!contact) {
          setError("Broker not found");
          return;
        }

        // Populate form
        setForm({
          user_id: session.user.id,
          listing_company: contact.listing_company ?? "",
          broker_name: contact.broker_name ?? "",
          phone: contact.phone ?? "",
          email: contact.email ?? "",
          website: contact.website ?? "",
          comments: contact.comments ?? "",
          unique_id: contact.unique_id ?? undefined,
        });

        // Use assignment object from API
        const assign = (contact as any).assignment ?? null;

        setSelectedProperty(assign?.property_id ?? "");
        setSelectedLease(assign?.lease_id ?? "");

        setRelationText(assign?.relationship ?? "");
        setRelationComment(assign?.comments ?? "");
      } finally {
        setLoading(false);
      }
    })();
  }, [isEditMode, contactId, session]);

  //
  // =============================================
  // GENERIC INPUT HANDLER
  // =============================================
  //
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  //
  // =============================================
  // VALIDATION
  // =============================================
  //
  const validate = () => {
    if (!form.broker_name.trim()) return "Broker name is required.";
    if (!form.listing_company.trim()) return "Listing company is required.";
    if (!form.phone.trim()) return "Phone is required.";
    if (!form.email.trim()) return "Email is required.";
    return null;
  };

  //
  // =============================================
  // SUBMIT FORM (ADD OR UPDATE)
  // =============================================
  //
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const v = validate();
    if (v) return toast.error(v);

    setSubmitting(true);

    try {
      const payload = {
        ...form,

        // normalize optional fields
        website: form.website?.trim() || null,
        comments: form.comments?.trim() || null,

        property_id: selectedProperty || null,
        lease_id: selectedLease || null,

        relation_text: relationText.trim() || null,
        relation_comment: relationComment.trim() || null,
      };

      const url = isEditMode ? `/api/contacts/${contactId}` : "/api/contacts";

      toast.loading(
        isEditMode ? "Updating contact..." : "Creating contact...",
        {
          id: "save",
        },
      );

      const res = await fetch(url, {
        method: isEditMode ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save contact", { id: "save" });
        return;
      }

      toast.success(isEditMode ? "Contact updated" : "Contact created", {
        id: "save",
      });

      setTimeout(() => router.push("/dashboard/contact"), 600);
    } finally {
      setSubmitting(false);
    }
  };

  //
  // =============================================
  // RENDER
  // =============================================
  //

  if (status === "loading") return <p>Checking session...</p>;
  if (!session) return <p>You must log in.</p>;

  return (
    <div className="w-11/12 mx-auto mt-6 space-y-6">
      <h2 className="text-2xl font-semibold text-center">
        {isEditMode ? "Edit Contact" : "Add New Contact"}
      </h2>

      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* BROKER + LISTING */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-500" />
                Broker Name <span className="text-red-500">*</span>
              </Label>
              <Input
                name="broker_name"
                value={form.broker_name}
                onChange={handleChange}
                required
                placeholder="Broker Name"
              />
            </div>

            <div>
              <Label className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-gray-500" />
                Listing Company <span className="text-red-500">*</span>
              </Label>
              <Input
                name="listing_company"
                value={form.listing_company}
                onChange={handleChange}
                required
                placeholder="Listing Company"
              />
            </div>
          </div>

          {/* CONTACT INFO */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-500" />
                Phone <span className="text-red-500">*</span>
              </Label>
              <Input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                required
                placeholder="Phone"
              />
            </div>

            <div>
              <Label className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-500" />
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                placeholder="Email Address"
              />
            </div>

            <div>
              <Label className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-gray-500" />
                Website
              </Label>
              <Input
                name="website"
                value={form.website ?? ""}
                onChange={handleChange}
                placeholder="https://example.com"
              />
            </div>
          </div>

          {/* PROPERTY SELECT */}
          <div>
            <Label className="flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4 text-gray-500" />
              Assign to Property
            </Label>

            <div className="flex gap-2 items-center">
              <SearchableSelect
                value={selectedProperty}
                onChange={(v) => {
                  setSelectedProperty(v);
                  // Clear lease when property changes
                  setSelectedLease("");
                }}
                options={properties.map((p) => ({
                  value: p.id,
                  label: p.name,
                }))}
                placeholder="Select property..."
              />

              {selectedProperty && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelectedProperty("");
                    setSelectedLease("");
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* LEASE SELECT */}
          <div>
            <Label className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-gray-500" />
              Assign to Lease
            </Label>

            <div className="flex gap-2 items-center">
              <SearchableSelect
                value={selectedLease}
                onChange={(v) => {
                  setSelectedLease(v);

                  // Sync property when lease belongs to a property
                  const lease = leases.find((x) => x.id === v);
                  if (lease?.property_id)
                    setSelectedProperty(lease.property_id);
                }}
                options={leases.map((l) => ({
                  value: l.id,
                  label: l.tenant ?? l.name ?? "",
                }))}
                placeholder="Select lease..."
              />

              {selectedLease && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedLease("")}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* RELATION */}
          <div>
            <Label>Relation</Label>
            <Input
              value={relationText}
              onChange={(e) => setRelationText(e.target.value)}
              placeholder="Owner, Broker, Tenant Rep..."
            />
          </div>

          {/* RELATION COMMENT */}
          <div>
            <Label className="mb-2">Relation Comment</Label>
            <textarea
              value={relationComment}
              onChange={(e) => setRelationComment(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-3 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Additional notes..."
            />
          </div>

          {/* CONTACT COMMENTS */}
          <div>
            <Label className="mb-2">Contact Comments</Label>
            <textarea
              name="comments"
              value={form.comments ?? ""}
              onChange={handleChange}
              rows={4}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-3 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Optional notes..."
            />
          </div>

          {/* BUTTONS */}
          <div className="flex justify-end gap-3">
            <Button
              type="submit"
              disabled={submitting}
              className="bg-blue-500 hover:bg-blue-700 text-white hover:text-white"
            >
              <Send className="w-4 h-4 mr-2" />
              {isEditMode ? "Update Contact" : "Save Contact"}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="bg-red-500 hover:bg-red-700 text-white hover:text-white"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
