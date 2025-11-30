import { Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";

interface Filters {
  query: string;
  type: string;
  status: string;
  size: string;
  available: string;
  rent: string;
}

interface Props {
  onFilterChange: (filters: Filters) => void;
}

export function TraditionalSearchFilters({ onFilterChange }: Props) {
  const [filters, setFilters] = useState<Filters>({
    query: "",
    type: "",
    status: "",
    size: "",
    available: "",
    rent: "",
  });

  const updateFilters = (newValues: Partial<Filters>) => {
    const updated = { ...filters, ...newValues };
    setFilters(updated);
    onFilterChange(updated); // 🔁 send all filters together
  };

  return (
    <Card className="w-4/5 mx-auto mt-6">
      <CardContent className="px-6">
        <div className="flex flex-col space-y-3">
          <div>
            <h2 className="text-base font-semibold">Traditional Search & Filters</h2>
            <p className="text-sm text-gray-500">
              Find and filter properties using specific criteria
            </p>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:space-x-3 space-y-3 md:space-y-0">
            {/* Search Box */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search properties by name or address..."
                value={filters.query}
                onChange={(e) => updateFilters({ query: e.target.value })}
                className="w-full border border-gray-300 rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Type Dropdown */}
            <select
              value={filters.type}
              onChange={(e) => updateFilters({ type: e.target.value })}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option>Residential</option>
              <option>Commercial</option>
              <option>Industrial</option>
              <option>Agricultural</option>
              <option>Mixed-Use</option>
              <option>Institutional</option>
              <option>Land</option>
            </select>

            {/* Status Dropdown */}
            <select
              value={filters.status}
              onChange={(e) => updateFilters({ status: e.target.value })}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option>Available</option>
              <option>Occupied</option>
              <option>Leased</option>
              <option>For Sale</option>
              <option>Sold</option>
              <option>Under Contract</option>
              <option>Reserved</option>
              <option>Off Market</option>
              <option>Under Renovation</option>
              <option>Expired Listing</option>
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default TraditionalSearchFilters;