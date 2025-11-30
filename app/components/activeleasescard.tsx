import React from "react";

interface Lease {
  id: number;
  name: string;
  property: string;
  dateRange: string;
  size: string;
  rent: string;
  status: string;
}

const ActiveLeasesCard: React.FC = () => {
  const leases: Lease[] = [
    {
      id: 1,
      name: "TechCorp Solutions",
      property: "Metropolitan Office Tower",
      dateRange: "2023-01-01 - 2025-12-31",
      size: "15,000 sq ft",
      rent: "$85,000/mo",
      status: "Active",
    },
    {
      id: 2,
      name: "Fashion Retail Inc",
      property: "Riverside Shopping Center",
      dateRange: "2022-06-01 - 2024-05-31",
      size: "8,000 sq ft",
      rent: "$45,000/mo",
      status: "Expiring Soon",
    },
    {
      id: 3,
      name: "Logistics Pro",
      property: "Industrial Park West",
      dateRange: "2021-03-01 - 2024-02-29",
      size: "20,000 sq ft",
      rent: "$32,000/mo",
      status: "Expired",
    },
  ];

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-600";
      case "Expiring Soon":
        return "bg-yellow-100 text-yellow-700";
      case "Expired":
        return "bg-red-100 text-red-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <div className="w-4/5 mx-auto mt-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-bold mb-1">Active Leases</h2>
        <p className="text-sm text-gray-500 mb-4">
          Monitor lease agreements and expiration dates
        </p>

        <div className="space-y-3">
          {leases.map((lease) => (
            <div
              key={lease.id}
              className="flex justify-between items-center border rounded-lg p-4 bg-white hover:bg-gray-50 transition"
            >
              <div>
                <h3 className="font-semibold">{lease.name}</h3>
                <p className="text-sm text-gray-600">{lease.property}</p>
                <p className="text-sm text-gray-500 flex items-center mt-1">
                  📅 {lease.dateRange} &nbsp; {lease.size}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{lease.rent}</p>
                <span
                  className={`text-xs font-medium px-3 py-1 rounded-full ${getStatusColor(
                    lease.status
                  )}`}
                >
                  {lease.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ActiveLeasesCard;
