import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      role: string;
      firstName: string;
      middleName: string;
      lastName: string;
      licenseNumber: string;
      profileImageUrl?: string;
      accountId: string;
      managerId?: string;
      supabaseAccessToken?: string;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    username: string;
    role: string;
    firstName: string;
    middleName: string;
    lastName: string;
    licenseNumber: string;
    profileImageUrl?: string;
    accountId: string;
    managerId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    user: {
      id: string;
      username: string;
      role: string;
      firstName: string;
      middleName: string;
      lastName: string;
      licenseNumber: string;
      profileImageUrl?: string;
      accountId: string;
      managerId?: string;
    };
    supabaseAccessToken?: string;
  }
}
