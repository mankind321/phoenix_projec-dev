"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

export function AutoLogout() {
  const { data: session, status } = useSession();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;

    const sendInactivitySignal = () => {
      sessionStorage.setItem("user-inactive", "true");
    };

    const resetTimer = () => {
      sessionStorage.removeItem("user-inactive");
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(sendInactivitySignal, 5 * 60 * 1000); // 5 minutes
    };

    // User activity listeners
    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keydown", resetTimer);
    window.addEventListener("click", resetTimer);
    window.addEventListener("scroll", resetTimer);

    resetTimer(); // start timer immediately

    return () => {
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keydown", resetTimer);
      window.removeEventListener("click", resetTimer);
      window.removeEventListener("scroll", resetTimer);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [session, status]);

  return null;
}
