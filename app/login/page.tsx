"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, getSession } from "next-auth/react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Lock, LogIn, XCircle } from "lucide-react";
import { toast } from "sonner"

export function LoginForm() {
  const [username, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Sign in with NextAuth credentials provider
      const res = await signIn("credentials", {
        redirect: false,
        username,
        password,
      });

      if (!res?.ok) {
        //toast.error("Invalid credentials");
        toast.custom((id) => (
          <div className="bg-white border-1 border-red-500 text-red-500 p-6 rounded-lg text-lg shadow-lg w-sm" onClick={() => toast.dismiss(id)}>

            <div className="flex items-center gap-2">
              <div>
                <XCircle className="w-10 h-10 mt-1 text-white bg-red-500 rounded-3xl" />
              </div>
              <div>
                  <h3 className="font-bold mb-0">Error</h3>
                  <p>Invalid Credentials</p>
              </div>
            </div>
          </div>
        ));
        return; // stop further execution
      }

      // Fetch the session immediately after successful login
      const session = await getSession();

      if (!session?.user) throw new Error("Session not found");

      console.log(session);
      // Redirect based on role
      if (session.user.role === "Admin" || session.user.role === "Manager" ) router.push("/dashboard/main");
      else router.push("/dashboard/main");

      toast.success("Login Successfully");

    } catch (err) {
      console.error(err);
      alert("Invalid username or password");
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
          <CardTitle>Welcome Back</CardTitle>
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
