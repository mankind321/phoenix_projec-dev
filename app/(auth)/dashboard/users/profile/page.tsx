/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { User, Calendar, Mail, Phone, Home, Send } from "lucide-react";

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
  profileImageUrl: string;
}

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
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
    profileImageUrl: "/avatar.jpg"
  });

  const fetchSignedImageUrl = async (path: string) => {
    try {
      const res = await fetch(`/api/gcp/getSignedUrl?path=${encodeURIComponent(path)}`);
      const json = await res.json();
      if (json.success && json.url) {
        return json.url;
      }
      return "/avatar.jpg";
    } catch {
      return "/avatar.jpg";
    }
  };


  // ✅ Fetch profile from DB
  useEffect(() => {
    const loadProfile = async () => {
      if (!session?.user?.id) return;

      try {
        const res = await fetch(`/api/users/profile`,{cache: "no-store"});
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        const u = json.user;

        let avatarUrl = "/avatar.jpg";
        if (u.profile_image_url) {
          avatarUrl = await fetchSignedImageUrl(u.profile_image_url);
        }

        setFormData(prev => ({
          ...prev,
          firstName: u.first_name ?? "",
          middleName: u.middle_name ?? "",
          lastName: u.last_name ?? "",
          dateOfBirth: u.date_of_birth ?? "",
          gender: u.gender ?? "",
          email: u.email ?? "",
          mobile: u.mobile ?? "",
          address: u.address ?? "",
          licenseNumber: u.license_number ?? "",
          licenseIssuedBy: u.license_issued_by ?? "",
          licenseExpiration: u.license_expiration ?? "",
          profileImageUrl: avatarUrl,
        }));
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [session]);

  // ✅ Handle Input Change
  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // ✅ File Handler
  const handleFileChange = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormData(prev => ({
      ...prev,
      profileImage: file,
      profileImageUrl: URL.createObjectURL(file)
    }));
  };

  // ✅ Submit Profile Update
  const handleSubmit = async () => {
    try {
      setLoading(true); // only show spinner on button, not replace page

      let finalImagePath = formData.profileImageUrl;
      if (formData.profileImage) {
        const fd = new FormData();
        fd.append("file", formData.profileImage);
        const upload = await fetch("/api/upload/profile", {
          method: "POST",
          body: fd,
        });

        const uploadJson = await upload.json();
        if (!uploadJson.success) throw new Error(uploadJson.message);
        finalImagePath = uploadJson.path;
      }

      const payload = {
        formData: {
          ...formData,
          profileImageUrl: finalImagePath,
        },
      };
      console.log("payload:",payload);
      const res = await fetch("/api/users/profile/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      toast.success("Profile updated successfully!");

      // ✅ Update UI locally without triggering component reload
      setFormData(prev => ({
        ...prev,
        profileImage: null,
        profileImageUrl: prev.profileImageUrl,
      }));

      // ✅ Force avatar refresh LATER, not during save
      await update();
    } catch (err: any) {
      toast.error(err.message || "Update failed");
    } finally {
      setLoading(false);
    }
  };

  if (!session || !formData.email) {
    return <div className="text-center p-4">Initializing profile...</div>;
  }

  return (
    <div className="w-11/12 mx-auto mt-6 space-y-6">

      <h2 className="text-2xl font-semibold text-center mb-6">Update Profile</h2>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="space-y-6"
      >
        {/* Profile Image */}
        <div
          className="flex flex-col items-center mb-6 cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <Image
            src={formData.profileImageUrl || "/avatar.jpg"}
            alt="Profile"
            width={128}
            height={128}
            className="w-32 h-32 rounded-full object-cover mb-2 ring-1 ring-gray-300 hover:ring-blue-400"
          />
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <p className="text-sm text-gray-500">Click image to upload</p>
        </div>

        {/* ----- PERSONAL INFO ----- */}
        <div className="space-y-4">
          <p className="text-lg font-semibold border-b pb-2">Personal Information</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* First Name */}
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <div className="relative">
                <Input
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className="pl-10"
                />
                <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              </div>
            </div>

            {/* Middle Name */}
            <div>
              <Label htmlFor="middleName">Middle Name</Label>
              <Input
                id="middleName"
                name="middleName"
                value={formData.middleName}
                onChange={handleChange}
              />
            </div>

            {/* Last Name */}
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
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
                  onChange={handleChange}
                  className="pl-10"
                />
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              </div>
            </div>

            <div>
              <Label htmlFor="gender">Gender</Label>
              <select
                id="gender"
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2 mt-2 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>

          {/* Email + Mobile */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Email */}
            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="pl-10"
                />
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              </div>
            </div>

            {/* Mobile */}
            <div>
              <Label htmlFor="mobile">Mobile Number</Label>
              <div className="relative">
                <Input
                  id="mobile"
                  name="mobile"
                  value={formData.mobile}
                  onChange={handleChange}
                  className="pl-10"
                />
                <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <Label htmlFor="address">Residential Address</Label>
            <div className="relative">
              <Input
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="pl-10"
              />
              <Home className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>

        {/* ----- PROFESSIONAL INFO ----- */}
        <div className="space-y-4">
          <p className="text-lg font-semibold border-b pb-2">Professional Information</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="licenseNumber">License Number</Label>
              <Input
                id="licenseNumber"
                name="licenseNumber"
                value={formData.licenseNumber}
                onChange={handleChange}
              />
            </div>

            <div>
              <Label htmlFor="licenseIssuedBy">License Issued By</Label>
              <Input
                id="licenseIssuedBy"
                name="licenseIssuedBy"
                value={formData.licenseIssuedBy}
                onChange={handleChange}
              />
            </div>

            <div>
              <Label htmlFor="licenseExpiration">License Expiration</Label>
              <Input
                type="date"
                id="licenseExpiration"
                name="licenseExpiration"
                value={formData.licenseExpiration}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        {/* ----- SAVE BUTTON ----- */}
        <Button
          type="submit"
          disabled={loading}
          className="w-full font-bold bg-blue-600 hover:bg-blue-700 text-white mt-4 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="animate-spin border-2 border-white border-t-transparent rounded-full w-4 h-4"></span>
              Saving...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Save Changes
            </>
          )}
        </Button>
      </form>
    </div>
  );

}
