/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState, useCallback } from "react";
import { useDashboardFilters } from "./useDashboardFilters";

export function useDashboardFetch(endpoint: string) {
  const filters = useDashboardFilters();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const qs = new URLSearchParams({
      start_date: filters.start_date,
      end_date: filters.end_date,
      state: filters.state || "",
      lease_status: filters.lease_status || "",
      doc_type: filters.doc_type || "",
      property_id: filters.property_id || "",
    }).toString();

    setLoading(true);
    const res = await fetch(`/api/dashboard/${endpoint}?${qs}`);
    const json = await res.json();
    setData(json.data ?? null);
    setLoading(false);
  }, [
    endpoint,
    filters.start_date,
    filters.end_date,
    filters.state,
    filters.lease_status,
    filters.doc_type,
    filters.property_id,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, refresh: fetchData };
}
