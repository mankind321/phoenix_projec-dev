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
  Cell,
} from "recharts";

const COLORS = [
  "#1E40AF", // blue-800
  "#2563EB", // blue-600
  "#60A5FA", // blue-300
  "#38BDF8", // sky-400
  "#7DD3FC", // sky-300
];

export default function PropertiesByCityChart({ data }: { data: any[] }) {
  // 🛡 SAFETY: Guarantee this will ALWAYS be an array
  const list = Array.isArray(data) ? data : [];

  const cleaned = list.map((r) => ({
    ...r,
    total_properties: Number(r.total_properties ?? r.property_count ?? 0),
    city: String(r.city ?? r.city_name ?? ""),
  }));

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border">
      <h2 className="text-md font-semibold mb-4">Properties by City</h2>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={cleaned}
            margin={{ top: 8, right: 12, left: 0, bottom: 32 }}
          >
            <CartesianGrid strokeDasharray="5 5" stroke="#e6edf3" />
            <XAxis
              dataKey="city"
              tick={{ fontSize: 11, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
              interval={0}
              angle={-35}
              textAnchor="end"
              height={48}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />

            <Tooltip
              contentStyle={{
                background: "white",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                fontSize: 13,
              }}
              formatter={(value: any) => [Number(value), "Properties"]}
            />

            <Bar dataKey="total_properties" radius={[6, 6, 0, 0]} isAnimationActive>
              {cleaned.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}