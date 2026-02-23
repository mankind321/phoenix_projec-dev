import "@tanstack/react-table";

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData, TValue> {
    className?: string;
    headerClassName?: string;

    /** @internal phantom usage for TS strict unused generic */
    _?: TData | TValue;
  }
}