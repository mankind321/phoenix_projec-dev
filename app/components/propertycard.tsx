/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, MapPin, ChevronLeft, ChevronRight, Building } from "lucide-react";
import Image from "next/image";

import {
  GoogleMap,
  Marker,
  MarkerClusterer,
  InfoWindow,
  useJsApiLoader,
} from "@react-google-maps/api";

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

export default function PropertyCardTable() {
  const [data, setData] = React.useState<Property[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(9);
  const [total, setTotal] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const [filterType, setFilterType] = React.useState("All");
  const [filterStatus, setFilterStatus] = React.useState("All");
  const [sortField, setSortField] = React.useState("property_created_at");
  const [types, setTypes] = React.useState<string[]>([]);
  const [status, setStatus] = React.useState<string[]>([]);
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const router = useRouter();

  // --- Map State ---
  const [selectedProperty, setSelectedProperty] = React.useState<Property | null>(null);
  const mapRef = React.useRef<google.maps.Map | null>(null);

  // sidebar item refs
  const itemRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  const { isLoaded: isMapLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
  });

  // Default map center (auto-compute)
  const mapCenter = React.useMemo(() => {
    const withCoords = data.filter((p) => p.latitude && p.longitude);
    if (!withCoords.length) return { lat: 39.5, lng: -98.35 };

    const lat = withCoords.reduce((sum, p) => sum + p.latitude!, 0) / withCoords.length;
    const lng = withCoords.reduce((sum, p) => sum + p.longitude!, 0) / withCoords.length;
    return { lat, lng };
  }, [data]);

  // Fetch properties
  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);

      try {
        const params = new URLSearchParams();
        params.set("page", `${page}`);
        params.set("limit", `${limit}`);

        if (search) params.set("search", search);
        if (filterType !== "All") params.set("type", filterType);
        if (filterStatus !== "All") params.set("status", filterStatus);

        params.set("sortField", sortField);
        params.set("sortOrder", sortOrder);

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
  }, [page, limit, search, filterType, filterStatus, sortField, sortOrder]);

  // Load distinct types
  React.useEffect(() => {
    fetch("/api/properties/type")
      .then((r) => r.json())
      .then((json) => json.success && setTypes(json.types));
  }, []);

  // Load distinct statuses
  React.useEffect(() => {
    fetch("/api/properties/status")
      .then((r) => r.json())
      .then((json) => json.success && setStatus(json.status));
  }, []);

  // Clicking a list item
  const handleListClick = (p: Property) => {
    setSelectedProperty(p);
    if (mapRef.current && p.latitude && p.longitude) {
      mapRef.current.panTo({ lat: p.latitude, lng: p.longitude });
      mapRef.current.setZoom(10);
    }
  };

  // Marker click
  const handleMarkerClick = (p: Property) => {
    setSelectedProperty(p);

    const el = itemRefs.current[p.property_id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // View Details
  const handleViewDetails = (p: Property) => {
    router.push(`/dashboard/properties/${p.property_id}`);
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

  return (
    <div className="w-11/12 mx-auto mt-6 space-y-4">

      {/* Filters Header */}
      <div className="flex flex-col lg:flex-row justify-between items-center bg-white">
        <div>
          <div className="flex items-center gap-2">
            <Building className="w-6 h-6 text-gray-700" />
            <h2 className="text-xl font-semibold">Property Listings</h2>
          </div>
          <p className="text-sm text-gray-500">View, search, and filter available properties.</p>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <Input
            placeholder="Search properties…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-[260px]"
          />

          {/* Type Filter */}
          <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPage(1); }}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Types</SelectItem>
              {types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Status</SelectItem>
              {status.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Sort Fields */}
          <Select value={sortField} onValueChange={(v) => setSortField(v)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="property_created_at">Newest</SelectItem>
              <SelectItem value="price">Price</SelectItem>
              <SelectItem value="cap_rate">Cap Rate</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort Order */}
          <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as "asc" | "desc")}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Desc</SelectItem>
              <SelectItem value="asc">Asc</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* MAIN: LIST + MAP */}
      <div className="flex h-[650px] border rounded-md overflow-hidden bg-white">

          {/* LEFT: SIDEBAR LIST */}
          <div className="relative w-full md:w-[35%] lg:w-[32%] border-r">

            {/* SCROLLABLE AREA (header + list only) */}
            <div className="overflow-y-auto h-[calc(650px-60px)]">

              {/* HEADER ALWAYS VISIBLE */}
              <div className="px-4 py-2 border-b text-sm bg-gray-50">
                {isLoading ? "Loading…" : `${total} results`}
              </div>

              {/* LIST ITEMS */}
              <div>
                {isLoading ? (
                  <div className="flex justify-center py-20">
                    <Loader2 className="animate-spin" size={28} />
                  </div>
                ) : (
                  <>
                    {data.map((p) => {
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
                                {([p.address, p.city, p.state].every(v => !v)
                                  ? "—"
                                  : [p.address, p.city, p.state].join(", "))}
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
                                src={p.file_url ?? "https://placehold.co/300x200/png?text=No+Image"}
                                alt={p.name}
                                fill
                                className="object-cover"
                              />
                            </div>
                          </div>

                          <Button
                            size="sm"
                            className="w-full bg-blue-700 hover:bg-blue-500 text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDetails(p);
                            }}
                          >
                            View Details
                          </Button>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>

            {/* FIXED PAGINATION */}
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


        {/* RIGHT: MAP */}
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
                          position={{ lat: p.latitude!, lng: p.longitude! }}
                          onClick={() => handleMarkerClick(p)}
                        />
                      ))}
                  </>
                )}
              </MarkerClusterer>

              {selectedProperty && selectedProperty.latitude && selectedProperty.longitude && (
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
                    <div className="font-semibold text-sm mb-1">{selectedProperty.name}</div>
                    <div className="text-xs text-gray-600 mb-2">
                      {`${selectedProperty.address ?? ""}, ${selectedProperty.city ?? ""}, ${selectedProperty.state ?? ""}`}
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
    </div>
  );
}