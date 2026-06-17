import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { db, schema } from "../db/client";

const productionUrl = process.env.BETTER_AUTH_URL?.trim();

// Private agent: only these emails may create an account. Defaults to the owner;
// override with ALLOWED_SIGNUP_EMAILS (comma-separated) to change. Sign-in is
// unaffected — this only gates new account creation.
const allowedSignupEmails = (process.env.ALLOWED_SIGNUP_EMAILS ?? "jakerains@gmail.com")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export const auth = betterAuth({
  baseURL: productionUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: productionUrl ? [productionUrl] : undefined,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (
            allowedSignupEmails.length > 0
            && !allowedSignupEmails.includes(user.email.toLowerCase())
          ) {
            throw new APIError("FORBIDDEN", {
              message: "Sign-ups are closed — this is a private agent.",
            });
          }
        },
      },
    },
  },
});
