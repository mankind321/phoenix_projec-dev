/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";

export interface Property {
  PropertyId: number;
  Name: string;
  Landlord: string;
  Address: string;
  State: string;
  City: string;
  Type: string;
  Status: string;
  SaleDate: string;
  Price: number;
  CapRate: number;
  CreatedAt: string;
  UpdatedAt: string;
  Latitude: number;
  Longitude: number;
  Image: string;
}

export interface Filters {
  query?: string;
  type?: string;
  status?: string;
  available?: string;
}

interface PropertyStore {
  properties: Property[];
  isLoading: boolean;
  error: string | null;
  fetchProperties: (filters: Filters) => Promise<void>;
  setProperties: (properties: Property[]) => void;
}

export const usePropertyStore = create<PropertyStore>((set) => ({
  properties: [],
  isLoading: false,
  error: null,

  // ✅ Fetch data with safe filtering
  fetchProperties: async (filters: Filters) => {
    set({ isLoading: true, error: null });

    try {
      // 🧹 Clean up filters before sending to backend
      const cleanedFilters: Filters = {
        ...filters,
        type:
          filters.type && filters.type.toLowerCase() !== "all types"
            ? filters.type
            : "",
        status:
          filters.status && filters.status.toLowerCase() !== "all status"
            ? filters.status
            : "",
      };

      // ✅ Only append non-empty filters
      const params = new URLSearchParams();
      if (cleanedFilters.query?.trim())
        params.append("query", cleanedFilters.query.trim());
      if (cleanedFilters.type) params.append("type", cleanedFilters.type);
      if (cleanedFilters.status) params.append("status", cleanedFilters.status);
      if (cleanedFilters.available)
        params.append("available", cleanedFilters.available);

      const res = await fetch(`/api/properties?${params.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API Error (${res.status}): ${errText}`);
      }

      const data: Property[] = await res.json();

      set({ properties: data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false, properties: [] });
    }
  },

  setProperties: (properties) => set({ properties }),
}));
