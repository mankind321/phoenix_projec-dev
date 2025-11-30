/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const COLORS = ["#1E40AF", "#60A5FA", "#34D399", "#F59E0B", "#EF4444"];

export default function DocumentsByTypeChart({ data }: { data: any[] }) {
  const list = Array.isArray(data) ? data : [];

  const cleaned = list.map((r) => ({
    ...r,
    total: Number(r.total ?? r.doc_count ?? r.count ?? 0),
    doc_type: r.doc_type ?? r.type ?? "Unknown",
  }));

  const total = cleaned.reduce((s, r) => s + r.total, 0);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border">
      <h2 className="text-md font-semibold mb-4">Documents by Type</h2>

      {/* FLEX ROW: LEGEND LEFT + PIE RIGHT */}
      <div className="flex gap-4 items-center">

        {/* LEFT LEGEND */}
        <div className="flex flex-col gap-3 min-w-[180px]">
          {cleaned.map((item: any, i: number) => (
            <div key={i} className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              ></div>

              <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-700 capitalize">
                  {item.doc_type}
                </span>
                <span className="text-xs text-gray-500">
                  {item.total} documents
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* RIGHT PIE CHART — pulled left slightly */}
        <div className="h-64 w-[260px] -ml-4">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={cleaned}
                dataKey="total"
                nameKey="doc_type"
                innerRadius={56}
                outerRadius={92}
                paddingAngle={6}
                stroke="transparent"
                isAnimationActive
              >
                {cleaned.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>

              <Tooltip
                formatter={(value: any, name: any) => [`${value}`, name]}
                contentStyle={{
                  background: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
