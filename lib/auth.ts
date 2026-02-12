/* eslint-disable @typescript-eslint/no-explicit-any */
import { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcrypt";
import { logAuditTrail } from "@/lib/auditLogger";
import { randomUUID } from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
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

          throw new Error("MISSING_CREDENTIALS");
        }

        // ----------------------------------------
        // 2️⃣ Fetch user record
        // ----------------------------------------
        const { data: userRecord } = await supabase
          .from("useraccountaccess")
          .select(
            `
              userid,
              username,
              role,
              password_hash,
              license_number,
              profile_image_url,
              first_name,
              middle_name,
              last_name,
              accountid,
              manager_id
            `,
          )
          .eq("username", credentials.username)
          .maybeSingle();

        // ❌ USER NOT FOUND
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

          throw new Error("USER_NOT_FOUND");
        }

        // ----------------------------------------
        // 3️⃣ Validate password
        // ----------------------------------------
        const validPass = await bcrypt.compare(
          credentials.password,
          userRecord.password_hash,
        );

        // ❌ INVALID PASSWORD
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

          throw new Error("INVALID_PASSWORD");
        }

        // ----------------------------------------
        // 4️⃣ Prevent multiple active logins
        // ----------------------------------------
        const { data: statusRow } = await supabase
          .from("accounts_status")
          .select("account_status")
          .eq("account_id", userRecord.accountid)
          .eq("username", userRecord.username)
          .maybeSingle();

        if (statusRow?.account_status === "online") {
          await logAuditTrail({
            userId: userRecord.userid,
            username: userRecord.username,
            role: userRecord.role,
            actionType: "LOGIN_FAILED",
            tableName: "useraccountaccess",
            description: "Account already logged in",
            ipAddress: ip,
            userAgent,
          });

          throw new Error("ACCOUNT_ALREADY_LOGGED_IN");
        }

        // ----------------------------------------
        // 5️⃣ Audit login success
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
        // 6️⃣ Normalize profile image path
        // ----------------------------------------
        let cleanProfilePath: string | undefined =
          userRecord.profile_image_url ?? undefined;

        if (cleanProfilePath?.startsWith("http")) {
          try {
            const url = new URL(cleanProfilePath);
            cleanProfilePath = url.pathname.split("/").pop();
          } catch {
            cleanProfilePath = undefined;
          }
        }

        // ----------------------------------------
        // 7️⃣ Generate session identifier
        // ----------------------------------------
        const session_id = randomUUID();

        // ----------------------------------------
        // 8️⃣ Return user object
        // ----------------------------------------
        return {
          id: userRecord.userid,
          username: userRecord.username,
          role: userRecord.role,
          firstName: userRecord.first_name ?? "",
          middleName: userRecord.middle_name ?? "",
          lastName: userRecord.last_name ?? "",
          licenseNumber: userRecord.license_number ?? "",
          profileImageUrl: cleanProfilePath,
          accountId: userRecord.accountid,
          managerId: userRecord.manager_id,
          session_id,
        };
      },
    }),
  ],

  // ----------------------------------------
  // 🔐 Session Strategy
  // ----------------------------------------
  session: { strategy: "jwt" },

  // ----------------------------------------
  // 🔁 Callbacks
  // ----------------------------------------
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.user = user;
        token.session_id = (user as any).session_id;
      }
      return token;
    },

    async session({ session, token }) {
      session.user = token.user as any;
      session.session_id = token.session_id;
      return session;
    },
  },

  // ----------------------------------------
  // 🧭 Pages
  // ----------------------------------------
  pages: {
    signIn: "/login",
    error: "/login",
  },

  secret: process.env.NEXTAUTH_SECRET,
};
