/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function IncomeTrendChart({ data }: { data: any[] }) {
  // 🛡 SAFETY: Recharts will crash if data is not an array
  const list = Array.isArray(data) ? data : [];

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });

  console.log("IncomeTrendChart DATA:", list);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border">
      <h2 className="text-md font-semibold mb-4">Monthly Income Trend</h2>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={list}>
            <defs>
              <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.2} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="5 5" stroke="#e5e7eb" />

            <XAxis
              dataKey="month"
              tickFormatter={formatDate}
              tick={{ fontSize: 12, fill: "#6b7280" }}
            />

            <YAxis
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickFormatter={(v) => `$${v.toLocaleString()}`}
            />

            <Tooltip
              contentStyle={{
                background: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "10px",
                fontSize: "13px",
              }}
              formatter={(value) => [`$${Number(value).toLocaleString()}`, "Income"]}
              labelFormatter={formatDate}
            />

            <Line
              type="monotone"
              dataKey="monthly_income"
              stroke="url(#incomeGradient)"
              strokeWidth={3}
              dot={{ r: 4, strokeWidth: 2, fill: "#3b82f6" }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}