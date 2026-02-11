import { createAuthClient } from "better-auth/client";
import { twoFactorClient, adminClient, organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000",
  plugins: [twoFactorClient(), adminClient(), organizationClient()],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
  updateUser,
  changeEmail,
  changePassword,
  deleteUser,
  resetPassword,
  verifyEmail,
  sendVerificationEmail,
  twoFactor,
  admin,
  organization,
} = authClient;

export type AuthClient = typeof authClient;
