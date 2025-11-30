"use client";

import * as React from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";

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

export const TopHeaderAdmin: React.FC = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [imageUrl, setImageUrl] = React.useState<string>("/avatar.jpg");

  // --------------------------------------------------
  // Avatar Fetch Logic
  // --------------------------------------------------
  React.useEffect(() => {
    const fetchAvatar = async () => {
      try {
        const profilePath = session?.user?.profileImageUrl;
        if (!profilePath) return;

        const res = await fetch(
          `/api/gcp/getSignedUrl?path=${encodeURIComponent(profilePath)}&ts=${Date.now()}`
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
      : session?.user?.username ?? "Guest";

  const userInitials = (firstName || session?.user?.username || "G")
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase();

  // --------------------------------------------------
  // Logout Handler
  // --------------------------------------------------
  const handleLogout = () => {
    sessionStorage.setItem("isLoggingOut", "true");
    signOut({ redirect: false }).then(() => router.replace("/login"));
  };

  // --------------------------------------------------
  // Navigation Items
  // --------------------------------------------------
  const navItems = [
    { label: "Dashboard", path: "/dashboard/main", icon: <CircleGauge className="w-4 h-4" /> },
    { label: "Properties", path: "/dashboard/properties", icon: <Home className="w-4 h-4" /> },
    { label: "Leases", path: "/dashboard/leases", icon: <ClipboardList className="w-4 h-4" /> },
    { label: "Contact", path: "/dashboard/contact", icon: <Contact className="w-4 h-4" /> },
    { label: "Documents", path: "/dashboard/documents", icon: <FileText className="w-4 h-4" /> },
    { label: "Review", path: "/dashboard/review", icon: <View className="w-4 h-4" /> },
    { label: "Audit Trail", path: "/dashboard/audit-trail", icon: <Activity className="w-4 h-4" /> },
    { label: "Users", path: "/dashboard/users", icon: <Users className="w-4 h-4" /> },
  ];

  return (
    <aside className="h-screen w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-200">
        <div className="w-12 h-12 bg-blue-600 rounded-md flex items-center justify-center">
          <Building2 className="w-8 h-8 text-white" />
        </div>
        <div className="flex flex-col leading-tight">
          <h1 className="text-lg font-semibold text-black">Phoenix Project</h1>
          <span className="text-xs text-gray-600">
            Real Property Management
          </span>
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
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Profile / Bottom Zone */}
      <div className="border-t border-gray-200 p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-gray-100">
              <Avatar className="w-10 h-10">
                <AvatarImage src={imageUrl} alt={displayName} />
                <AvatarFallback>{userInitials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-medium text-gray-800 text-sm">{displayName}</span>
                <span className="text-xs text-gray-500">{session?.user?.role}</span>
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