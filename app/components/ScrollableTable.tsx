import { ReactNode } from "react";

interface ScrollableTableProps {
  children: ReactNode;
  maxHeight?: string;
}

export function ScrollableTable({
  children,
  maxHeight = "400px",
}: ScrollableTableProps) {
  return (
    <div
      className="overflow-auto border rounded-md"
      style={{ maxHeight }}
    >
      {children}
    </div>
  );
}