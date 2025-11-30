/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  Building2,
  FileCheck,
  DollarSign,
  AlertTriangle,
  FileWarning,
} from "lucide-react";

export default function KPIGroup({ kpi }: { kpi: any }) {
  const cards = [
    {
      label: "Total Available Properties",
      value: kpi?.available_properties ?? 0,
      sub: "Active portfolio",
      icon: <Building2 className="w-5 h-5 text-blue-500" />,
    },
    {
      label: "Active Leases",
      value: kpi?.active_leases ?? 0,
      sub: "Currently occupied",
      icon: <FileCheck className="w-5 h-5 text-green-500" />,
    },
    {
      label: "Monthly Revenue",
      value: kpi?.monthly_income
        ? `$${Number(kpi?.monthly_income).toLocaleString()}`
        : "$0",
      sub: "Gross rental income",
      icon: <DollarSign className="w-5 h-5 text-emerald-500" />,
    },
    {
      label: "Expiring Soon",
      value: kpi?.expiring_leases ?? 0,
      sub: "Require attention",
      icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    },
    {
      label: "Error Documents",
      value: kpi?.error_documents ?? 0,
      sub: "Extraction failed",
      icon: <FileWarning className="w-5 h-5 text-red-500" />,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
      {cards.map((item, idx) => (
        <div
          key={idx}
          className="bg-white border rounded-2xl shadow-sm p-5 hover:shadow-md transition-shadow duration-200"
        >
          <div className="flex items-start justify-between">
            <h3 className="text-sm font-medium text-gray-600">{item.label}</h3>
            <div>{item.icon}</div>
          </div>

          <div className="mt-3 text-3xl font-semibold text-gray-900">
            {item.value}
          </div>

          <p className="text-sm text-gray-500 mt-1">{item.sub}</p>
        </div>
      ))}
    </div>
  );
}