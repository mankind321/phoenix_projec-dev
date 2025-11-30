"use client";

import { useEffect, useRef } from "react";
import { signOut, useSession } from "next-auth/react";
import { toast } from "sonner";

export function AutoLogout() {
  const { data: session, status } = useSession();
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Detects real user activity
  useEffect(() => {
    if (status !== "authenticated" || !session?.expires) return;

    const resetIdleTimer = () => {
      if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current);
      // 5 minutes of no activity = logout
      activityTimeoutRef.current = setTimeout(() => {
        toast.error("Session expired due to inactivity.");
        signOut({ callbackUrl: "/login" });
      }, 5 * 60 * 1000);
    };

    // Listen to activity events
    window.addEventListener("mousemove", resetIdleTimer);
    window.addEventListener("keydown", resetIdleTimer);
    window.addEventListener("click", resetIdleTimer);
    window.addEventListener("scroll", resetIdleTimer);

    resetIdleTimer(); // start the timer

    return () => {
      window.removeEventListener("mousemove", resetIdleTimer);
      window.removeEventListener("keydown", resetIdleTimer);
      window.removeEventListener("click", resetIdleTimer);
      window.removeEventListener("scroll", resetIdleTimer);
      if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current);
    };
  }, [session, status]);

  return null;
}