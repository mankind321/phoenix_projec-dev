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

/* ================= TYPES ================= */

interface UserFormData {
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string | null;
  email: string;
  mobile: string;
  address: string | null;
  licenseNumber: string | null;
  licenseIssuedBy: string | null;
  licenseExpiration: string | null;
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

/* ================= NORMALIZER ================= */

const normalizeOptionalFields = (data: UserFormData): UserFormData => ({
  ...data,
  dateOfBirth: data.dateOfBirth || "1990-01-01",
  gender: data.gender || "",
  address: data.address || "",
  licenseNumber: data.licenseNumber || crypto.randomUUID(),
  licenseIssuedBy: data.licenseIssuedBy || "",
  licenseExpiration: data.licenseExpiration || "1990-01-01",
});

/* ================= COMPONENT ================= */

const UserRegistrationForm: React.FC = () => {
  const router = useRouter();
  const params = useSearchParams();
  const userId = params.get("id");
  const isEditMode = Boolean(userId);

  const [formData, setFormData] = useState<UserFormData>({
    firstName: "",
    middleName: "",
    lastName: "",
    dateOfBirth: null,
    gender: null,
    email: "",
    mobile: "",
    address: null,
    licenseNumber: null,
    licenseIssuedBy: null,
    licenseExpiration: null,
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

  const [submitted, setSubmitted] = useState(false);
  const [originalUsername, setOriginalUsername] = useState("");
  const usernameCheckTimer = useRef<NodeJS.Timeout | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ============================================================
     🔁 RESTORED CODE #1 — MANAGERS STATE (PREVIOUSLY REMOVED)
     ============================================================ */
  const [managers, setManagers] = useState<
    { accountid: number; name: string }[]
  >([]);

  /* ================= EDIT MODE LOAD ================= */

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
          dateOfBirth: u.date_of_birth ?? null,
          gender: u.gender ?? null,
          email: u.email,
          mobile: u.mobile,
          address: u.address ?? null,
          licenseNumber: u.license_number ?? null,
          licenseIssuedBy: u.license_issued_by ?? null,
          licenseExpiration: u.license_expiration ?? null,
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

        const loadSignedUrl = async () => {
          try {
            if (!u.profile_image_url) {
              setPreviewImage("/avatar.jpg");
              return;
            }

            const resUrl = await fetch(
              `/api/gcp/getSignedUrl?path=${encodeURIComponent(
                u.profile_image_url,
              )}`,
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
      } catch {
        toast.error("Error fetching user data");
      }
    };

    fetchUser();
    return () => clearTimeout(refreshTimer);
  }, [isEditMode, userId]);

  /* ============================================================
     🔁 RESTORED CODE #2 — FETCH MANAGERS (PREVIOUSLY REMOVED)
     ============================================================ */
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

  /* ================= HELPERS ================= */

  const inputErrorClass = (hasError: boolean) =>
    hasError && submitted
      ? "border-red-500 focus:ring-red-500 focus:border-red-500"
      : "";

  /* ================= HANDLERS ================= */

  /* ============================================================
     🔁 RESTORED CODE #3 — ACCOUNT CHANGE HANDLER WITH MANAGER LOGIC
     ============================================================ */
  const handleAccountChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;

    setAccountData((prev) => ({ ...prev, [name]: value }));

    // 🔁 MANAGER SELECTION LOGIC (RESTORED)
    if (name === "managerId") {
      const selectedManager = managers.find(
        (m) => m.accountid === parseInt(value),
      );

      setAccountData((prev) => ({
        ...prev,
        managerId: value,
        manager: selectedManager ? selectedManager.name : "",
      }));
    }
  };

  const handleUserChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;

    const file = e.target.files[0];
    setFormData((prev) => ({ ...prev, profileImage: file }));

    const reader = new FileReader();
    reader.onload = () => setPreviewImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleImageClick = () => fileInputRef.current?.click();

  /* ================= SUBMIT ================= */

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);

    const requiredErrors = {
      firstName: !formData.firstName.trim(),
      lastName: !formData.lastName.trim(),
      email: !formData.email.trim(),
      mobile: !formData.mobile.trim(),
      username: !accountData.username.trim(),
      role: !accountData.role.trim(),
      manager: accountData.role === "Agent" && !accountData.managerId,
      password: !isEditMode && !accountData.password,
      confirmPassword: !isEditMode && !accountData.confirmPassword,
    };

    // Check required fields first
    if (Object.values(requiredErrors).some(Boolean)) {
      toast.error("Please fill out all required fields.");
      return;
    }

    // ✅ NEW: Password mismatch validation
    // Only validate if user entered a password OR if creating new user
    const isPasswordEntered =
      accountData.password.trim().length > 0 ||
      accountData.confirmPassword.trim().length > 0;

    if (
      (!isEditMode || isPasswordEntered) &&
      accountData.password !== accountData.confirmPassword
    ) {
      toast.error("Password and Confirm Password do not match.");
      return;
    }

    setUploading(true);

    let uploadedImageUrl = formData.profileImageUrl;

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
        toast.success("Image uploaded successfully!", {
          id: "upload-toast",
        });
      } catch {
        toast.error("Image upload failed", { id: "upload-toast" });
        setUploading(false);
        return;
      }
    }

    const payload = {
      formData: normalizeOptionalFields({
        ...formData,
        profileImageUrl: uploadedImageUrl,
      }),
      accountData,
    };

    try {
      toast.loading(isEditMode ? "Updating user..." : "Registering user...", {
        id: "save-toast",
      });

      const res = await fetch(
        isEditMode ? `/api/users/${userId}` : "/api/users",
        {
          method: isEditMode ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const data = await res.json();

      if (data.success) {
        toast.success(
          isEditMode ? "User updated successfully!" : "User registered!",
          { id: "save-toast" },
        );
        setTimeout(() => router.back(), 1500);
      } else {
        toast.error(data.message || "Failed to save user", {
          id: "save-toast",
        });
      }
    } catch {
      toast.error("Server error occurred", { id: "save-toast" });
    } finally {
      setUploading(false);
    }
  };

  /* ================= UI ================= */

  return (
    <div className="w-11/12 mx-auto mt-6 space-y-6">
      <h2 className="text-2xl font-semibold text-center mb-6">
        {isEditMode ? "Update User" : "User Registration"}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile Image */}
        <div
          className="flex flex-col items-center mb-6 cursor-pointer"
          onClick={handleImageClick}
        >
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

          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageChange}
            className="hidden"
          />

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
              <Label htmlFor="firstName">
                First Name<span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleUserChange}
                  required
                  className={`pl-10 ${inputErrorClass(
                    !formData.firstName.trim(),
                  )}`}
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
                value={formData.middleName}
                onChange={handleUserChange}
              />
            </div>

            {/* Last Name */}
            <div>
              <Label htmlFor="lastName">
                Last Name<span className="text-red-500">*</span>
              </Label>
              <Input
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleUserChange}
                required
                className={inputErrorClass(!formData.lastName.trim())}
              />
            </div>
          </div>

          {/* DOB + Gender (HIDDEN) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 hidden">
            <div>
              <Label htmlFor="dateOfBirth">Date of Birth</Label>
              <div className="relative">
                <Input
                  type="date"
                  id="dateOfBirth"
                  name="dateOfBirth"
                  value={formData.dateOfBirth ?? ""}
                  onChange={handleUserChange}
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
                value={formData.gender ?? ""}
                onChange={handleUserChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2 mt-2 focus:ring-1 focus:ring-blue-500"
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
              <Label htmlFor="email">
                Email<span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleUserChange}
                  required
                  className={`pl-10 ${inputErrorClass(!formData.email.trim())}`}
                />
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400 mt-2" />
              </div>
            </div>

            {/* Mobile */}
            <div>
              <Label htmlFor="mobile">
                Mobile Number<span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="mobile"
                  name="mobile"
                  value={formData.mobile}
                  onChange={handleUserChange}
                  required
                  className={`pl-10 ${inputErrorClass(
                    !formData.mobile.trim(),
                  )}`}
                />
                <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400 mt-2" />
              </div>
            </div>
          </div>

          {/* Address (HIDDEN) */}
          <div className="hidden">
            <Label htmlFor="address">Residential Address</Label>
            <Input
              id="address"
              name="address"
              value={formData.address ?? ""}
              onChange={handleUserChange}
            />
          </div>
        </div>

        {/* PROFESSIONAL INFORMATION (HIDDEN) */}
        <div className="space-y-4 hidden">
          <div className="text-lg font-semibold border-b pb-2">
            Professional Information
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="licenseNumber">License Number</Label>
              <Input
                id="licenseNumber"
                name="licenseNumber"
                value={formData.licenseNumber ?? ""}
                onChange={handleUserChange}
              />
            </div>

            <div>
              <Label htmlFor="licenseIssuedBy">License Issued By</Label>
              <Input
                id="licenseIssuedBy"
                name="licenseIssuedBy"
                value={formData.licenseIssuedBy ?? ""}
                onChange={handleUserChange}
              />
            </div>

            <div>
              <Label htmlFor="licenseExpiration">License Expiration</Label>
              <Input
                type="date"
                id="licenseExpiration"
                name="licenseExpiration"
                value={formData.licenseExpiration ?? ""}
                onChange={handleUserChange}
              />
            </div>
          </div>
        </div>

        {/* ACCOUNT REGISTRATION */}
        <div className="space-y-4">
          <div className="text-lg font-semibold border-b pb-2">
            Account Registration
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Username */}
            <div>
              <Label htmlFor="username">
                Username<span className="text-red-500">*</span>
              </Label>
              <Input
                id="username"
                name="username"
                value={accountData.username}
                onChange={handleAccountChange}
                required
                className={inputErrorClass(!accountData.username.trim())}
              />
            </div>

            {/* Role */}
            <div>
              <Label htmlFor="role">
                Role<span className="text-red-500">*</span>
              </Label>
              <select
                id="role"
                name="role"
                value={accountData.role}
                onChange={handleAccountChange}
                required
                className={`w-full border rounded-md px-3 py-2 mt-2 ${inputErrorClass(
                  !accountData.role.trim(),
                )}`}
              >
                <option value="">Select Role</option>
                <option value="Agent">Agent</option>
                <option value="Manager">Manager</option>
                <option value="Admin">Admin</option>
              </select>
            </div>

            {/* MANAGER (Agent only) */}
            {accountData.role === "Agent" && (
              <div className="col-span-2">
                <Label htmlFor="managerId">
                  Manager<span className="text-red-500">*</span>
                </Label>
                <select
                  id="managerId"
                  name="managerId"
                  value={accountData.managerId ?? ""}
                  onChange={handleAccountChange}
                  required
                  className={`w-full border rounded-md px-3 py-2 mt-2 ${inputErrorClass(
                    !accountData.managerId,
                  )}`}
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
              <Label htmlFor="password">
                Password<span className="text-red-500">*</span>
              </Label>
              <Input
                type="password"
                id="password"
                name="password"
                value={accountData.password}
                onChange={handleAccountChange}
                required={!isEditMode}
                className={inputErrorClass(
                  !isEditMode && !accountData.password,
                )}
              />
            </div>

            {/* Confirm Password */}
            <div>
              <Label htmlFor="confirmPassword">
                Confirm Password<span className="text-red-500">*</span>
              </Label>
              <Input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={accountData.confirmPassword}
                onChange={handleAccountChange}
                required={!isEditMode}
                className={inputErrorClass(
                  !isEditMode && !accountData.confirmPassword,
                )}
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          disabled={uploading}
          className="w-full font-bold bg-blue-600 hover:bg-blue-700 text-white mt-4"
        >
          <Send className="w-5 h-5 mr-2" />
          {isEditMode ? "Update" : "Submit"}
        </Button>
      </form>
    </div>
  );
};

export default UserRegistrationForm;
