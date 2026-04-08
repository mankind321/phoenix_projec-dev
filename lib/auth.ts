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
        // 4️⃣ Audit login success
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
        // 5️⃣ Normalize profile image
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
        // 6️⃣ Generate session_id
        // ----------------------------------------
        const session_id = randomUUID();

        // ----------------------------------------
        // 7️⃣ 🔒 Limit active sessions (max 3)
        // ----------------------------------------
        const { data: sessions } = await supabase
          .from("accounts_status")
          .select("session_id, created_at")
          .eq("account_id", userRecord.accountid)
          .eq("revoked", false)
          .order("created_at", { ascending: true });

        if (sessions && sessions.length >= 3) {
          await supabase
            .from("accounts_status")
            .update({ revoked: true })
            .eq("session_id", sessions[0].session_id);
        }

        // ----------------------------------------
        // 8️⃣ Create NEW session (IMPORTANT)
        // ----------------------------------------
        await supabase.from("accounts_status").insert({
          session_id,
          account_id: userRecord.accountid,
          username: userRecord.username,
          device_info: userAgent,
          ip_address: ip,
          revoked: false,
          created_at: new Date().toISOString(),
          expires_at: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        });

        // ----------------------------------------
        // 9️⃣ Return user
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

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, user }) {
      // On login
      if (user) {
        token.user = user;
        token.session_id = (user as any).session_id;
        token.invalid = false;
        return token;
      }

      // 🔐 Validate session via session_id
      if (token?.session_id) {
        const { data } = await supabase
          .from("accounts_status")
          .select("revoked, expires_at")
          .eq("session_id", token.session_id)
          .maybeSingle();

        // ✅ IMPORTANT: allow if not found (race condition)
        if (!data) {
          return token;
        }

        // ❌ Only invalidate if explicitly bad
        if (data.revoked === true || new Date(data.expires_at) < new Date()) {
          token.invalid = true;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if ((token as any).invalid) {
        session.user = undefined as any;
        return session;
      }

      session.user = token.user as any;
      session.session_id = token.session_id;
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  secret: process.env.NEXTAUTH_SECRET,
};
