"use client";

import { ReactNode, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { TopHeader } from "@/app/components/header";
import { TopHeaderAdmin } from "@/app/components/headerAdmin";
import { TopHeaderManager } from "@/app/components/headerManager";
import { AutoLogout } from "@/app/components/autologout";

interface AuditTrailLayoutProps {
  children: ReactNode;
}

export default function AuditTrailLayout({ children }: AuditTrailLayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    const isLoggingOut =
      typeof window !== "undefined" &&
      sessionStorage.getItem("isLoggingOut") === "true";

    if (status === "unauthenticated") {
      if (!isLoggingOut) {
        toast.error("Session expired or not logged in.");
      } else {
        sessionStorage.removeItem("isLoggingOut");
      }
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    console.log("Refreshing session silently...");
  }

  if (!session?.user) return null;

  return (
    <div className="min-h-screen bg-white">
      <AutoLogout />

      {/* FIXED SIDEBAR */}
      <div className="w-64 h-screen fixed left-0 top-0 border-r border-gray-200 bg-white overflow-y-auto">
        {session.user.role === "Admin" ? (
          <TopHeaderAdmin />
        ) : session.user.role === "Manager" ? (
          <TopHeaderManager />
        ) : (
          <TopHeader />
        )}
      </div>

      {/* MAIN CONTENT (NO CARD) */}
      <main className="ml-64 p-6 bg-white">
        {children}
      </main>
    </div>
  );
}