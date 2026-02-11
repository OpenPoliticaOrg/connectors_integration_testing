import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, schema } from "@backend/db";
import { bearer, admin, twoFactor, organization, jwt } from "better-auth/plugins";
import { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } from "./email";

const isProduction = process.env.NODE_ENV === "production";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
      organization: schema.organizations,
      member: schema.members,
      invitation: schema.invitations,
      twoFactor: schema.twoFactors,
    },
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,

  trustedOrigins: process.env.CORS_ORIGINS?.split(",") || ["http://localhost:3000"],

  advanced: {
    useSecureCookies: isProduction,
    cookiePrefix: "auth",
  },

  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({ user, url });
    },
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail({ user, url });
    },
  },

  socialProviders: {
    github: process.env.GITHUB_CLIENT_ID
      ? {
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        }
      : undefined,
    google: process.env.GOOGLE_CLIENT_ID
      ? {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }
      : undefined,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["github", "google"],
    },
  },

  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in": {
        window: 60 * 15,
        max: 5,
      },
      "/sign-up": {
        window: 60 * 60,
        max: 3,
      },
    },
  },

  plugins: [
    bearer(),
    jwt({
      jwks: {
        jwksPath: "/.well-known/jwks.json",
      },
      jwt: {
        issuer: process.env.BETTER_AUTH_URL || "http://localhost:3000",
        audience: process.env.BETTER_AUTH_URL || "http://localhost:3000",
        expirationTime: "1h",
      },
    }),
    admin(),
    twoFactor({
      otpOptions: {
        period: 60,
        digits: 6,
      },
    }),
    organization({
      ac: undefined,
    }),
  ],

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await sendWelcomeEmail({ user });
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = Session["user"];
