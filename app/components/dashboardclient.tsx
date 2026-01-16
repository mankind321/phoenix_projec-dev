/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CircleGauge, 
  //Calendar, 
  Download, ChevronDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

import KPIGroup from "../components/dashboards/kpigroup";
import PropertiesByStateChart from "../components/dashboards/propertiesbystatechart";
import PropertiesByCityChart from "../components/dashboards/propertiesbycitychart";

import ExcelJS from "exceljs";
//import { Button } from "@/components/ui/button";

/* =============================================================
   Utilities
============================================================= */
function toArray(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (!v) return [];
  if (typeof v === "object") {
    for (const key of Object.keys(v)) {
      if (Array.isArray(v[key])) return v[key];
    }
  }
  return [];
}

function safeRows(rows: any) {
  if (!rows) return [];
  if (Array.isArray(rows)) return rows;
  if (typeof rows === "object") return [rows];
  return [];
}

/* =============================================================
   CSV Export
============================================================= */
function exportCSV(filename: string, rows: any[] | any) {
  try {
    const data = safeRows(rows);
    if (!data || data.length === 0) return;

    const header = Object.keys(data[0]).join(",");
    const body = data.map((r: any) =>
      Object.values(r)
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );

    const csv = [header, ...body].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("exportCSV error:", err);
  }
}

/* =============================================================
   XLSX Export
============================================================= */
async function exportXLSX(filename: string, sheets: Record<string, any[]>) {
  try {
    const workbook = new ExcelJS.Workbook();

    for (const sheetName of Object.keys(sheets)) {
      const rows = safeRows(sheets[sheetName]);
      const ws = workbook.addWorksheet(sheetName.substring(0, 31));

      if (rows.length > 0) {
        ws.columns = Object.keys(rows[0]).map((key) => ({
          header: key,
          key,
          width: 20,
        }));
        rows.forEach((row) => ws.addRow(row));
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("exportXLSX error:", err);
  }
}

/* =============================================================
   MAIN COMPONENT
============================================================= */

export default function DashboardClient() {
  // Actual applied filters for backend
  const [filters, setFilters] = useState({ startDate: "", endDate: "" });

  // Draft filters user edits (not applied yet)
  //const [draftFilters, setDraftFilters] = useState({ startDate: "", endDate: "" });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [kpi, setKpi] = useState<any>(null);
  const [propertiesByState, setPropertiesByState] = useState<any[]>([]);
  const [propertiesByCity, setPropertiesByCity] = useState<any[]>([]);

  const fetchData = useCallback(
    async (overrideFilters?: any) => {
      setLoading(true);
      setError(null);

      // Use override filters if provided
      const f = overrideFilters ?? filters;

      const qs = new URLSearchParams();
      if (f.startDate) qs.set("start_date", f.startDate);
      if (f.endDate) qs.set("end_date", f.endDate);

      const query = qs.toString() ? `?${qs.toString()}` : "";

      try {
        const [
          kpiRes,
          stateRes,
          cityRes,
        ] = await Promise.all([
          fetch(`/api/dashboard/kpi${query}`, { cache: "no-store" }),
          fetch(`/api/dashboard/properties-state${query}`, { cache: "no-store" }),
          fetch(`/api/dashboard/properties-city${query}`, { cache: "no-store" })
        ]);

        setKpi(await kpiRes.json());
        setPropertiesByState(toArray(await stateRes.json()));
        setPropertiesByCity(toArray(await cityRes.json()));
      } catch (err: any) {
        console.error("Dashboard fetch error:", err);
        setError(err.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  /* -------------------------------------------------------------
     INITIAL FILTER SET (current month) + FETCH INITIAL DATA
  ------------------------------------------------------------- */
  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split("T")[0];

    setFilters({ startDate: start, endDate: end });
    //setDraftFilters({ startDate: start, endDate: end });

    fetchData();
  }, []);

  /* -------------------------------------------------------------
     EXPORT PAYLOAD
  ------------------------------------------------------------- */
  const sheetsPayload = useMemo(
    () => ({
      KPI: [kpi],
      PropertiesByState: propertiesByState,
      PropertiesByCity: propertiesByCity,
    }),
    [
      kpi,
      propertiesByState,
      propertiesByCity,
    ]
  );

  const handleExportAllXLSX = async () => {
    try {
      await exportXLSX("dashboard.xlsx", sheetsPayload);
    } catch (err) {
      console.error("handleExportAllXLSX error:", err);
    }
  };

  const exportDashboardPDF = async () => {
    try {
      const response = await fetch("/api/dashboard/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kpi,
          propertiesByState,
          propertiesByCity,
          startDate: filters.startDate,
          endDate: filters.endDate,
        }),
      });

      if (!response.ok) {
        console.error("PDF export failed:", await response.text());
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "dashboard-report.pdf";
      a.click();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF export error:", err);
    }
  };

  return (
    <div id="dashboard-content" className="w-11/12 mx-auto mt-6 space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CircleGauge className="w-6 h-6 text-gray-700" />
            <h2 className="text-xl font-semibold text-gray-800">Statistics</h2>
          </div>
          <p className="text-sm text-gray-500">
            Live analytics
          </p>
        </div>

        {/* EXPORT MENU */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700">
              <Download className="h-4 w-4" />
              Export Data
              <ChevronDown className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => exportCSV("kpi.csv", [kpi])}>
              Export KPI (CSV)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => exportCSV("propertiesByState.csv", propertiesByState)}
            >
              Properties by State (CSV)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => exportCSV("propertiesByCity.csv", propertiesByCity)}
            >
              Properties by City (CSV)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleExportAllXLSX}
              className="font-semibold text-blue-600"
            >
              Export All (Excel)
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={exportDashboardPDF}
              className="font-semibold text-red-600"
            >
              Export Dashboard (PDF)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

{/* 
      FILTER BAR
      <div className="bg-white rounded-xl shadow p-4 border flex gap-6 items-end">
        START DATE
        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1">Start Date</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="date"
              value={draftFilters.startDate}
              onChange={(e) =>
                setDraftFilters((f) => ({ ...f, startDate: e.target.value }))
              }
              className="border rounded-lg pl-9 pr-3 py-2"
            />
          </div>
        </div>

        END DATE
        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1">End Date</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="date"
              value={draftFilters.endDate}
              onChange={(e) =>
                setDraftFilters((f) => ({ ...f, endDate: e.target.value }))
              }
              className="border rounded-lg pl-9 pr-3 py-2"
            />
          </div>
        </div>

        <div>
          APPLY BUTTON
          <Button
            onClick={() => {
              setFilters(draftFilters);
              fetchData(draftFilters);  // ← send correct filters immediately
            }}
            className="mb-1 mr-1 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700"
          >
            Apply
          </Button>


          RESET BUTTON
          <Button
            onClick={() => {
              const now = new Date();
              const start = new Date(now.getFullYear(), now.getMonth(), 1)
                .toISOString()
                .split("T")[0];
              const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
                .toISOString()
                .split("T")[0];

              const defaults = { startDate: start, endDate: end };

              setDraftFilters(defaults);
              setFilters(defaults);
              fetchData(defaults);   // ← send the values to fetch
            }}
            className="ml-1 mb-1 bg-red-500 text-white rounded-lg hover:bg-red-400"
          >
            Reset
          </Button>
        </div>
      </div>
*/}

      {/* ERROR */}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {loading && <div>Loading dashboard…</div>}

      {/* CONTENT */}
      {!loading && kpi && (
        <>
          <KPIGroup kpi={kpi} />

          <div>
            <PropertiesByStateChart data={propertiesByState} />
          </div>

          <div>
            <PropertiesByCityChart data={propertiesByCity} />
          </div>
        </>
      )}
    </div>
  );
}
