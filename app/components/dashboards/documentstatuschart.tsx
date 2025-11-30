/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const DOC_COLORS = ["#60A5FA", "#FB923C"]; // blue / orange

export default function DocumentStatusChart({ data }: { data: any[] }) {
  const list = Array.isArray(data) ? data : [];

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border">
      <h2 className="text-md font-semibold mb-4">Document Status Summary</h2>

      {/* FLEX: LEGEND LEFT + PIE RIGHT */}
      <div className="flex gap-4 items-center">
        
        {/* LEFT LEGEND */}
        <div className="flex flex-col gap-3 min-w-[150px]">
          {list.map((item: any, i: number) => (
            <div key={i} className="flex items-center gap-3">
              {/* Colored Dot */}
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: DOC_COLORS[i % DOC_COLORS.length] }}
              ></div>

              {/* Labels */}
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-700 capitalize">
                  {item.extraction_status}
                </span>
                <span className="text-xs text-gray-500">
                  {item.total} documents
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* RIGHT PIE — SHIFT LEFT */}
        <div className="h-64 w-[260px] -ml-6">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={list}
                dataKey="total"
                nameKey="extraction_status"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={3}
                stroke="none"
              >
                {list.map((_, i) => (
                  <Cell key={i} fill={DOC_COLORS[i % DOC_COLORS.length]} />
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
