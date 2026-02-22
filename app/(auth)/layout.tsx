"use client";

import { ReactNode, useEffect, useRef, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { TopHeader } from "@/app/components/header";
import { TopHeaderAdmin } from "@/app/components/headerAdmin";
import { TopHeaderManager } from "@/app/components/headerManager";
import { AutoLogout } from "@/app/components/autologout";
import { useRealtimeTest } from "@/hooks/useRealtimeTest";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  const wasAuthenticated = useRef(false);
  const offlineSentRef = useRef(false);
  const onlineSentRef = useRef(false);

  const lastUserRef = useRef<{
    accountId: string;
    username: string;
  } | null>(null);

  const isLoggingIn = () => sessionStorage.getItem("isLoggingIn") === "true";

  const isLoggingOut = () => sessionStorage.getItem("isLoggingOut") === "true";

  // ==========================================
  // 🔴 SEND OFFLINE (SINGLE-FLIGHT)
  // ==========================================
  const sendOffline = useCallback(
    (payload: { accountId: string; username: string }) => {
      if (offlineSentRef.current) return;
      if (isLoggingIn()) return;

      offlineSentRef.current = true;

      navigator.sendBeacon(
        "/api/auth/update-status-offline",
        JSON.stringify(payload),
      );
    },
    [],
  );

  // ==========================================
  // 🟢 SEND ONLINE (ONCE PER LOGIN)
  // ==========================================
  const sendOnline = useCallback(
    (payload: { accountId: string; username: string }) => {
      if (onlineSentRef.current) return;

      onlineSentRef.current = true;

      fetch("/api/auth/update-status-online", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch((err) => console.error("Failed to set online:", err));
    },
    [],
  );

  // ==========================================
  // 🔐 AUTH STATE TRACKING
  // ==========================================
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      wasAuthenticated.current = true;
      offlineSentRef.current = false;

      lastUserRef.current = {
        accountId: session.user.accountId,
        username: session.user.username,
      };

      // ✅ Login stabilized → mark online
      if (!isLoggingIn()) {
        sendOnline(lastUserRef.current);
      }

      return;
    }

    if (
      status === "unauthenticated" &&
      wasAuthenticated.current &&
      !isLoggingOut() &&
      !isLoggingIn()
    ) {
      toast.error("Session expired. Please log in again.");

      if (lastUserRef.current) {
        sendOffline(lastUserRef.current);
      }

      sessionStorage.removeItem("isLoggingOut");
      router.replace("/login");
    }
  }, [status, session, router, sendOffline, sendOnline]);

  // ==========================================
  // 🔵 TAB CLOSE / BROWSER CLOSE / REFRESH ONLY
  // ==========================================
  useEffect(() => {
    if (status !== "authenticated") return;
    if (!session?.user) return;

    const payload = {
      accountId: session.user.accountId,
      username: session.user.username,
    };

    const handleBeforeUnload = () => {
      if (!isLoggingOut() && !isLoggingIn()) {
        sendOffline(payload);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [status, session, sendOffline]);
  
  // ==========================================
  // ⏱ AUTO LOGOUT AFTER IDLE
  // ==========================================
  useEffect(() => {
    if (!session?.user) return;

    const checkIdle = async () => {
      const inactive = sessionStorage.getItem("user-inactive") === "true";
      if (!inactive) return;

      sessionStorage.setItem("isLoggingOut", "true");

      sendOffline({
        accountId: session.user.accountId,
        username: session.user.username,
      });

      await signOut({ redirect: false });
      router.replace("/login");
    };

    const interval = setInterval(checkIdle, 10_000);
    return () => clearInterval(interval);
  }, [session, router, sendOffline]);

  // ==========================================
  // 🔔 REALTIME (SAFE)
  // ==========================================
  useRealtimeTest(status === "authenticated" && !!session?.user);

  // ==========================================
  // ⛔ BLOCK RENDER UNTIL READY
  // ==========================================
  if (!session?.user) return null;

  return (
    <div className="min-h-screen bg-white">
      <AutoLogout />

      <div className="sidebar-scroll w-64 h-screen fixed left-0 top-0 border-r border-gray-200 bg-white">
        {session.user.role === "Admin" ? (
          <TopHeaderAdmin />
        ) : session.user.role === "Manager" ? (
          <TopHeaderManager />
        ) : (
          <TopHeader />
        )}
      </div>

      <main className="ml-64 p-6 bg-white">{children}</main>
    </div>
  );
}
