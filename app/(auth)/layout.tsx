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

    if (status === "authenticated" && session?.user) {
      wasAuthenticated.current = true;
      lastUserRef.current = {
        accountId: session.user.accountId,
        username: session.user.username,
      };
    }

    if (status === "unauthenticated") {
      if (!intentionalLogout && wasAuthenticated.current) {
        toast.error("Session expired. Please log in again.");
      }

      sessionStorage.removeItem("isLoggingOut");
      router.replace("/login");
    }
  }, [status, session, router]);

  // ==========================================
  // 🔵 MARK USER OFFLINE ON REAL SESSION END
  // ==========================================
  useEffect(() => {
    const intentionalLogout =
      sessionStorage.getItem("isLoggingOut") === "true";

    if (
      status === "unauthenticated" &&
      wasAuthenticated.current &&
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
  // 🔵 TAB & BROWSER CLOSE (BEST-EFFORT ONLY)
  // ==========================================
  useEffect(() => {
    if (!session?.user) return;

    const payload = JSON.stringify({
      accountId: session.user.accountId,
      username: session.user.username,
    });

    const isIntentionalLogout = () =>
      sessionStorage.getItem("isLoggingOut") === "true";

    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "hidden" &&
        !isIntentionalLogout()
      ) {
        navigator.sendBeacon(
          "/api/auth/update-status-offline",
          payload
        );
      }
    };

    const handleBeforeUnload = () => {
      if (!isIntentionalLogout()) {
        navigator.sendBeacon(
          "/api/auth/update-status-offline",
          payload
        );
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
      window.removeEventListener(
        "beforeunload",
        handleBeforeUnload
      );
    };
  }, [session]);

  // ==========================================
  // 🔵 AUTO LOGOUT AFTER 10 MINUTES IDLE
  // ==========================================
  useEffect(() => {
    if (!session?.user) return;

    const checkIdle = async () => {
      const inactive =
        sessionStorage.getItem("user-inactive") === "true";
      if (!inactive) return;

      sessionStorage.setItem("isLoggingOut", "true");

      navigator.sendBeacon(
        "/api/auth/update-status-offline",
        JSON.stringify({
          accountId: session.user.accountId,
          username: session.user.username,
        })
      );

      await signOut({ redirect: false });
      router.replace("/login");
    };

    const interval = setInterval(checkIdle, 10_000); // check every 10s
    return () => clearInterval(interval);
  }, [session, router]);

  // ==========================================
  // ⛔ BLOCK RENDER UNTIL SESSION IS READY
  // ==========================================
  if (!session?.user) return null;

  return (
    <div className="min-h-screen bg-white">
      {/* Idle detection */}
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
      <main className="ml-64 p-6 bg-white">
        {children}
      </main>
    </div>
  );
}
