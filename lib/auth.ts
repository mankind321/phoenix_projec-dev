/* eslint-disable @typescript-eslint/no-explicit-any */
import { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcrypt";
import { logAuditTrail } from "@/lib/auditLogger";

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

        // ----------------------------------------
        // 1️⃣ Validate credentials
        // ----------------------------------------
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

          return null;
        }

        // ----------------------------------------
        // 2️⃣ Fetch user
        // ----------------------------------------
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

          return null;
        }

        // ----------------------------------------
        // 3️⃣ Validate password
        // ----------------------------------------
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

          return null;
        }

        // ----------------------------------------
        // 4️⃣ Check if already logged-in
        // ----------------------------------------
        const { data: statusRow } = await supabase
          .from("accounts_status")
          .select("account_status")
          .eq("account_id", userRecord.accountid)
          .eq("username", userRecord.username)
          .maybeSingle();

        if (statusRow?.account_status === "online") {
          // UNIQUE ERROR CODE (useful for toast messages)
          const err = new Error("ACCOUNT_ALREADY_LOGGED_IN");
          (err as any).code = "ACCOUNT_ALREADY_LOGGED_IN";
          throw err;
        }

        // ----------------------------------------
        // 5️⃣ LOGIN SUCCESS — write audit trail
        // ----------------------------------------
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

        // ----------------------------------------
        // 6️⃣ Set user online
        // ----------------------------------------
        await supabase
          .from("accounts_status")
          .update({ account_status: "online" })
          .eq("account_id", userRecord.accountid)
          .eq("username", userRecord.username);

        // ----------------------------------------
        // 7️⃣ Clean profile path
        // ----------------------------------------
        let cleanPath: string | undefined =
          userRecord.profile_image_url ?? undefined;

        if (cleanPath?.startsWith("http")) {
          try {
            const url = new URL(cleanPath);
            cleanPath = url.pathname.split("/").pop() ?? undefined;
          } catch {
            cleanPath = undefined;
          }
        }

        // ----------------------------------------
        // 8️⃣ Return session payload
        // ----------------------------------------
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
    async jwt({ token, user }) {
      if (user) token.user = user;
      return token;
    },

    async session({ session, token }) {
      session.user = token.user as any;
      return session;
    },
  },

  pages: { 
    signIn: "/login",
    error: "/login" // important for receiving error messages
  },

  secret: process.env.NEXTAUTH_SECRET,
};
