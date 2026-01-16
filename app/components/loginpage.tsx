"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, getSession } from "next-auth/react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Lock, LogIn, XCircle } from "lucide-react";
import { toast } from "sonner";

export function LoginForm() {
  const [username, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Reusable toast
  const showErrorToast = (title: string, message: string) => {
    toast.custom((id) => (
      <div
        className="bg-white border-1 border-red-500 text-red-500 p-6 rounded-lg text-lg shadow-lg w-sm"
        onClick={() => toast.dismiss(id)}
      >
        <div className="flex items-center gap-2">
          <div>
            <XCircle className="w-10 h-10 mt-1 text-white bg-red-500 rounded-3xl" />
          </div>
          <div>
            <h3 className="font-bold mb-0">{title}</h3>
            <p>{message}</p>
          </div>
        </div>
      </div>
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

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
        // Custom backend error
        if (res && res.error === "ACCOUNT_ALREADY_LOGGED_IN") {
          showErrorToast("Login Rejected", "Account is already logged in.");
          return;
        }

        // Default invalid credentials
        showErrorToast("Error", "Invalid credentials");
        return;
      }

      // ---------------------------
      // ✔ LOGIN SUCCESS
      // ---------------------------
      const session = await getSession();
      if (!session?.user) throw new Error("Session not found");

      router.push("/dashboard/properties");
      toast.success("Login Successfully");

    } catch (err) {
      console.error(err);
      toast.error("Unexpected error occurred during login.");
    } finally {
      setIsLoading(false);
    }
  };

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
                value={username}
                onChange={(e) => setUserName(e.target.value)}
                required
                disabled={isLoading}
                className="h-11 w-full border border-shadow border-gray-300"
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
                className="h-11 w-full border border-shadow border-gray-300"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-blue-600 text-white hover:bg-blue-400 hover:text-white"
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
