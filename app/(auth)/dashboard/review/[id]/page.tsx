/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

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
  Loader2,
  CheckCircle,
  XCircle,
  Phone,
  Globe,
  Mail,
  Edit,
  Plus,
} from "lucide-react";
import { Can } from "@/app/components/can";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

  const [form, setForm] = useState<any>({});

  const [rentSchedule, setRentSchedule] = useState<any[]>([]);

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [selectedSchedules, setSelectedSchedules] = useState<
    Record<string, string>
  >({});

  const [leaseCounts, setLeaseCounts] = useState({
    active: 0,
    expired: 0,
  });

  const [brokerDialogOpen, setBrokerDialogOpen] = useState(false);
  const [editingBroker, setEditingBroker] = useState<any | null>(null);
  const [brokerSubmitting, setBrokerSubmitting] = useState(false);

  const [brokerChanges, setBrokerChanges] = useState<any[]>([]);

  const [brokerForm, setBrokerForm] = useState({
    listing_company: "",
    broker_name: "",
    phone: "",
    email: "",
    website: "",
    relationship: "",
    comments: "",
  });

  const [rentScheduleDialogOpen, setRentScheduleDialogOpen] = useState(false);

  const [editingRentSchedule, setEditingRentSchedule] = useState<any | null>(
    null,
  );

  const [rentScheduleSubmitting, setRentScheduleSubmitting] = useState(false);

  const [rentScheduleChanges, setRentScheduleChanges] = useState<any[]>([]);

  const [rentScheduleForm, setRentScheduleForm] = useState({
    term: "",
    startDate: "",
    endDate: "",
    monthlyRent: "",
    annualRent: "",
    rentIncreasePercent: "",
    psf: "",
    capRate: "",
  });

  const [deleteTenantOpen, setDeleteTenantOpen] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState<any | null>(null);
  const [deletingTenant, setDeletingTenant] = useState(false);

  const [leaseChanges, setLeaseChanges] = useState<any[]>([]);

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

          /**  const defaults: Record<string, string> = {};

          [
            ...(json.data.leases.active ?? []),
            ...(json.data.leases.expired ?? []),
          ].forEach((lease: any) => {
            defaults[lease.lease_id] = getDefaultScheduleId(lease);
          });

          setSelectedSchedules(defaults);
          */
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

  useEffect(() => {
    if (!data) return;

    const defaults: Record<string, string> = {};

    [...data.leases.active, ...data.leases.expired].forEach((lease: any) => {
      defaults[lease.lease_id] = getDefaultScheduleId(lease);
    });

    setSelectedSchedules(defaults);
  }, [data]);

  const handleAddTenant = async () => {
    try {
      const res = await fetch("/api/lease", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          property_id: property.property_id,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(json.message || "Failed to create tenant.");
        return;
      }

      const leaseId = json.lease?.lease_id;

      if (!leaseId) {
        toast.error("Lease was created but no lease ID was returned.");
        return;
      }

      router.push(`/dashboard/leases/${leaseId}?fromReview=true`);
    } catch (error) {
      console.error("Failed to create tenant:", error);
      toast.error("Failed to create tenant.");
    }
  };

  const handleDeleteTenant = async (lease: any) => {
    const leaseId = lease?.lease_id;

    if (!leaseId) {
      toast.error("Tenant lease ID is missing.");
      return;
    }

    if (
      !window.confirm(
        `Remove ${lease.tenant || "this tenant"} from the property?`,
      )
    ) {
      return;
    }

    /*
     * Remove from UI immediately.
     */
    setData((prev: PropertyData | null) => {
      if (!prev) return prev;

      return {
        ...prev,
        leases: {
          active: prev.leases.active.filter(
            (item: any) => item.lease_id !== leaseId,
          ),
          expired: prev.leases.expired.filter(
            (item: any) => item.lease_id !== leaseId,
          ),
        },
      };
    });

    /*
     * Mark lease for deletion.
     *
     * NOTHING is deleted from the database yet.
     */
    setLeaseChanges((prev) => {
      const existingIndex = prev.findIndex(
        (change) => change.lease_id === leaseId,
      );

      const deleteChange = {
        lease_id: leaseId,
        action: "delete",
      };

      if (existingIndex === -1) {
        return [...prev, deleteChange];
      }

      const updated = [...prev];
      updated[existingIndex] = deleteChange;

      return updated;
    });

    toast.success("Tenant removal saved for approval.");
  };

  const resetBrokerForm = () => {
    setBrokerForm({
      listing_company: "",
      broker_name: "",
      phone: "",
      email: "",
      website: "",
      relationship: "",
      comments: "",
    });

    setEditingBroker(null);
  };

  const handleAddBroker = () => {
    resetBrokerForm();
    setBrokerDialogOpen(true);
  };

  const handleEditBroker = (broker: any) => {
    setEditingBroker(broker);

    setBrokerForm({
      listing_company: broker.listing_company ?? "",
      broker_name: broker.broker_name ?? "",
      phone: broker.phone ?? "",
      email: broker.email ?? "",
      website: broker.website ?? "",
      relationship: normalizeBrokerText(broker.relationship).join(", "),
      comments: broker.comments ?? "",
    });

    setBrokerDialogOpen(true);
  };

  const handleSaveBroker = async () => {
    const missing: string[] = [];

    if (!brokerForm.broker_name.trim()) {
      missing.push("Broker Name");
    }

    if (!brokerForm.listing_company.trim()) {
      missing.push("Listing Company");
    }

    if (!brokerForm.phone.trim()) {
      missing.push("Phone");
    }

    if (!brokerForm.email.trim()) {
      missing.push("Email");
    }

    if (missing.length > 0) {
      toast.error(`Required fields: ${missing.join(", ")}`);
      return;
    }

    setBrokerSubmitting(true);

    try {
      const brokerData = {
        listing_company: brokerForm.listing_company.trim(),
        broker_name: brokerForm.broker_name.trim(),
        phone: brokerForm.phone.trim(),
        email: brokerForm.email.trim(),
        website: brokerForm.website.trim() || null,
        relationship: brokerForm.relationship.trim() || null,
        comments: brokerForm.comments.trim() || null,
      };

      /*
       * ============================================================
       * NEW BROKER
       * ============================================================
       *
       * Nothing is sent to the database yet.
       *
       * We create a temporary ID so React can track this broker
       * until the reviewer clicks Approve.
       */
      if (!editingBroker) {
        const tempId = `temp-${crypto.randomUUID()}`;

        const newBroker = {
          ...brokerData,

          // Temporary UI identifier
          contact_assignment_id: tempId,

          // Used by approval API
          _temp_id: tempId,
          _action: "create",
        };

        // Add to the visible table
        setData((prev: any) => {
          if (!prev) return prev;

          return {
            ...prev,
            contacts: [...(prev.contacts ?? []), newBroker],
          };
        });

        // Add to pending changes
        setBrokerChanges((prev) => [
          ...prev,
          {
            ...brokerData,
            temp_id: tempId,
            action: "create",
          },
        ]);

        toast.success("Broker added to review");

        setBrokerDialogOpen(false);
        resetBrokerForm();

        return;
      }

      /*
       * ============================================================
       * EXISTING BROKER
       * ============================================================
       *
       * Update the UI immediately, but do NOT update the database.
       */
      const assignmentId = editingBroker.contact_assignment_id;

      const updatedBroker = {
        ...editingBroker,
        ...brokerData,
        contact_assignment_id: assignmentId,
        _action: "update",
      };

      // Update visible broker table
      setData((prev: any) => {
        if (!prev) return prev;

        return {
          ...prev,
          contacts: (prev.contacts ?? []).map((contact: any) =>
            contact.contact_assignment_id === assignmentId
              ? updatedBroker
              : contact,
          ),
        };
      });

      /*
       * Check whether this broker already has a pending change.
       *
       * This prevents multiple update entries for the same broker.
       */
      setBrokerChanges((prev) => {
        const existingIndex = prev.findIndex(
          (change) => change.contact_assignment_id === assignmentId,
        );

        const change = {
          ...brokerData,
          contact_assignment_id: assignmentId,
          action: "update",
        };

        if (existingIndex === -1) {
          return [...prev, change];
        }

        const updated = [...prev];
        updated[existingIndex] = change;

        return updated;
      });

      toast.success("Broker changes saved for approval");

      setBrokerDialogOpen(false);
      resetBrokerForm();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save broker",
      );
    } finally {
      setBrokerSubmitting(false);
    }
  };

  const handleDeleteBroker = async (broker: any) => {
    const brokerName =
      normalizeBrokerText(broker.broker_name).join(", ") || "this broker";

    if (!window.confirm(`Remove ${brokerName} from this property?`)) {
      return;
    }

    const assignmentId = broker.contact_assignment_id;

    /*
     * ============================================================
     * NEW BROKER THAT HAS NOT BEEN SAVED YET
     * ============================================================
     *
     * If the broker was added during this review session,
     * simply remove the pending "create" operation.
     */
    if (typeof assignmentId === "string" && assignmentId.startsWith("temp-")) {
      setData((prev: any) => {
        if (!prev) return prev;

        return {
          ...prev,
          contacts: (prev.contacts ?? []).filter(
            (contact: any) => contact.contact_assignment_id !== assignmentId,
          ),
        };
      });

      setBrokerChanges((prev) =>
        prev.filter((change) => change.temp_id !== assignmentId),
      );

      toast.success("Broker removed from review");

      return;
    }

    /*
     * ============================================================
     * EXISTING BROKER
     * ============================================================
     *
     * Do NOT DELETE from the database yet.
     *
     * Mark the assignment as "delete" and remove it from the
     * visible table.
     */
    setData((prev: any) => {
      if (!prev) return prev;

      return {
        ...prev,
        contacts: (prev.contacts ?? []).filter(
          (contact: any) => contact.contact_assignment_id !== assignmentId,
        ),
      };
    });

    setBrokerChanges((prev) => {
      const existingIndex = prev.findIndex(
        (change) => change.contact_assignment_id === assignmentId,
      );

      const deleteChange = {
        contact_assignment_id: assignmentId,
        action: "delete",
      };

      /*
       * If the broker was already modified during this review,
       * replace that modification with delete.
       */
      if (existingIndex !== -1) {
        const updated = [...prev];
        updated[existingIndex] = deleteChange;

        return updated;
      }

      return [...prev, deleteChange];
    });

    toast.success("Broker removal saved for approval");
  };

  function handleChange(field: string, value: any) {
    setForm((prev: any) => ({
      ...prev,
      [field]: value,
    }));
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

  const resetRentScheduleForm = () => {
    setRentScheduleForm({
      term: "",
      startDate: "",
      endDate: "",
      monthlyRent: "",
      annualRent: "",
      rentIncreasePercent: "",
      psf: "",
      capRate: "",
    });

    setEditingRentSchedule(null);
  };

  const handleAddRentSchedule = () => {
    resetRentScheduleForm();
    setRentScheduleDialogOpen(true);
  };

  const handleEditRentSchedule = (schedule: any) => {
    setEditingRentSchedule(schedule);

    setRentScheduleForm({
      term: schedule.term ?? "",
      startDate: schedule.startDate ?? schedule.startDateRaw ?? "",
      endDate: schedule.endDate ?? schedule.endDateRaw ?? "",
      monthlyRent:
        schedule.monthlyRent != null ? String(schedule.monthlyRent) : "",
      annualRent:
        schedule.annualRent != null ? String(schedule.annualRent) : "",
      rentIncreasePercent:
        schedule.rentIncreasePercent != null
          ? String(schedule.rentIncreasePercent)
          : "",
      psf: schedule.psf != null ? String(schedule.psf) : "",
      capRate: schedule.capRate != null ? String(schedule.capRate) : "",
    });

    setRentScheduleDialogOpen(true);
  };

  const handleSaveRentSchedule = async () => {
    const missing: string[] = [];

    if (!rentScheduleForm.startDate.trim()) {
      missing.push("Start Date");
    }

    if (
      !rentScheduleForm.psf.trim() &&
      !rentScheduleForm.monthlyRent.trim() &&
      !rentScheduleForm.annualRent.trim()
    ) {
      missing.push("PSF, Monthly Rent, or Annual Rent");
    }

    if (missing.length > 0) {
      toast.error(`Required fields: ${missing.join(", ")}`);
      return;
    }

    setRentScheduleSubmitting(true);

    try {
      const scheduleData = {
        term: rentScheduleForm.term.trim() || null,
        startDate: rentScheduleForm.startDate.trim() || null,
        endDate: rentScheduleForm.endDate.trim() || null,

        monthlyRent: rentScheduleForm.monthlyRent.trim()
          ? Number(rentScheduleForm.monthlyRent)
          : null,

        annualRent: rentScheduleForm.annualRent.trim()
          ? Number(rentScheduleForm.annualRent)
          : null,

        rentIncreasePercent: rentScheduleForm.rentIncreasePercent.trim()
          ? Number(rentScheduleForm.rentIncreasePercent)
          : null,

        psf: rentScheduleForm.psf.trim() ? Number(rentScheduleForm.psf) : null,

        capRate: rentScheduleForm.capRate.trim()
          ? Number(rentScheduleForm.capRate)
          : null,
      };

      /*
       * ============================================================
       * CREATE
       * ============================================================
       */
      if (!editingRentSchedule) {
        const tempId = `temp-rent-${crypto.randomUUID()}`;

        const newSchedule = {
          ...scheduleData,

          id: tempId,

          // Used only by the UI
          _temp_id: tempId,
          _action: "create",
        };

        setRentSchedule((prev) => [...prev, newSchedule]);

        setRentScheduleChanges((prev) => [
          ...prev,
          {
            ...scheduleData,
            temp_id: tempId,
            action: "create",
          },
        ]);

        toast.success("Rent schedule added to review");

        setRentScheduleDialogOpen(false);
        resetRentScheduleForm();

        return;
      }

      /*
       * ============================================================
       * UPDATE
       * ============================================================
       */

      const scheduleId =
        editingRentSchedule.id ?? editingRentSchedule.rent_schedule_id;

      /*
       * If this is a temporary schedule, it has never
       * been committed to the database.
       */
      if (
        typeof scheduleId === "string" &&
        scheduleId.startsWith("temp-rent-")
      ) {
        const updatedSchedule = {
          ...editingRentSchedule,
          ...scheduleData,
          id: scheduleId,
          _temp_id: scheduleId,
          _action: "create",
        };

        setRentSchedule((prev) =>
          prev.map((schedule) =>
            schedule.id === scheduleId ? updatedSchedule : schedule,
          ),
        );

        setRentScheduleChanges((prev) =>
          prev.map((change) =>
            change.temp_id === scheduleId
              ? {
                  ...scheduleData,
                  temp_id: scheduleId,
                  action: "create",
                }
              : change,
          ),
        );

        toast.success("Rent schedule changes saved for review");

        setRentScheduleDialogOpen(false);
        resetRentScheduleForm();

        return;
      }

      /*
       * Existing database schedule
       */
      const updatedSchedule = {
        ...editingRentSchedule,
        ...scheduleData,
        id: scheduleId,
        _action: "update",
      };

      setRentSchedule((prev) =>
        prev.map((schedule) =>
          (schedule.id ?? schedule.rent_schedule_id) === scheduleId
            ? updatedSchedule
            : schedule,
        ),
      );

      setRentScheduleChanges((prev) => {
        const existingIndex = prev.findIndex(
          (change) => change.rent_schedule_id === scheduleId,
        );

        const change = {
          ...scheduleData,
          rent_schedule_id: scheduleId,
          action: "update",
        };

        if (existingIndex === -1) {
          return [...prev, change];
        }

        const updated = [...prev];
        updated[existingIndex] = change;

        return updated;
      });

      toast.success("Rent schedule changes saved for approval");

      setRentScheduleDialogOpen(false);
      resetRentScheduleForm();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save rent schedule",
      );
    } finally {
      setRentScheduleSubmitting(false);
    }
  };

  const handleDeleteRentSchedule = async (schedule: any) => {
    const scheduleId = schedule.id ?? schedule.rent_schedule_id;

    if (!window.confirm("Remove this rent schedule from the property?")) {
      return;
    }

    /*
     * ============================================================
     * TEMPORARY SCHEDULE
     * ============================================================
     */
    if (typeof scheduleId === "string" && scheduleId.startsWith("temp-rent-")) {
      setRentSchedule((prev) =>
        prev.filter(
          (item) => (item.id ?? item.rent_schedule_id) !== scheduleId,
        ),
      );

      setRentScheduleChanges((prev) =>
        prev.filter((change) => change.temp_id !== scheduleId),
      );

      toast.success("Rent schedule removed from review");

      return;
    }

    /*
     * ============================================================
     * EXISTING DATABASE SCHEDULE
     * ============================================================
     */

    setRentSchedule((prev) =>
      prev.filter((item) => (item.id ?? item.rent_schedule_id) !== scheduleId),
    );

    setRentScheduleChanges((prev) => {
      const existingIndex = prev.findIndex(
        (change) => change.rent_schedule_id === scheduleId,
      );

      const deleteChange = {
        rent_schedule_id: scheduleId,
        action: "delete",
      };

      if (existingIndex === -1) {
        return [...prev, deleteChange];
      }

      const updated = [...prev];
      updated[existingIndex] = deleteChange;

      return updated;
    });

    toast.success("Rent schedule removal saved for approval");
  };

  /* -------------------------------------------
    APPROVE FUNCTION
  --------------------------------------------*/
  async function handleApprove() {
    if (!propertyId) return;

    const hasBrokerChanges = brokerChanges.length > 0;
    const hasRentScheduleChanges = rentScheduleChanges.length > 0;
    const hasLeaseChanges = leaseChanges.length > 0;

    setProcessing(true);

    toast.promise(
      (async () => {
        /*
         * ============================================================
         * 1. SAVE PROPERTY CHANGES
         * ============================================================
         */
        const updateRes = await fetch(`/api/properties/${propertyId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: form.name ?? null,
            type: form.type ?? null,
            landlord: form.landlord ?? null,
            status: form.status ?? null,
            address: form.address ?? null,
            city: form.city ?? null,
            state: form.state ?? null,
            size: form.size ? Number(form.size) : null,
            price: form.price ? Number(form.price) : null,
            cap_rate: form.cap_rate ?? null,
            sale_date: form.sale_date || null,
            comments: form.comments ?? null,
            tenancytype: form.tenancytype ?? null,
          }),
        });

        const updateJson = await updateRes.json();

        if (!updateRes.ok || !updateJson.success) {
          throw new Error(updateJson.message || "Failed to update property");
        }

        /*
         * Keep UI in sync
         */
        setData((prev: any) => ({
          ...prev,
          property: updateJson.data ?? {
            ...prev.property,
            ...form,
          },
        }));

        /*
         * ============================================================
         * 2. SAVE PENDING BROKER CHANGES
         * ============================================================
         *
         * brokerChanges contains:
         *
         *   action: "create"
         *   action: "update"
         *   action: "delete"
         *
         * Nothing was written to the database while reviewing.
         * This is the point where we commit those changes.
         */
        if (brokerChanges.length > 0) {
          const brokerRes = await fetch("/api/properties/broker", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              property_id: propertyId,
              changes: brokerChanges,
            }),
          });

          const brokerJson = await brokerRes.json();

          if (!brokerRes.ok || !brokerJson.success) {
            throw new Error(
              brokerJson.message || "Failed to save broker changes",
            );
          }
        }

        /*
         * ============================================================
         * 3. SAVE PENDING RENT SCHEDULE CHANGES
         * ============================================================
         */
        if (rentScheduleChanges.length > 0) {
          const rentScheduleRes = await fetch("/api/properties/rent-schedule", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              property_id: propertyId,
              changes: rentScheduleChanges,
            }),
          });

          const rentScheduleJson = await rentScheduleRes.json();

          if (!rentScheduleRes.ok || !rentScheduleJson.success) {
            throw new Error(
              rentScheduleJson.message ||
                "Failed to save rent schedule changes",
            );
          }
        }

        /*
         * ============================================================
         * 4. SAVE PENDING LEASE CHANGES
         * ============================================================
         *
         * Lease changes are committed only when the property
         * reviewer clicks Approve.
         */
        if (leaseChanges.length > 0) {
          for (const change of leaseChanges) {
            if (change.action === "delete") {
              const deleteRes = await fetch(`/api/lease/${change.lease_id}`, {
                method: "DELETE",
              });

              const deleteJson = await deleteRes.json();

              if (!deleteRes.ok || !deleteJson.success) {
                throw new Error(
                  deleteJson.message ||
                    `Failed to delete lease ${change.lease_id}`,
                );
              }
            }
          }
        }

        /*
         * ============================================================
         * 5. APPROVE PROPERTY
         * ============================================================
         */
        const approveRes = await fetch("/api/review/action", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            propertyId,
            action: "approve",
          }),
        });

        const approveJson = await approveRes.json();

        if (!approveRes.ok || !approveJson.success) {
          throw new Error(
            approveJson.error ||
              approveJson.message ||
              "Failed to approve property",
          );
        }

        /*
         * Clear pending broker changes after successful approval.
         */
        setBrokerChanges([]);
        setRentScheduleChanges([]);
        setLeaseChanges([]);
        return approveJson;
      })(),
      {
        loading: brokerChanges.length
          ? "Saving property and broker changes, then approving..."
          : "Saving changes and approving property...",

        success: () => {
          setApproveOpen(false);

          window.dispatchEvent(new Event("review-count-updated"));

          router.push("/dashboard/review");
          router.refresh();

          if (hasBrokerChanges && hasRentScheduleChanges && hasLeaseChanges) {
            return "Property, tenant, broker, and rent schedule changes approved successfully";
          }

          if (hasBrokerChanges && hasRentScheduleChanges) {
            return "Property, broker, and rent schedule changes approved successfully";
          }

          if (hasBrokerChanges && hasLeaseChanges) {
            return "Property, tenant, and broker changes approved successfully";
          }

          if (hasRentScheduleChanges && hasLeaseChanges) {
            return "Property, tenant, and rent schedule changes approved successfully";
          }

          if (hasLeaseChanges) {
            return "Property and tenant changes approved successfully";
          }

          if (hasBrokerChanges) {
            return "Property and broker changes approved successfully";
          }

          if (hasRentScheduleChanges) {
            return "Property and rent schedule changes approved successfully";
          }

          return "Property updated and approved successfully";
        },

        error: (err) =>
          err instanceof Error ? err.message : "Failed to approve property",

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
        /*
         * Broker changes are only stored in React state.
         * Rejecting the property therefore automatically discards
         * those pending changes.
         */

        const res = await fetch(`/api/properties/${propertyId}`, {
          method: "DELETE",
        });

        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.message || "Failed to reject property");
        }

        /*
         * Clear any pending broker changes from memory.
         */
        setBrokerChanges([]);

        return json;
      })(),
      {
        loading: "Rejecting property...",

        success: () => {
          setRejectOpen(false);

          window.dispatchEvent(new Event("review-count-updated"));

          router.push("/dashboard/review");
          router.refresh();

          return "Property rejected successfully";
        },

        error: (err) =>
          err instanceof Error ? err.message : "Failed to reject property",

        finally: () => {
          setProcessing(false);
        },
      },
    );
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

    const selectedId =
      selectedSchedules[lease.lease_id] ?? getDefaultScheduleId(lease);

    return (
      lease.rent_schedules.find(
        (x: any) => x.rent_schedule_id === selectedId,
      ) ?? null
    );
  };

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
          <InfoItem
            label="Name"
            value={form.name}
            editable={true}
            onChange={(v) => handleChange("name", v)}
          />

          <InfoItem
            label="Type"
            value={form.type}
            editable={true}
            onChange={(v) => handleChange("type", v)}
          />

          <InfoItem
            label="Landlord"
            value={form.landlord}
            editable={true}
            onChange={(v) => handleChange("landlord", v)}
          />

          <InfoItem
            label="Status"
            value={form.status}
            editable={true}
            onChange={(v) => handleChange("status", v)}
          />

          <InfoItem
            label="Tenancy Type"
            value={form.tenancytype}
            editable={true}
            type="select"
            options={[
              { label: "Single Tenant", value: "SingleTenant" },
              { label: "Multi Tenant", value: "MultiTenant" },
            ]}
            onChange={(v) => handleChange("tenancytype", v)}
          />

          <InfoItem
            label="Property Size (Square Feet/SF)"
            value={form.size}
            editable={true}
            onChange={(v) => handleChange("size", v)}
          />

          <div>
            <Label className="text-gray-700 font-medium">File</Label>
            {data?.documentFiles?.file_url ? (
              <Button
                onClick={handleDownloadBrochure}
                disabled={!data?.documentFiles?.file_url || downloadingBrochure}
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
            value={form.address}
            editable={true}
            onChange={(v) => handleChange("address", v)}
          />

          <InfoItem
            label="City"
            value={form.city}
            editable={true}
            onChange={(v) => handleChange("city", v)}
          />

          <InfoItem
            label="State"
            value={form.state}
            editable={true}
            onChange={(v) => handleChange("state", v)}
          />

          <div className="space-y-1">
            <Label className="text-gray-700 font-medium">Location</Label>

            <a
              href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
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
            value={form.price}
            editable={true}
            onChange={(v) => handleChange("price", v)}
          />

          <InfoItem
            label="Cap Rate"
            value={form.cap_rate}
            editable={true}
            onChange={(v) =>
              handleChange("cap_rate", v.replace(/[^0-9./%]/g, ""))
            }
          />

          <InfoItem
            label="Sale Date"
            value={form.sale_date}
            editable={true}
            onChange={(v) => handleChange("sale_date", v)}
          />
        </Grid2>
      </InfoSection>

      {/* LEASES */}
      <InfoSection
        icon={<Users />}
        title={
          <div className="flex items-center justify-between w-full">
            <span>Tenant</span>

            <Button
              size="sm"
              onClick={handleAddTenant}
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Tenant
            </Button>
          </div>
        }
      >
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
              <Table containerClassName="max-h-[400px] border rounded-md">
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

                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              router.push(
                                `/dashboard/leases/${lease.lease_id}?fromReview=true`,
                              )
                            }
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <Edit size={16} className="mr-1" />
                            Update
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteTenant(lease)}
                            className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                          >
                            <CircleX size={16} className="mr-1" />
                            Remove
                          </Button>
                        </div>
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
              <Table containerClassName="max-h-[400px] border rounded-md">
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

                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              router.push(
                                `/dashboard/leases/${lease.lease_id}?fromReview=true`,
                              )
                            }
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <Edit size={16} className="mr-1" />
                            Update
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteTenant(lease)}
                            className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                          >
                            <CircleX size={16} className="mr-1" />
                            Remove
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </InfoSection>

      {/* RENT SCHEDULE */}
      <InfoSection icon={<DollarSign />} title="Rent Schedule">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-gray-500">
              Rent schedule and rental escalation information for this property.
            </p>
          </div>

          <Button
            type="button"
            onClick={handleAddRentSchedule}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
          >
            <DollarSign className="w-4 h-4" />
            Add Rent Schedule
          </Button>
        </div>

        {rentSchedule.length === 0 ? (
          <div className="border rounded-md p-8 text-center">
            <DollarSign className="w-10 h-10 mx-auto text-gray-400 mb-3" />

            <p className="text-gray-500 font-medium">
              No rent schedule available.
            </p>

            <p className="text-sm text-gray-400 mt-1">
              Click &quot;Add Rent Schedule&quot; to add one.
            </p>
          </div>
        ) : (
          (() => {
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
              <Table containerClassName="max-h-[400px] border rounded-md">
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

                    <TableHead className="text-center w-[170px]">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {rentSchedule.map((r) => {
                    const scheduleId = r.id ?? r.rent_schedule_id;

                    const startDateValue = r.startDate ?? r.startDateRaw ?? "-";

                    const endDateValue = r.endDate ?? r.endDateRaw ?? "-";

                    return (
                      <TableRow key={scheduleId}>
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
                            {r.rentIncreasePercent != null
                              ? `${r.rentIncreasePercent}%`
                              : "-"}
                          </TableCell>
                        )}

                        {columnVisibility.psf && (
                          <TableCell>
                            {r.psf != null
                              ? `$${Number(r.psf).toFixed(2)}`
                              : "-"}
                          </TableCell>
                        )}

                        {columnVisibility.capRate && (
                          <TableCell>
                            {r.capRate != null ? `${r.capRate}%` : "-"}
                          </TableCell>
                        )}

                        <TableCell>
                          <div className="flex justify-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditRentSchedule(r)}
                            >
                              <Pencil className="w-4 h-4 mr-1" />
                              Edit
                            </Button>

                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteRentSchedule(r)}
                              className="text-red-600 border-red-200 hover:bg-red-50"
                            >
                              <CircleX className="w-4 h-4 mr-1" />
                              Remove
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            );
          })()
        )}

        <RentScheduleDialog
          open={rentScheduleDialogOpen}
          onOpenChange={(open) => {
            setRentScheduleDialogOpen(open);

            if (!open) {
              resetRentScheduleForm();
            }
          }}
          form={rentScheduleForm}
          setForm={setRentScheduleForm}
          editingSchedule={editingRentSchedule}
          submitting={rentScheduleSubmitting}
          onSubmit={handleSaveRentSchedule}
        />
      </InfoSection>

      {/* BROKERS */}
      <InfoSection icon={<Users />} title="Brokers">
        {/* HEADER / ADD BUTTON */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-gray-500">
              Brokers and listing contacts assigned to this property.
            </p>
          </div>

          <Button
            type="button"
            onClick={handleAddBroker}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
          >
            <Users className="w-4 h-4" />
            Add Broker
          </Button>
        </div>

        {/* BROKER TABLE */}
        {contacts.length === 0 ? (
          <div className="border rounded-md p-8 text-center">
            <Users className="w-10 h-10 mx-auto text-gray-400 mb-3" />

            <p className="text-gray-500 font-medium">
              No brokers assigned to this property.
            </p>

            <p className="text-sm text-gray-400 mt-1">
              Click &quot;Add Broker&quot; to assign a broker or listing
              contact.
            </p>
          </div>
        ) : (
          <Table containerClassName="max-h-[400px] border rounded-md">
            <TableHeader>
              <TableRow>
                <TableHead>Relationship</TableHead>
                <TableHead>Listing Company</TableHead>
                <TableHead>Broker</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Website</TableHead>
                <TableHead>Comments</TableHead>
                <TableHead className="text-center w-[150px]">Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {contacts.map((c: any) => (
                <TableRow key={c.contact_assignment_id}>
                  {/* RELATIONSHIP */}
                  <TableCell>
                    {display(normalizeBrokerText(c.relationship).join(", "))}
                  </TableCell>

                  {/* LISTING COMPANY */}
                  <TableCell>{display(c.listing_company)}</TableCell>

                  {/* BROKER */}
                  <TableCell>
                    {display(normalizeBrokerText(c.broker_name).join(", "))}
                  </TableCell>

                  {/* PHONE */}
                  <TableCell>
                    {display(normalizeBrokerText(c.phone).join(", "))}
                  </TableCell>

                  {/* EMAIL */}
                  <TableCell>
                    {display(
                      normalizeBrokerText(c.email)
                        .map((e) => e.replace(/-/g, "."))
                        .join(", "),
                    )}
                  </TableCell>

                  {/* WEBSITE */}
                  <TableCell>{display(c.website)}</TableCell>

                  {/* COMMENTS */}
                  <TableCell className="max-w-[250px]">
                    <div className="truncate" title={c.comments || ""}>
                      {display(c.comments)}
                    </div>
                  </TableCell>

                  {/* ACTIONS */}
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                      {/* EDIT */}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditBroker(c)}
                        className="flex items-center gap-1"
                      >
                        <Pencil className="w-4 h-4" />
                        Edit
                      </Button>

                      {/* REMOVE */}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteBroker(c)}
                        className="flex items-center gap-1 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                      >
                        <CircleX className="w-4 h-4" />
                        Remove
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* BROKER DIALOG */}
        <BrokerDialog
          open={brokerDialogOpen}
          onOpenChange={(open) => {
            setBrokerDialogOpen(open);

            if (!open) {
              resetBrokerForm();
            }
          }}
          form={brokerForm}
          setForm={setBrokerForm}
          editingBroker={editingBroker}
          submitting={brokerSubmitting}
          onSubmit={handleSaveBroker}
        />
      </InfoSection>

      {/* COMMENTS */}
      <InfoSection icon={<ClipboardList />} title="Comments">
        <textarea
          className="w-full border rounded-md px-3 py-2 text-sm"
          value={form.comments || ""}
          onChange={(e) => handleChange("comments", e.target.value)}
        />
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

      {/* ACTION BUTTONS ROW */}
      <div className="flex items-center justify-between pt-4 border-t">
        {/* LEFT SIDE → Back */}
        <Button
          variant="outline"
          className="flex items-center gap-2"
          onClick={() => router.back()}
          disabled={processing}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        {/* RIGHT SIDE → Approve / Reject */}
        <div className="flex gap-3">
          <Button
            disabled={processing}
            onClick={handleApprove}
            className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
          >
            {processing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            {processing ? "Approving..." : "Approve"}
          </Button>

          <Button
            disabled={processing}
            onClick={handleReject}
            className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
          >
            {processing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            {processing ? "Rejecting..." : "Reject"}
          </Button>
        </div>
      </div>

      <Dialog
        open={approveOpen}
        onOpenChange={(open) => {
          if (!processing) setApproveOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Property?</DialogTitle>
            <DialogDescription>
              Any changes you&apos;ve made will be saved before the property is
              approved.
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
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving & Approving...
                </>
              ) : (
                "Confirm Approve"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={rejectOpen}
        onOpenChange={(open) => {
          if (!processing) setRejectOpen(open);
        }}
      >
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
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Rejecting...
                </>
              ) : (
                "Confirm Reject"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTenantOpen}
        onOpenChange={(open) => {
          if (!deletingTenant) {
            setDeleteTenantOpen(open);

            if (!open) {
              setTenantToDelete(null);
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <CircleX className="w-5 h-5" />
              Delete Tenant?
            </DialogTitle>

            <DialogDescription>
              This will permanently delete the tenant lease from this property.
              <br />
              <br />
              <span className="font-semibold text-gray-900">
                {tenantToDelete?.tenant || "Unnamed Tenant"}
              </span>
              {tenantToDelete?.suite_unit && (
                <> — Unit {tenantToDelete.suite_unit}</>
              )}
              <br />
              <br />
              <span className="text-red-600 font-medium">
                This action cannot be undone.
              </span>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={deletingTenant}
              onClick={() => {
                setDeleteTenantOpen(false);
                setTenantToDelete(null);
              }}
            >
              Cancel
            </Button>

            <Button
              disabled={deletingTenant}
              onClick={handleDeleteTenant}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deletingTenant ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <CircleX className="w-4 h-4 mr-2" />
                  Delete Tenant
                </>
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
  title: React.ReactNode;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-lg font-semibold text-gray-800">
        {icon}
        {title}
      </div>

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
    return [...new Set(value)].filter(Boolean).join(", ");
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

const getDefaultScheduleId = (lease: any): string => {
  const schedules = lease.rent_schedules ?? [];

  if (schedules.length === 0) return "";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find the schedule that contains today's date
  const current = schedules.find((s: any) => {
    const start = new Date(s.start_date);
    start.setHours(0, 0, 0, 0);

    const end = s.end_date ? new Date(s.end_date) : null;
    end?.setHours(23, 59, 59, 999);

    return today >= start && (!end || today <= end);
  });

  if (current) {
    return current.rent_schedule_id;
  }

  // Otherwise use the last schedule
  return schedules[schedules.length - 1].rent_schedule_id;
};

function BrokerDialog({
  open,
  onOpenChange,
  form,
  setForm,
  editingBroker,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: any;
  setForm: React.Dispatch<React.SetStateAction<any>>;
  editingBroker: any | null;
  submitting: boolean;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>
            {editingBroker ? "Update Broker" : "Add Broker"}
          </DialogTitle>

          <DialogDescription>
            {editingBroker
              ? "Update the broker information assigned to this property."
              : "Add a broker or listing contact to this property."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* BROKER + COMPANY */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-500" />
                Broker Name
                <span className="text-red-500">*</span>
              </Label>

              <Input
                value={form.broker_name}
                onChange={(e) =>
                  setForm((prev: any) => ({
                    ...prev,
                    broker_name: e.target.value,
                  }))
                }
                placeholder="Broker Name"
              />
            </div>

            <div>
              <Label className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-gray-500" />
                Listing Company
                <span className="text-red-500">*</span>
              </Label>

              <Input
                value={form.listing_company}
                onChange={(e) =>
                  setForm((prev: any) => ({
                    ...prev,
                    listing_company: e.target.value,
                  }))
                }
                placeholder="Listing Company"
              />
            </div>
          </div>

          {/* CONTACT */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-500" />
                Phone
                <span className="text-red-500">*</span>
              </Label>

              <Input
                value={form.phone}
                onChange={(e) =>
                  setForm((prev: any) => ({
                    ...prev,
                    phone: e.target.value,
                  }))
                }
                placeholder="Phone"
              />
            </div>

            <div>
              <Label className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-500" />
                Email
                <span className="text-red-500">*</span>
              </Label>

              <Input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((prev: any) => ({
                    ...prev,
                    email: e.target.value,
                  }))
                }
                placeholder="Email Address"
              />
            </div>
          </div>

          {/* WEBSITE */}
          <div>
            <Label className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-gray-500" />
              Website
            </Label>

            <Input
              value={form.website}
              onChange={(e) =>
                setForm((prev: any) => ({
                  ...prev,
                  website: e.target.value,
                }))
              }
              placeholder="https://example.com"
            />
          </div>

          {/* RELATIONSHIP */}
          <div>
            <Label>Relationship</Label>

            <Input
              value={form.relationship}
              onChange={(e) =>
                setForm((prev: any) => ({
                  ...prev,
                  relationship: e.target.value,
                }))
              }
              placeholder="Listing Broker, Tenant Rep, Owner Rep..."
            />
          </div>

          {/* COMMENTS */}
          <div>
            <Label>Comments</Label>

            <textarea
              value={form.comments}
              onChange={(e) =>
                setForm((prev: any) => ({
                  ...prev,
                  comments: e.target.value,
                }))
              }
              rows={4}
              className="w-full rounded-md border mt-2 border-gray-300 bg-white px-3 py-3 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Additional notes..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>

          <Button
            type="button"
            disabled={submitting}
            onClick={onSubmit}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {editingBroker ? "Save Changes" : "Add Broker"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RentScheduleDialog({
  open,
  onOpenChange,
  form,
  setForm,
  editingSchedule,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: any;
  setForm: React.Dispatch<React.SetStateAction<any>>;
  editingSchedule: any | null;
  submitting: boolean;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editingSchedule ? "Update Rent Schedule" : "Add Rent Schedule"}
          </DialogTitle>

          <DialogDescription>
            {editingSchedule
              ? "Update the rent schedule information for this property."
              : "Add a rent schedule to this property."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* TERM */}
          <div>
            <Label>Term</Label>

            <Input
              value={form.term}
              onChange={(e) =>
                setForm((prev: any) => ({
                  ...prev,
                  term: e.target.value,
                }))
              }
              placeholder="Year 1, Year 2, Renewal..."
            />
          </div>

          {/* DATES */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>
                Start Date
                <span className="text-red-500">*</span>
              </Label>

              <Input
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm((prev: any) => ({
                    ...prev,
                    startDate: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <Label>End Date</Label>

              <Input
                type="date"
                value={form.endDate}
                onChange={(e) =>
                  setForm((prev: any) => ({
                    ...prev,
                    endDate: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          {/* RENT */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Monthly Rent</Label>

              <Input
                type="number"
                step="0.01"
                value={form.monthlyRent}
                onChange={(e) =>
                  setForm((prev: any) => ({
                    ...prev,
                    monthlyRent: e.target.value,
                  }))
                }
                placeholder="0.00"
              />
            </div>

            <div>
              <Label>Annual Rent</Label>

              <Input
                type="number"
                step="0.01"
                value={form.annualRent}
                onChange={(e) =>
                  setForm((prev: any) => ({
                    ...prev,
                    annualRent: e.target.value,
                  }))
                }
                placeholder="0.00"
              />
            </div>
          </div>

          {/* PSF + INCREASE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Rent PSF</Label>

              <Input
                type="number"
                step="0.01"
                value={form.psf}
                onChange={(e) =>
                  setForm((prev: any) => ({
                    ...prev,
                    psf: e.target.value,
                  }))
                }
                placeholder="0.00"
              />
            </div>

            <div>
              <Label>Rent Increase %</Label>

              <Input
                type="number"
                step="0.01"
                value={form.rentIncreasePercent}
                onChange={(e) =>
                  setForm((prev: any) => ({
                    ...prev,
                    rentIncreasePercent: e.target.value,
                  }))
                }
                placeholder="0.00"
              />
            </div>
          </div>

          {/* CAP RATE */}
          <div>
            <Label>Cap Rate %</Label>

            <Input
              type="number"
              step="0.01"
              value={form.capRate}
              onChange={(e) =>
                setForm((prev: any) => ({
                  ...prev,
                  capRate: e.target.value,
                }))
              }
              placeholder="0.00"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>

          <Button
            type="button"
            disabled={submitting}
            onClick={onSubmit}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {editingSchedule ? "Save Changes" : "Add Rent Schedule"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
