/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import React, { ChangeEvent, useEffect, useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar, Mail, Phone, User, ImageIcon, Send } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";

interface UserFormData {
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  email: string;
  mobile: string;
  address: string;
  licenseNumber: string;
  licenseIssuedBy: string;
  licenseExpiration: string;
  profileImage: File | null;
  profileImageUrl?: string;
}

interface Account {
  username: string;
  password: string;
  confirmPassword: string;
  role: string;
  managerId?: string | null;
  manager: string;
}

const UserRegistrationForm: React.FC = () => {
  const router = useRouter();
  const params = useSearchParams();
  const userId = params.get("id");
  const isEditMode = Boolean(userId);

  const [formData, setFormData] = useState<UserFormData>({
    firstName: "",
    middleName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    email: "",
    mobile: "",
    address: "",
    licenseNumber: "",
    licenseIssuedBy: "",
    licenseExpiration: "",
    profileImage: null,
    profileImageUrl: "",
  });

  const [accountData, setAccountData] = useState<Account>({
    username: "",
    password: "",
    confirmPassword: "",
    role: "",
    managerId: null,
    manager: "",
  });

  const [originalUsername, setOriginalUsername] = useState("");
  const usernameCheckTimer = useRef<NodeJS.Timeout | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [managers, setManagers] = useState<{ accountid: number; name: string }[]>([]);

  // ---------------------- EDIT MODE DATA LOAD ----------------------
  useEffect(() => {
    if (!isEditMode) return;

    let refreshTimer: NodeJS.Timeout;

    const fetchUser = async () => {
      try {
        const res = await fetch(`/api/users/${userId}`);
        const data = await res.json();

        if (!data.success || !data.user) {
          toast.error("Failed to load user data");
          return;
        }

        const u = data.user;

        setFormData({
          firstName: u.first_name,
          middleName: u.middle_name || "",
          lastName: u.last_name,
          dateOfBirth: u.date_of_birth,
          gender: u.gender,
          email: u.email,
          mobile: u.mobile,
          address: u.address,
          licenseNumber: u.license_number,
          licenseIssuedBy: u.license_issued_by,
          licenseExpiration: u.license_expiration,
          profileImage: null,
          profileImageUrl: u.profile_image_url || "",
        });

        setAccountData({
          username: u.username,
          password: "",
          confirmPassword: "",
          role: u.role,
          managerId: u.manager_id || null,
          manager: u.manager || "",
        });

        setOriginalUsername(u.username);

        // Load GCP Image
        const loadSignedUrl = async () => {
          try {
            if (!u.profile_image_url) {
              setPreviewImage("/avatar.jpg");
              return;
            }

            const resUrl = await fetch(
              `/api/gcp/getSignedUrl?path=${encodeURIComponent(u.profile_image_url)}`
            );
            const dataUrl = await resUrl.json();

            if (dataUrl.success && dataUrl.url) {
              setPreviewImage(dataUrl.url);
              refreshTimer = setTimeout(loadSignedUrl, 50 * 60 * 1000);
            } else {
              setPreviewImage("/avatar.jpg");
            }
          } catch {
            setPreviewImage("/avatar.jpg");
          }
        };

        await loadSignedUrl();
      } catch (error) {
        toast.error("Error fetching user data");
      }
    };

    fetchUser();
    return () => clearTimeout(refreshTimer);
  }, [isEditMode, userId]);

  // Load managers
  useEffect(() => {
    async function fetchManagers() {
      try {
        const res = await fetch("/api/users/managers");
        const data = await res.json();
        if (data.success) setManagers(data.managers);
      } catch {}
    }
    fetchManagers();
  }, []);

  // ---------------------- HANDLE ACCOUNT CHANGE ----------------------
  const handleAccountChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
  const { name, value } = e.target;

  setAccountData((prev) => ({ ...prev, [name]: value }));

  // ----------------- USERNAME VALIDATION ------------------ //
  if (name === "username") {
    if (usernameCheckTimer.current) clearTimeout(usernameCheckTimer.current);

    usernameCheckTimer.current = setTimeout(async () => {
      if (!value.trim()) return;

      // Skip validation if editing and username unchanged
      if (isEditMode && value === originalUsername) return;

      setCheckingUsername(true);

      try {
        const res = await fetch(`/api/users/check-username?username=${value}`);
        const data = await res.json();

        // 🚫 Invalid username (special characters, etc.)
        if (data.status === "invalid") {
          toast.error(data.message || "Invalid username format", {
            id: "username-invalid",
          });
          return;
        }

        // ❌ Username taken
        if (data.status === "taken") {
          toast.error("Username already taken", {
            id: "username-exists",
          });
          return;
        }

        // ✔ Username available
        if (data.status === "available") {
          toast.success("Username is available ✔", {
            id: "username-ok",
          });
        }
      } catch (err) {
        toast.error("Unable to validate username");
      } finally {
        setCheckingUsername(false);
      }
    }, 500);
  }

  // ---------------- PASSWORD VALIDATION ---------------- //
  if (name === "password" || name === "confirmPassword") {
    const updatedPassword = name === "password" ? value : accountData.password;
    const updatedConfirm = name === "confirmPassword" ? value : accountData.confirmPassword;

    if (updatedPassword && updatedConfirm) {
      if (updatedPassword !== updatedConfirm) {
        toast.error("Passwords do not match", { id: "pw-mismatch" });
      } else {
        toast.dismiss("pw-mismatch");
        toast.success("Passwords match ✔", { id: "pw-match" });
      }
    }
  }

  // -------------- MANAGER SELECTION ---------------- //
  if (name === "managerId") {
    const selectedManager = managers.find((m) => m.accountid === parseInt(value));

    setAccountData((prev) => ({
      ...prev,
      managerId: value,
      manager: selectedManager ? selectedManager.name : "",
    }));
  }
};

  // ---------------------- HANDLE USER INPUT ----------------------
  const handleUserChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // ---------------------- IMAGE HANDLING ----------------------
  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;

    const file = e.target.files[0];
    setFormData((prev) => ({ ...prev, profileImage: file }));

    const reader = new FileReader();
    reader.onload = () => setPreviewImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleImageClick = () => fileInputRef.current?.click();

  // ---------------------- SUBMIT ----------------------
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUploading(true);

    let uploadedImageUrl = formData.profileImageUrl;

    // Upload new image if provided
    if (formData.profileImage) {
      try {
        toast.loading("Uploading image...", { id: "upload-toast" });

        const imageData = new FormData();
        imageData.append("file", formData.profileImage);

        const res = await fetch("/api/upload/profile", {
          method: "POST",
          body: imageData,
        });

        const result = await res.json();
        if (!result.success) throw new Error();

        uploadedImageUrl = result.path;
        toast.success("Image uploaded successfully!", { id: "upload-toast" });
      } catch {
        toast.error("Image upload failed", { id: "upload-toast" });
        setUploading(false);
        return;
      }
    }

    const payload = {
      formData: { ...formData, profileImageUrl: uploadedImageUrl },
      accountData,
    };

    try {
      toast.loading(isEditMode ? "Updating user..." : "Registering user...", { id: "save-toast" });

      const res = await fetch(isEditMode ? `/api/users/${userId}` : "/api/users", {
        method: isEditMode ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(
          isEditMode ? "User updated successfully!" : "User registered!",
          { id: "save-toast" }
        );
        setTimeout(() => router.back(), 1500);
      } else {
        toast.error(data.message || "Failed to save user", { id: "save-toast" });
      }
    } catch {
      toast.error("Server error occurred", { id: "save-toast" });
    } finally {
      setUploading(false);
    }
  };

  // ---------------------- UI ----------------------
  return (
    <div className="w-11/12 mx-auto mt-6 space-y-6">
      <h2 className="text-2xl font-semibold text-center mb-6">
        {isEditMode ? "Update User" : "User Registration"}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Profile Image */}
        <div className="flex flex-col items-center mb-6 cursor-pointer" onClick={handleImageClick}>
          {previewImage ? (
            <Image
              src={previewImage}
              alt="Profile"
              width={128}
              height={128}
              className="w-32 h-32 rounded-full object-cover mb-2 ring-1 ring-gray-300 hover:ring-blue-400"
            />
          ) : (
            <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center mb-2">
              <ImageIcon className="w-8 h-8 text-gray-400" />
            </div>
          )}

          <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageChange} className="hidden" />

          <p className="text-sm text-gray-500">
            {uploading ? "Uploading..." : "Click image to upload"}
          </p>
        </div>

        {/* PERSONAL INFORMATION */}
        <div className="space-y-4">
          <div className="text-lg font-semibold border-b pb-2">
            Personal Information
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* First Name */}
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <div className="relative">
                <Input
                  id="firstName"
                  name="firstName"
                  placeholder="First Name"
                  value={formData.firstName}
                  onChange={handleUserChange}
                  required
                  className="pl-10"
                />
                <User className="absolute left-3 top-3 h-4 w-4 text-gray-400 mt-2" />
              </div>
            </div>

            {/* Middle Name */}
            <div>
              <Label htmlFor="middleName">Middle Name</Label>
              <Input
                id="middleName"
                name="middleName"
                placeholder="Middle Name"
                value={formData.middleName}
                onChange={handleUserChange}
              />
            </div>

            {/* Last Name */}
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                name="lastName"
                placeholder="Last Name"
                value={formData.lastName}
                onChange={handleUserChange}
                required
              />
            </div>
          </div>

          {/* DOB + Gender */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dateOfBirth">Date of Birth</Label>
              <div className="relative">
                <Input
                  type="date"
                  id="dateOfBirth"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleUserChange}
                  required
                  className="pl-10"
                />
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400 mt-2" />
              </div>
            </div>

            <div>
              <Label htmlFor="gender">Gender</Label>
              <select
                id="gender"
                name="gender"
                value={formData.gender}
                onChange={handleUserChange}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 mt-2 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Contact Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Email */}
            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="Email"
                  value={formData.email}
                  onChange={handleUserChange}
                  required
                  className="pl-10"
                />
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400 mt-2" />
              </div>
            </div>

            {/* Mobile */}
            <div>
              <Label htmlFor="mobile">Mobile Number</Label>
              <div className="relative">
                <Input
                  type="tel"
                  id="mobile"
                  name="mobile"
                  placeholder="Mobile Number"
                  value={formData.mobile}
                  onChange={handleUserChange}
                  required
                  className="pl-10"
                />
                <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400 mt-2" />
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <Label htmlFor="address">Residential Address</Label>
            <Input
              id="address"
              name="address"
              placeholder="Street, City, State, ZIP"
              value={formData.address}
              onChange={handleUserChange}
              required
            />
          </div>
        </div>

        {/* PROFESSIONAL INFO */}
        <div className="space-y-4">
          <div className="text-lg font-semibold border-b pb-2">
            Professional Information
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* License Number */}
            <div>
              <Label htmlFor="licenseNumber">License Number</Label>
              <Input
                id="licenseNumber"
                name="licenseNumber"
                placeholder="License Number"
                value={formData.licenseNumber}
                onChange={handleUserChange}
                required
              />
            </div>

            {/* Issued By */}
            <div>
              <Label htmlFor="licenseIssuedBy">License Issued By</Label>
              <Input
                id="licenseIssuedBy"
                name="licenseIssuedBy"
                placeholder="City / State / Authority"
                value={formData.licenseIssuedBy}
                onChange={handleUserChange}
                required
              />
            </div>

            {/* Expiration */}
            <div>
              <Label htmlFor="licenseExpiration">License Expiration</Label>
              <Input
                type="date"
                id="licenseExpiration"
                name="licenseExpiration"
                value={formData.licenseExpiration}
                onChange={handleUserChange}
                required
              />
            </div>
          </div>
        </div>

        {/* ACCOUNT REGISTRATION */}
        <div className="space-y-4">
          <div className="text-lg font-semibold border-b pb-2">Account Registration</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Username */}
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                placeholder="Username"
                value={accountData.username}
                onChange={handleAccountChange}
                required
              />
            </div>

            {/* Role */}
            <div>
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                name="role"
                value={accountData.role}
                onChange={handleAccountChange}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 mt-2 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Role</option>
                <option value="Agent">Agent</option>
                <option value="Manager">Manager</option>
                <option value="Admin">Admin</option>
              </select>
            </div>

            {/* Manager Dropdown */}
            {accountData.role === "Agent" && (
              <div className="col-span-2">
                <Label htmlFor="managerId">Manager</Label>
                <select
                  id="managerId"
                  name="managerId"
                  value={accountData.managerId ?? ""}
                  onChange={handleAccountChange}
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 mt-2"
                >
                  <option value="">Select Manager</option>
                  {managers.map((m) => (
                    <option key={m.accountid} value={m.accountid.toString()}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Password */}
            <div>
              <Label htmlFor="password">New Password (optional)</Label>
              <Input
                type="password"
                id="password"
                name="password"
                placeholder="Leave blank to keep current password"
                value={accountData.password}
                onChange={handleAccountChange}
                required={!isEditMode}
              />
            </div>

            {/* Confirm Password */}
            <div>
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                placeholder="Confirm new password"
                value={accountData.confirmPassword}
                onChange={handleAccountChange}
                required={!isEditMode}
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <Button type="submit" disabled={uploading} className="w-full font-bold bg-blue-600 hover:bg-blue-700 text-white mt-4">
          <Send className="w-5 h-5 mr-2" />
          {isEditMode ? "Update" : "Submit"}
        </Button>
      </form>
    </div>
  );
};

export default UserRegistrationForm;
