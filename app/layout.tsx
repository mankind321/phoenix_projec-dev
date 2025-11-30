import "./globals.css";
import type { Metadata } from "next";
import SessionProviderWrapper from "./session-provider-wrapper";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Property Document Management",
  description: "Managing property listings",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground m-0 p-0">
        <SessionProviderWrapper>
          <main className="m-0 p-0">{children}</main>
          <Toaster richColors position="top-center" />
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
