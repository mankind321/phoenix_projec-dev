"use client";

import * as React from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import {
  CircleGauge,
  Home,
  ClipboardList,
  Contact,
  FileText,
  View,
  Activity,
  Users,
  Building2,
  KeyRound,
  User,
  LogOut,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { ChangePasswordModal } from "@/app/components/changePasswordModal";

import { useRealtimeTest } from "@/hooks/useRealtimeTest";

export const TopHeaderAdmin: React.FC = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [imageUrl, setImageUrl] = React.useState<string>("/avatar.jpg");

  const [reviewCount, setReviewCount] = React.useState(0);

  const fetchReviewCount = React.useCallback(async () => {
    try {
      const res = await fetch("/api/review/count");

      if (!res.ok) throw new Error("Failed to fetch review count");

      const json = await res.json();

      setReviewCount(json.total ?? 0);
    } catch (err) {
      console.error("Review count fetch error:", err);
    }
  }, []);

  React.useEffect(() => {
    fetchReviewCount();
  }, [fetchReviewCount]);

  React.useEffect(() => {
    const handler = () => {
      fetchReviewCount();
    };

    window.addEventListener("review-count-updated", handler);

    return () => {
      window.removeEventListener("review-count-updated", handler);
    };
  }, [fetchReviewCount]);

  useRealtimeTest(true, {
    // PASSED BUT NOT RENT ROLL → REVIEW QUEUE
    onReviewReady: fetchReviewCount,

    // FAILED → REVIEW QUEUE
    onExtractionFailed: fetchReviewCount,

    // RENT ROLL PASSED → TENANT VIEW READY
    onTenantReady: () => {
      window.dispatchEvent(new Event("document-list-updated"));
    },
  });

  // --------------------------------------------------
  // Avatar Fetch Logic
  // --------------------------------------------------
  React.useEffect(() => {
    const fetchAvatar = async () => {
      try {
        const profilePath = session?.user?.profileImageUrl;
        if (!profilePath) return;

        const res = await fetch(
          `/api/gcp/getSignedUrl?path=${encodeURIComponent(profilePath)}&ts=${Date.now()}`,
        );

        const data = await res.json();
        if (data.success && data.url) {
          setImageUrl(data.url);
        }
      } catch (err) {
        console.warn("Avatar fetch failed:", err);
      }
    };

    fetchAvatar();
    const interval = setInterval(fetchAvatar, 45 * 60 * 1000);
    return () => clearInterval(interval);
  }, [session?.user?.profileImageUrl]);

  // --------------------------------------------------
  // Display Name / Initials
  // --------------------------------------------------
  const firstName = session?.user?.firstName ?? "";
  const lastName = session?.user?.lastName ?? "";
  const displayName =
    firstName || lastName
      ? `${firstName} ${lastName}`.trim()
      : (session?.user?.username ?? "Guest");

  const userInitials = (firstName || session?.user?.username || "G")
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase();

  // --------------------------------------------------
  // Logout Handler (FINAL CLEAN VERSION)
  // --------------------------------------------------
  const handleLogout = async () => {
    try {
      const payload = JSON.stringify({
        accountId: session?.user?.accountId,
        username: session?.user?.username,
      });

      // 1️⃣ Mark logout as intentional (so layout won't show error toast)
      sessionStorage.setItem("isLoggingOut", "true");

      // 2️⃣ Mark user offline instantly & reliably (sendBeacon survives fast tab close)
      navigator.sendBeacon("/api/auth/update-status-offline", payload);

      // 3️⃣ Sign out user
      await signOut({ redirect: false });

      // 4️⃣ Go to login page
      router.replace("/login");
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  // --------------------------------------------------
  // Navigation Items
  // --------------------------------------------------
  const navItems = [
    {
      label: "Property Search",
      path: "/dashboard/properties",
      icon: <Home className="w-4 h-4" />,
    },
    {
      label: "Tenants",
      path: "/dashboard/leases",
      icon: <ClipboardList className="w-4 h-4" />,
    },
    {
      label: "Contacts",
      path: "/dashboard/contact",
      icon: <Contact className="w-4 h-4" />,
    },
    {
      label: "Documents",
      path: "/dashboard/documents",
      icon: <FileText className="w-4 h-4" />,
    },
    {
      label: "Statistics",
      path: "/dashboard/main",
      icon: <CircleGauge className="w-4 h-4" />,
    },

    {
      label: "Review",
      path: "/dashboard/review",
      icon: <View className="w-4 h-4" />,
      badge: reviewCount,
    },

    {
      label: "Audit Trail",
      path: "/dashboard/audit-trail",
      icon: <Activity className="w-4 h-4" />,
    },
    {
      label: "Users",
      path: "/dashboard/users",
      icon: <Users className="w-4 h-4" />,
    },
  ];

  return (
    <aside className="sidebar-scroll h-screen w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-200">
        <div className="w-12 h-12 bg-blue-600 rounded-md flex items-center justify-center">
          <div className="m-6">
            <Building2 className="w-10 h-10 text-white" />
          </div>
        </div>
        <div className="flex flex-col leading-tight">
          <h1 className="text-lg font-semibold text-black">
            Commerical Property Database
          </h1>
          <span className="text-xs text-gray-600">Investment Properties</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname?.startsWith(item.path);

            return (
              <li key={item.label}>
                <button
                  onClick={() => router.push(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-2 rounded-md text-sm transition ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-gray-700 hover:bg-blue-50 hover:text-blue-600"
                  }`}
                >
                  {item.icon}
                  <div className="flex items-center justify-between w-full">
                    <span>{item.label}</span>

                    {(item.badge ?? 0) > 0 && (
                      <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-red-500 text-white rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Profile */}
      <div className="border-t border-gray-200 p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-gray-100">
              <Avatar className="w-10 h-10">
                <AvatarImage src={imageUrl} alt={displayName} />
                <AvatarFallback>{userInitials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-medium text-gray-800 text-sm">
                  {displayName}
                </span>
                <span className="text-xs text-gray-500">
                  {session?.user?.role}
                </span>
              </div>
            </div>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => router.push("/dashboard/users/profile")}
              className="flex items-center gap-2"
            >
              <User className="w-4 h-4" /> Update Information
            </DropdownMenuItem>

            <ChangePasswordModal>
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="flex items-center gap-2"
              >
                <KeyRound className="w-4 h-4" /> Change Password
              </DropdownMenuItem>
            </ChangePasswordModal>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleLogout}
              className="flex items-center gap-2 text-red-600"
            >
              <LogOut className="w-4 h-4 text-red-600" /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
};

export default TopHeaderAdmin;
