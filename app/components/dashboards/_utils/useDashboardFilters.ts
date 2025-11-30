"use client";
import { create } from "zustand";

function getDefaultDates() {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();

  const start = new Date(y, m, 1).toISOString().slice(0, 10);
  const end = new Date(y, m + 1, 0).toISOString().slice(0, 10);

  return { start, end };
}

const { start, end } = getDefaultDates();

/* ===========================================
   TYPE DEFINITIONS
=========================================== */
type DashboardFilterKeys =
  | "start_date"
  | "end_date"
  | "state"
  | "lease_status"
  | "doc_type"
  | "property_id";

interface DashboardFilterStore {
  start_date: string;
  end_date: string;
  state: string;
  lease_status: string;
  doc_type: string;
  property_id: string;

  reset: () => void;
  setFilter: (key: DashboardFilterKeys, value: string) => void;
}

/* ===========================================
   ZUSTAND STORE
=========================================== */
export const useDashboardFilters = create<DashboardFilterStore>((set) => ({
  start_date: start,
  end_date: end,
  state: "",
  lease_status: "",
  doc_type: "",
  property_id: "",

  reset: () =>
    set({
      start_date: start,
      end_date: end,
      state: "",
      lease_status: "",
      doc_type: "",
      property_id: "",
    }),

  setFilter: (key, value) =>
    set((state) => ({
      ...state,
      [key]: value,
    })),
}));
