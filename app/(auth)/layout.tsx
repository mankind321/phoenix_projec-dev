/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { ReactNode, useEffect, useRef, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

import { TopHeader } from "@/app/components/header";
import { TopHeaderAdmin } from "@/app/components/headerAdmin";
import { TopHeaderManager } from "@/app/components/headerManager";
import { useRealtimeTest } from "@/hooks/useRealtimeTest";

const IDLE_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const ACTIVITY_KEY = "last-activity";
const LOGOUT_KEY = "force-logout";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  const offlineSentRef = useRef(false);
  const onlineSentRef = useRef(false);

  const lastUserRef = useRef<{
    accountId: string;
    username: string;
    session_id: string;
  } | null>(null);

  const isLoggingIn = () => sessionStorage.getItem("isLoggingIn") === "true";
  const isLoggingOut = () => sessionStorage.getItem("isLoggingOut") === "true";

  // ==========================================
  // 🔴 SEND OFFLINE
  // ==========================================
  const sendOffline = useCallback(
    async (payload: { accountId: string; username: string }) => {
      if (offlineSentRef.current) return;
      offlineSentRef.current = true;

      try {
        await fetch("/api/auth/update-status-offline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (e) {
        console.error("Offline send failed", e);
      }
    },
    [],
  );

  // ==========================================
  // 🟢 SEND ONLINE
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
  // 🔐 AUTH STATE
  // ==========================================
  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated" || !session?.user) {
      router.replace("/login");
      return;
    }

    if (session?.user && session.session_id) {
      offlineSentRef.current = false;
      onlineSentRef.current = false;

      lastUserRef.current = {
        accountId: session.user.accountId,
        username: session.user.username,
        session_id: session.session_id,
      };

      const wasOnline = sessionStorage.getItem("session-online");

      if (!wasOnline && !isLoggingIn()) {
        sendOnline(lastUserRef.current);
        sessionStorage.setItem("session-online", "true");
      }
    }
  }, [status, session, router, sendOnline]);

  // ==========================================
  // 🧠 TRACK ACTIVITY (CROSS-TAB)
  // ==========================================
  useEffect(() => {
    if (!session?.user) return;

    const updateActivity = () => {
      const now = Date.now();
      localStorage.setItem(ACTIVITY_KEY, now.toString());
    };

    const events = ["mousemove", "keydown", "click", "scroll"];

    events.forEach((event) =>
      window.addEventListener(event, updateActivity),
    );

    // Initialize activity on load
    updateActivity();

    return () => {
      events.forEach((event) =>
        window.removeEventListener(event, updateActivity),
      );
    };
  }, [session]);

  // ==========================================
  // 🔁 SYNC ACTIVITY ACROSS TABS
  // ==========================================
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === LOGOUT_KEY && e.newValue === "true") {
        triggerLogout();
      }
    };

    window.addEventListener("storage", handleStorage);

    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // ==========================================
  // 🚨 LOGOUT FUNCTION (SHARED)
  // ==========================================
  const triggerLogout = useCallback(async () => {
    if (!session?.user) return;

    if (isLoggingOut()) return;

    sessionStorage.setItem("isLoggingOut", "true");

    await sendOffline({
      accountId: session.user.accountId,
      username: session.user.username,
    });

    await signOut({ redirect: false });

    router.replace("/login");
  }, [session, router, sendOffline]);

  // ==========================================
  // ⏱ CHECK IDLE (ON FOCUS / VISIBILITY)
  // ==========================================
  useEffect(() => {
    if (!session?.user) return;

    const checkIdle = () => {
      const lastActivity = Number(localStorage.getItem(ACTIVITY_KEY) || 0);
      const now = Date.now();

      const inactive = now - lastActivity > IDLE_TIMEOUT;

      if (!inactive) return;

      console.log("Idle detected → logging out ALL tabs");

      // 🔥 broadcast logout to all tabs
      localStorage.setItem(LOGOUT_KEY, "true");

      triggerLogout();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkIdle();
      }
    };

    const handleFocus = () => {
      checkIdle();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, [session, triggerLogout]);

  // ==========================================
  // 🔵 TAB CLOSE ONLY
  // ==========================================
  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return;

    const payload = {
      accountId: session.user.accountId,
      username: session.user.username,
    };

    const handleBeforeUnload = () => {
      if (!isLoggingOut() && !isLoggingIn()) {
        navigator.sendBeacon(
          "/api/auth/update-status-offline",
          JSON.stringify(payload),
        );
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [status, session]);

  // ==========================================
  // 🔔 REALTIME
  // ==========================================
  useRealtimeTest(status === "authenticated" && !!session?.user);

  // ==========================================
  // ⛔ BLOCK RENDER
  // ==========================================
  if (status === "loading") return null;
  if (!session?.user) return null;

  return (
    <div className="min-h-screen bg-white">
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