/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function PropertiesByStateChart({ data }: { data: any[] }) {
  // 🛡 Ensure `data` is ALWAYS an array
  const list = Array.isArray(data) ? data : [];

  // Normalize row format (optional but recommended)
  const cleaned = list.map((r) => ({
    state: r.state ?? r.state_name ?? "",
    total_properties: Number(r.total_properties ?? r.property_count ?? 0),
  }));

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border">
      <h2 className="text-md font-semibold mb-4">Properties by State</h2>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={cleaned}>
            <CartesianGrid strokeDasharray="5 5" stroke="#e5e7eb" />

            <XAxis
              dataKey="state"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              axisLine={false}
            />

            <YAxis
              tick={{ fontSize: 12, fill: "#6b7280" }}
              axisLine={false}
              allowDecimals={false}
            />

            <Tooltip
              contentStyle={{
                background: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "0.75rem",
                fontSize: "13px",
              }}
            />

            <Bar
              dataKey="total_properties"
              fill="#3B82F6"
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
