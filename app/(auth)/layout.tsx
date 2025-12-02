/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { ReactNode, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { TopHeader } from "@/app/components/header";
import { TopHeaderAdmin } from "@/app/components/headerAdmin";
import { TopHeaderManager } from "@/app/components/headerManager";
import { AutoLogout } from "@/app/components/autologout";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  const wasAuthenticated = useRef(false);
  const lastUserRef = useRef<{ accountId: string; username: string } | null>(
    null
  );

  // ==========================================
  // 🔐 AUTH REDIRECT + STORE LAST USER
  // ==========================================
  useEffect(() => {
    const intentionalLogout =
      sessionStorage.getItem("isLoggingOut") === "true";

    // When login succeeds
    if (status === "authenticated" && session?.user) {
      wasAuthenticated.current = true;

      lastUserRef.current = {
        accountId: session.user.accountId,
        username: session.user.username,
      };
    }

    // When session becomes unauthenticated
    if (status === "unauthenticated") {
      if (!intentionalLogout) {
        toast.error("Session expired or not logged in.");
      } else {
        sessionStorage.removeItem("isLoggingOut");
      }

      router.replace("/login");
    }
  }, [status, session, router]);

  // ==========================================
  // 🔵 MARK USER OFFLINE ONLY ON TRUE SESSION END
  // ==========================================
  useEffect(() => {
    const intentionalLogout =
      sessionStorage.getItem("isLoggingOut") === "true";

    if (
      status === "unauthenticated" &&
      wasAuthenticated.current === true &&
      !intentionalLogout &&
      lastUserRef.current
    ) {
      navigator.sendBeacon(
        "/api/auth/update-status-offline",
        JSON.stringify(lastUserRef.current)
      );
    }
  }, [status]);

  // ==========================================
  // 🔵 TAB CLOSE LOGOUT — ONLY CLOSE, NOT SWITCH TABS
  // ==========================================
  useEffect(() => {
    if (!session?.user) return;

    const payload = JSON.stringify({
      accountId: session.user.accountId,
      username: session.user.username,
    });

    const isIntentionalLogout = () =>
      sessionStorage.getItem("isLoggingOut") === "true";

    const handleBeforeUnload = () => {
      if (!isIntentionalLogout()) {
        navigator.sendBeacon("/api/auth/update-status-offline", payload);
      }
    };

    // Fires ONLY on tab close or browser close
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () =>
      window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [session]);

  // ==========================================
  // 🔵 AUTO INACTIVITY LOGOUT (from AutoLogout)
  // ==========================================
  useEffect(() => {
    if (!session?.user) return;

    const interval = setInterval(async () => {
      const inactive = sessionStorage.getItem("user-inactive") === "true";
      if (!inactive) return;

      // Mark user offline
      navigator.sendBeacon(
        "/api/auth/update-status-offline",
        JSON.stringify({
          accountId: session.user.accountId,
          username: session.user.username,
        })
      );

      // Then log out
      sessionStorage.setItem("isLoggingOut", "true");
      await signOut({ redirect: false });
      router.replace("/login");
    }, 2000);

    return () => clearInterval(interval);
  }, [session, router]);

  // ==========================================
  // Block rendering until session is ready
  // ==========================================
  if (!session?.user) return null;

  return (
    <div className="min-h-screen bg-white">
      <AutoLogout />

      {/* SIDEBAR + HEADER */}
      <div className="sidebar-scroll w-64 h-screen fixed left-0 top-0 border-r border-gray-200 bg-white">
        {session.user.role === "Admin" ? (
          <TopHeaderAdmin />
        ) : session.user.role === "Manager" ? (
          <TopHeaderManager />
        ) : (
          <TopHeader />
        )}
      </div>

      {/* CONTENT */}
      <main className="ml-64 p-6 bg-white">{children}</main>
    </div>
  );
}
