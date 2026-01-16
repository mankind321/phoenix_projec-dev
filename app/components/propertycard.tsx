/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Building,
  Search,
} from "lucide-react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectItem,
  SelectContent,
} from "@/components/ui/select";
import { toast } from "sonner";

import {
  GoogleMap,
  Marker,
  MarkerClusterer,
  InfoWindow,
  useJsApiLoader,
} from "@react-google-maps/api";
import { Can } from "./can";

interface Property {
  property_id: string;
  name: string;
  landlord: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  type: string | null;
  status: string | null;
  price: number | null;
  price_usd: string | null;
  cap_rate: number | null;
  file_url: string | null;
  latitude: number | null;
  longitude: number | null;
}

const MAP_CONTAINER_STYLE: React.CSSProperties = {
  width: "100%",
  height: "100%",
};

// -------------------------------
// 🔥 AI QUERY DETECTOR (Frontend)
// -------------------------------
function isAiQueryFrontend(text: string): boolean {
  if (!text) return false;

  const t = text.toLowerCase().trim();

  // Single-word queries → NOT AI
  if (!t.includes(" ")) return false;

  const aiKeywords = [
    "near",
    "around",
    "within",
    "from",
    "close to",
    "beside",
    "next to",
    "in ",
    "km",
    "m ",
    "meter",
    "mile",
    "radius",
  ];

  if (aiKeywords.some((k) => t.includes(k))) return true;

  // >= 3 words → natural language
  if (t.split(" ").length >= 3) return true;

  return false;
}

export default function PropertyCardTable() {
  const [data, setData] = React.useState<Property[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [limit] = React.useState(9);
  const [total, setTotal] = React.useState(0);

  const [search, setSearch] = React.useState("");
  const [searchInput, setSearchInput] = React.useState("");

  const [sortField, setSortField] = React.useState("property_created_at");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const router = useRouter();

  const [statusModalOpen, setStatusModalOpen] = React.useState(false);
  const [savingStatus, setSavingStatus] = React.useState(false);
  const [selectedStatusProperty, setSelectedStatusProperty] =
    React.useState<Property | null>(null);
  const [newStatus, setNewStatus] = React.useState<string>("");

  // Dropdown options (adjust these)
  const realPropertyStatuses = [
    "Available",
    "Occupied",
    "Under Maintenance",
    "Not Available",
  ];

  // Map state
  const [selectedProperty, setSelectedProperty] =
    React.useState<Property | null>(null);
  const mapRef = React.useRef<google.maps.Map | null>(null);
  const itemRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  const { isLoaded: isMapLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
  });

  const mapCenter = React.useMemo(() => {
    const withCoords = data.filter((p) => p.latitude && p.longitude);
    if (!withCoords.length) return { lat: 39.5, lng: -98.35 };

    const lat =
      withCoords.reduce((sum, p) => sum + p.latitude!, 0) / withCoords.length;
    const lng =
      withCoords.reduce((sum, p) => sum + p.longitude!, 0) / withCoords.length;

    return { lat, lng };
  }, [data]);

  // -----------------------------
  // 🔍 Fetch properties
  // -----------------------------
  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);

      try {
        const params = new URLSearchParams();
        params.set("page", `${page}`);
        params.set("limit", `${limit}`);
        params.set("sortField", sortField);
        params.set("sortOrder", sortOrder);

        // 🔥 Decide traditional vs AI search
        if (search) {
          if (isAiQueryFrontend(search)) {
            params.set("query", search);
          } else {
            params.set("search", search);
          }
        }

        const res = await fetch(`/api/properties?${params.toString()}`);
        const json = await res.json();

        setData(json.data || []);
        setTotal(json.total || 0);
        setSelectedProperty(null);
      } catch (e) {
        console.error(e);
        setData([]);
        setTotal(0);
      }

      setIsLoading(false);
    };

    fetchData();
  }, [page, limit, search, sortField, sortOrder]);

  const handleOpenStatusDialog = async (p: Property) => {
    try {
      const res = await fetch(`/api/lease/active?property_id=${p.property_id}`);
      const json = await res.json();

      if (json.activeLease) {
        toast.error(
          "This property has an active lease. Status update not allowed."
        );
        return;
      }

      setSelectedStatusProperty(p);
      setNewStatus(p.status ?? "");
      setStatusModalOpen(true);
    } catch (err) {
      console.error(err);
      toast.error("Failed to verify lease status.");
    }
  };

  // Trigger search manually
  const triggerSearch = () => {
    setSearch(searchInput.trim());
    setPage(1);
  };

  // Sidebar click
  const handleListClick = (p: Property) => {
    setSelectedProperty(p);
    if (mapRef.current && p.latitude && p.longitude) {
      mapRef.current.panTo({ lat: p.latitude, lng: p.longitude });
      mapRef.current.setZoom(10);
    }
  };

  const handleMarkerClick = (p: Property) => {
    setSelectedProperty(p);
    const el = itemRefs.current[p.property_id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleViewDetails = (p: Property) => {
    router.push(`/dashboard/properties/${p.property_id}`);
  };

  const handleSaveStatus = async () => {
    if (!selectedStatusProperty) return;
    if (!newStatus) {
      toast.error("Please select a status.");
      return;
    }

    try {
      setSavingStatus(true); // 🟦 start loading

      const res = await fetch(`/api/properties/update-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: selectedStatusProperty.property_id,
          status: newStatus,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error || "Failed to update status.");
        return;
      }

      toast.success("Status updated successfully.");

      // Refresh UI
      setStatusModalOpen(false);
      setPage(1);
      triggerSearch();
    } catch (error) {
      console.error(error);
      toast.error("Error updating status.");
    } finally {
      setSavingStatus(false); // 🟩 stop loading
    }
  };

  const onMapLoad = (map: google.maps.Map) => {
    mapRef.current = map;

    const withCoords = data.filter((p) => p.latitude && p.longitude);
    if (!withCoords.length) return;

    const bounds = new google.maps.LatLngBounds();
    withCoords.forEach((p) =>
      bounds.extend({ lat: p.latitude!, lng: p.longitude! })
    );

    map.fitBounds(bounds);
  };

  // -----------------------------
  // UI OUTPUT
  // -----------------------------
  return (
    <div className="w-11/12 mx-auto mt-6 space-y-4">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-center bg-white">
        <div>
          <div className="flex items-center gap-2">
            <Building className="w-6 h-6 text-gray-700" />
            <h2 className="text-xl font-semibold">Search Listings</h2>
          </div>
          <p className="text-sm text-gray-500">
            View and search available properties.
          </p>
        </div>

        {/* SEARCH BAR */}
        <div className="flex gap-3 items-center">
          <Input
            placeholder="Find properties by name, city, or even natural language…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") triggerSearch();
            }}
            className="w-[700px] text-base"
          />

          <Button
            onClick={triggerSearch}
            className="bg-blue-700 hover:bg-blue-500 text-white px-6 mt-2"
          >
            <Search />
            Search
          </Button>
        </div>
      </div>

      {/* MAIN LAYOUT */}
      <div className="flex h-[650px] border rounded-md overflow-hidden bg-white">
        {/* SIDEBAR */}
        <div className="relative w-full md:w-[35%] lg:w-[32%] border-r">
          <div className="overflow-y-auto h-[calc(650px-60px)]">
            <div className="px-4 py-2 border-b text-sm bg-gray-50">
              {isLoading ? "Loading…" : `${total} results`}
            </div>

            {isLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="animate-spin" size={28} />
              </div>
            ) : (
              data.map((p) => {
                const isActive =
                  selectedProperty?.property_id === p.property_id;

                return (
                  <div
                    key={p.property_id}
                    ref={(el) => {
                      itemRefs.current[p.property_id] = el;
                    }}
                    onClick={() => handleListClick(p)}
                    className={`cursor-pointer border-b px-4 py-3 flex flex-col gap-2 ${
                      isActive ? "bg-blue-50" : "bg-white"
                    } hover:bg-blue-50/60`}
                  >
                    <div className="flex gap-3">
                      <div className="flex-1 text-xs">
                        <div className="text-[10px] font-semibold text-blue-700 uppercase">
                          {p.status ?? "Status unknown"}
                        </div>

                        <div className="font-semibold text-sm">{p.name}</div>

                        <div className="text-gray-600 mt-1 flex items-center gap-1">
                          <MapPin size={12} />

                          {(() => {
                            const fullAddress = [p.address, p.city, p.state]
                              .filter((v) => v && v.trim() !== "")
                              .join(", ");
                            return fullAddress || "—";
                          })()}
                        </div>

                        <div className="flex justify-between mt-2">
                          <span>Type</span>
                          <span className="font-medium">{p.type ?? "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Price</span>
                          <span className="font-medium">
                            {p.price
                              ? `$${p.price.toLocaleString()}`
                              : p.price_usd ?? "—"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Cap Rate</span>
                          <span className="font-medium">
                            {p.cap_rate ? `${p.cap_rate}%` : "—"}
                          </span>
                        </div>
                      </div>

                      <div className="w-24 h-20 relative rounded-md overflow-hidden">
                        <Image
                          src={
                            p.file_url ??
                            "https://placehold.co/300x200/png?text=No+Image"
                          }
                          alt={p.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    </div>

                    <div className="flex flex-row gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-blue-700 hover:bg-blue-500 text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetails(p);
                        }}
                      >
                        View Details
                      </Button>
                      <Can role={["Admin","Manager"]}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-blue-700 text-blue-700 hover:bg-blue-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenStatusDialog(p);
                          }}
                        >
                          Update Status
                        </Button>
                      </Can>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* PAGINATION */}
          <div className="absolute bottom-0 left-0 right-0 bg-white border-t px-4 py-3 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft size={16} />
              </Button>

              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        </div>

        {/* MAP */}
        <div className="hidden md:block flex-1">
          {isMapLoaded && (
            <GoogleMap
              mapContainerStyle={MAP_CONTAINER_STYLE}
              center={mapCenter}
              zoom={6}
              onLoad={onMapLoad}
              options={{
                streetViewControl: false,
                mapTypeControl: true,
                fullscreenControl: true,
              }}
            >
              <MarkerClusterer>
                {(clusterer: any) => (
                  <>
                    {data
                      .filter((p) => p.latitude && p.longitude)
                      .map((p) => (
                        <Marker
                          key={p.property_id}
                          clusterer={clusterer}
                          position={{
                            lat: p.latitude!,
                            lng: p.longitude!,
                          }}
                          onClick={() => handleMarkerClick(p)}
                        />
                      ))}
                  </>
                )}
              </MarkerClusterer>

              {selectedProperty &&
                selectedProperty.latitude &&
                selectedProperty.longitude && (
                  <InfoWindow
                    position={{
                      lat: selectedProperty.latitude,
                      lng: selectedProperty.longitude,
                    }}
                    onCloseClick={() => setSelectedProperty(null)}
                  >
                    <div className="max-w-[220px]">
                      <div className="text-[10px] font-semibold text-blue-700 uppercase mb-1">
                        {selectedProperty.status ?? "Status"}
                      </div>
                      <div className="font-semibold text-sm mb-1">
                        {selectedProperty.name}
                      </div>
                      <div className="text-xs text-gray-600 mb-2">
                        {(() => {
                          const fullAddress = [
                            selectedProperty.address,
                            selectedProperty.city,
                            selectedProperty.state,
                          ]
                            .filter((v) => v && v.trim() !== "")
                            .join(", ");

                          return fullAddress || "—";
                        })()}
                      </div>

                      <Button
                        size="sm"
                        className="w-full bg-blue-700 hover:bg-blue-500 text-white"
                        onClick={() => handleViewDetails(selectedProperty)}
                      >
                        View Details
                      </Button>
                    </div>
                  </InfoWindow>
                )}
            </GoogleMap>
          )}
        </div>
      </div>
      <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Property Status</DialogTitle>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            <p className="text-sm text-gray-600">
              Property:{" "}
              <span className="font-semibold">
                {selectedStatusProperty?.name}
              </span>
            </p>

            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>

              <SelectContent>
                {realPropertyStatuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusModalOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={savingStatus}
              onClick={handleSaveStatus}
              className="bg-blue-700 hover:bg-blue-500 text-white disabled:opacity-50"
            >
              {savingStatus ? "Saving…" : "Save Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
