/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ChangePasswordModal({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [loading, startTransition] = useTransition();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const resetFields = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleSubmit = () => {
    if (!session?.user?.id) return;
    if (newPassword !== confirmPassword) {
      toast.error("Password confirmation does not match.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/users/profile/change-password", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: session.user.id,
            currentPassword,
            newPassword,
          }),
        });

        const json = await res.json();
        if (!json.success) throw new Error(json.message);

        toast.success("Password updated successfully!");
        setOpen(false);
        resetFields();
      } catch (err: any) {
        toast.error(err.message || "Failed to update password.");
      }
    });
  };

  return (
    <Dialog 
        open={open} 
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (isOpen) resetFields();  // ✅ clear fields every time modal opens
        }}
      >
      {children ? (
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
      ) : null}

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
          <DialogDescription>
            Please enter your current password and choose a new one.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Current Password</Label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>

          <div>
            <Label>New Password</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <div>
            <Label>Confirm New Password</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
        <Button
            type="button"
            disabled={loading}
            className="w-full font-medium bg-blue-600 hover:bg-blue-700 text-white"
            onClick={handleSubmit}
        >
            {loading ? "Saving..." : "Save Changes"}
        </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
