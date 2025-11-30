/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const COLORS = ["#38BDF8", "#34D399", "#FBBF24"];

export default function LeaseStatusChart({ data }: { data: any }) {
  const safeData = Array.isArray(data)
    ? data
    : data && typeof data === "object"
    ? [data]
    : [];

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border">
      <h2 className="text-md font-semibold mb-4">Lease Status Summary</h2>

      {/* FLEX ROW: LEGEND LEFT + PIE RIGHT */}
      <div className="flex gap-4 items-center">

        {/* LEFT LEGEND */}
        <div className="flex flex-col gap-3 min-w-[140px]">
          {safeData.map((item: any, i: number) => (
            <div key={i} className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              ></div>

              <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-700 capitalize">
                  {item.status}
                </span>
                <span className="text-xs text-gray-500">
                  {item.total} leases
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* RIGHT PIE (shift left) */}
        <div className="h-64 w-[260px] -ml-6">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={safeData}
                dataKey="total"
                nameKey="status"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={3}
                stroke="none"
              >
                {safeData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>

              <Tooltip
                contentStyle={{
                  background: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "0.75rem",
                  fontSize: "13px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
