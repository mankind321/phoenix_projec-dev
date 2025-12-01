/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { ReactNode, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { TopHeader } from "@/app/components/header";
import { TopHeaderAdmin } from "@/app/components/headerAdmin";
import { TopHeaderManager } from "@/app/components/headerManager";
import { AutoLogout } from "@/app/components/autologout";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Track if the user was previously authenticated
  const wasAuthenticated = useRef(false);

  // Stores last known logged-in user safely (avoids "never" errors)
  const lastUserRef = useRef<{
    accountId: string;
    username: string;
  } | null>(null);

  // ==========================================
  // 🔐 AUTH REDIRECT + STORE LAST USER
  // ==========================================
  useEffect(() => {
    const isLoggingOut =
      typeof window !== "undefined" &&
      sessionStorage.getItem("isLoggingOut") === "true";

    if (status === "authenticated" && session?.user) {
      wasAuthenticated.current = true;
      lastUserRef.current = {
        accountId: session.user.accountId,
        username: session.user.username,
      };
    }

    if (status === "unauthenticated") {
      if (!isLoggingOut) {
        toast.error("Session expired or not logged in.");
      } else {
        sessionStorage.removeItem("isLoggingOut");
      }

      router.replace("/login");
    }
  }, [status, session, router]);

  // ==========================================
  // 🔵 MARK USER OFFLINE WHEN SESSION ENDS
  // ==========================================
  useEffect(() => {
    if (status === "unauthenticated" && wasAuthenticated.current && lastUserRef.current) {
      fetch("/api/auth/update-status-offline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lastUserRef.current),
      });
    }
  }, [status]);

  // ==========================================
  // 🔵 OFFLINE TRACKING (TAB CLOSE + INACTIVITY)
  // ==========================================
  useEffect(() => {
    if (!session?.user) return;

    const { accountId, username } = session.user;

    const markOffline = async () => {
      try {
        await fetch("/api/auth/update-status-offline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId, username }),
        });
      } catch (err) {
        console.warn("⚠ Failed to update offline status:", err);
      }
    };

    // Mark offline when browser/tab closed
    window.addEventListener("beforeunload", markOffline);

    // Inactivity timer (10 minutes)
    let inactivityTimer: any;
    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => markOffline(), 10 * 60 * 1000);
    };

    const events = ["mousemove", "keydown", "scroll", "click"];
    events.forEach((ev) => window.addEventListener(ev, resetTimer));

    resetTimer();

    return () => {
      window.removeEventListener("beforeunload", markOffline);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
      clearTimeout(inactivityTimer);
    };
  }, [session]);

  // ==========================================
  // Prevent UI from rendering if session missing
  // ==========================================
  if (!session?.user) return null;

  return (
    <div className="min-h-screen bg-white">
      <AutoLogout />

      {/* PERSISTENT SIDEBAR + HEADER */}
      <div className="sidebar-scroll w-64 h-screen fixed left-0 top-0 border-r border-gray-200 bg-white">
        {session.user.role === "Admin" ? (
          <TopHeaderAdmin />
        ) : session.user.role === "Manager" ? (
          <TopHeaderManager />
        ) : (
          <TopHeader />
        )}
      </div>

      {/* CONTENT AREA */}
      <main className="ml-64 p-6 bg-white">{children}</main>
    </div>
  );
}
