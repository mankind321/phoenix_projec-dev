"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

const IDLE_TIME = 10 * 60 * 1000; // ✅ 10 minutes

export function AutoLogout() {
  const { status } = useSession();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;

    const markInactive = () => {
      sessionStorage.setItem("user-inactive", "true");
    };

    const resetTimer = () => {
      // ✅ Normalize inactive flag
      sessionStorage.setItem("user-inactive", "false");

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(markInactive, IDLE_TIME);
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];

    events.forEach(event =>
      window.addEventListener(event, resetTimer)
    );

    resetTimer(); // start timer immediately

    return () => {
      events.forEach(event =>
        window.removeEventListener(event, resetTimer)
      );
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [status]);

  return null;
}