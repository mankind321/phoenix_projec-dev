export const runtime = "nodejs";

import NextAuth, { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcrypt";
import { logAuditTrail } from "@/lib/auditLogger";

// ADMIN Supabase client (for login only)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials, req) {
        const ip =
          req?.headers?.["x-forwarded-for"]?.toString()?.split(",")[0] ??
          "Unknown";
        const userAgent = req?.headers?.["user-agent"]?.toString() ?? "Unknown";

        if (!credentials?.username || !credentials?.password) {
          await logAuditTrail({
            userId: null,
            username: credentials?.username ?? "Unknown",
            role: "N/A",
            actionType: "LOGIN_FAILED",
            tableName: "useraccountaccess",
            description: "Missing credentials",
            ipAddress: ip,
            userAgent,
          });

          throw new Error("Missing username or password");
        }

        // Read user record
        const { data: userRecord } = await supabase
          .from("useraccountaccess")
          .select(
            "userid, username, role, password_hash, license_number, profile_image_url, first_name, middle_name, last_name, accountid, manager_id"
          )
          .eq("username", credentials.username)
          .maybeSingle();

        if (!userRecord) {
          await logAuditTrail({
            userId: null,
            username: credentials.username,
            role: "Unknown",
            actionType: "LOGIN_FAILED",
            tableName: "useraccountaccess",
            description: "Invalid username",
            ipAddress: ip,
            userAgent,
          });

          throw new Error("Invalid username or password");
        }

        const validPass = await bcrypt.compare(
          credentials.password,
          userRecord.password_hash
        );

        if (!validPass) {
          await logAuditTrail({
            userId: userRecord.userid,
            username: credentials.username,
            role: userRecord.role,
            actionType: "LOGIN_FAILED",
            tableName: "useraccountaccess",
            description: "Incorrect password",
            ipAddress: ip,
            userAgent,
          });

          throw new Error("Invalid username or password");
        }

        await logAuditTrail({
          userId: userRecord.userid,
          username: userRecord.username,
          role: userRecord.role,
          actionType: "LOGIN_SUCCESS",
          tableName: "useraccountaccess",
          description: "User successfully logged in",
          ipAddress: ip,
          userAgent,
        });

        // Clean image URL
        let cleanPath: string | undefined = userRecord.profile_image_url ?? undefined;
        if (cleanPath?.startsWith("http")) {
          try {
            const url = new URL(cleanPath);
            cleanPath = url.pathname.split("/").pop() ?? undefined;
          } catch {
            cleanPath = undefined;
          }
        }

        // Return user object stored inside next-auth token
        return {
          id: userRecord.userid,
          username: userRecord.username,
          role: userRecord.role,
          firstName: userRecord.first_name ?? "",
          middleName: userRecord.middle_name ?? "",
          lastName: userRecord.last_name ?? "",
          licenseNumber: userRecord.license_number ?? "",
          profileImageUrl: cleanPath,
          accountId: userRecord.accountid,
          managerId: userRecord.manager_id,
        };
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    // 🔥 JWT CALLBACK — Stores user object only
    async jwt({ token, user }) {
      if (user) {
        token.user = {
          id: user.id,
          username: user.username,
          role: user.role,
          firstName: user.firstName,
          middleName: user.middleName,
          lastName: user.lastName,
          licenseNumber: user.licenseNumber,
          profileImageUrl: user.profileImageUrl,
          accountId: user.accountId,
          managerId: user.managerId,
        };
      }

      return token;
    },

    // 🔥 SESSION CALLBACK — Exposes user to the client
    async session({ session, token }) {
      const u = token.user ?? null;

      session.user = {
        id: typeof u?.id === "string" ? u.id : "",
        username: typeof u?.username === "string" ? u.username : "",
        role: typeof u?.role === "string" ? u.role : "",
        firstName: typeof u?.firstName === "string" ? u.firstName : "",
        middleName: typeof u?.middleName === "string" ? u.middleName : "",
        lastName: typeof u?.lastName === "string" ? u.lastName : "",
        licenseNumber: typeof u?.licenseNumber === "string" ? u.licenseNumber : "",
        profileImageUrl:
          typeof u?.profileImageUrl === "string" ? u.profileImageUrl : undefined,
        accountId: typeof u?.accountId === "string" ? u.accountId : "",
        managerId: typeof u?.managerId === "string" ? u.managerId : undefined,
      };

      return session;
    },
  },

  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };