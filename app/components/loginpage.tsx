"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, getSession } from "next-auth/react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Lock, LogIn, XCircle } from "lucide-react";
import { toast } from "sonner";

export function LoginForm() {
  const [username, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // ==========================================
  // 🔔 REUSABLE ERROR TOAST
  // ==========================================
  const showErrorToast = (title: string, message: string) => {
    toast.custom((id) => (
      <div
        className="bg-white border border-red-500 text-red-500 p-6 rounded-lg text-lg shadow-lg w-sm cursor-pointer"
        onClick={() => toast.dismiss(id)}
      >
        <div className="flex items-center gap-3">
          <XCircle className="w-10 h-10 text-white bg-red-500 rounded-full p-1" />
          <div>
            <h3 className="font-bold">{title}</h3>
            <p>{message}</p>
          </div>
        </div>
      </div>
    ));
  };

  // ==========================================
  // 🔐 LOGIN HANDLER
  // ==========================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // 🔴 IMPORTANT: mark login in progress
    sessionStorage.setItem("isLoggingIn", "true");

    try {
      const res = await signIn("credentials", {
        redirect: false,
        username,
        password,
      });

      // ---------------------------
      // ❌ LOGIN FAILED
      // ---------------------------
      if (!res || !res.ok) {
        sessionStorage.removeItem("isLoggingIn");

        switch (res?.error) {
          case "USER_NOT_FOUND":
            showErrorToast("Login Failed", "Username does not exist.");

            // ✅ Clear username AND password
            setUserName("");
            setPassword("");
            break;

          case "INVALID_PASSWORD":
            showErrorToast("Login Failed", "Password incorrect.");

            // ✅ Clear ONLY password
            setPassword("");
            break;

          case "ACCOUNT_ALREADY_LOGGED_IN":
            showErrorToast("Login Rejected", "Account is already logged in.");

            // optional: clear password for security
            setPassword("");
            break;

          default:
            showErrorToast("Login Failed", "Invalid username or password.");

            // optional fallback
            setPassword("");
        }

        return;
      }

      // ---------------------------
      // ✔ LOGIN SUCCESS
      // ---------------------------
      const session = await getSession();
      if (!session?.user) {
        throw new Error("Session not found after login");
      }

      // 🔑 CLEAR ALL AUTH FLAGS
      sessionStorage.removeItem("isLoggingIn");
      sessionStorage.removeItem("isLoggingOut");
      sessionStorage.removeItem("user-inactive");

      toast.success("Login successfully");
      router.push("/dashboard/properties");
    } catch (err) {
      console.error("Login error:", err);

      sessionStorage.removeItem("isLoggingIn");
      toast.error("Unexpected error occurred during login.");
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // 🧩 UI
  // ==========================================
  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-xl mx-4 shadow-md border border-gray-200 rounded-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-5 rounded-full bg-blue-600">
              <Lock className="w-7 h-7 text-primary-foreground" />
            </div>
          </div>
          <CardTitle>Welcome User</CardTitle>
          <CardDescription>
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>

        <CardContent className="px-15 py-10">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="username"
                value={username}
                onChange={(e) => setUserName(e.target.value)}
                required
                disabled={isLoading}
                className="h-11 w-full border border-gray-300"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="h-11 w-full border border-gray-300"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-blue-600 text-white hover:bg-blue-500"
              disabled={isLoading}
            >
              <div className="flex items-center gap-2">
                <LogIn className="w-6 h-6" />
                {isLoading ? "Signing in..." : "Sign In"}
              </div>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default LoginForm;
