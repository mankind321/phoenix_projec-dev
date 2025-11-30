"use client";

import { ReactNode } from "react";
import { useSession } from "next-auth/react";

interface CanProps {
  role?: string | string[]; // allowed roles
  not?: boolean;            // invert check
  children: ReactNode;
}

export function Can({ role, not = false, children }: CanProps) {
  const { data: session, status } = useSession();

  if (status !== "authenticated") return null; // hide if not logged in

  const userRole = session?.user?.role ?? "Guest";

  // If no role is specified → allow all authenticated users
  if (!role) return <>{children}</>;

  // Normalize role into array
  const roles = Array.isArray(role) ? role : [role];

  const hasAccess = roles.includes(userRole);

  // If "not" is used → invert logic
  const shouldRender = not ? !hasAccess : hasAccess;

  return shouldRender ? <>{children}</> : null;
}