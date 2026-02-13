import { Resend } from "resend";

const isProduction = process.env.NODE_ENV === "production";
const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export const sendVerificationEmail = async ({
  user,
  url,
}: {
  user: { email: string; name?: string | null };
  url: string;
}) => {
  console.log(`📧 Verification email for ${user.email}: ${url}`);

  if (!isProduction) {
    return;
  }

  const client = getResend();
  if (!client) {
    console.warn("Email not sent - RESEND_API_KEY not configured");
    return;
  }

  try {
    await client.emails.send({
      from: fromEmail,
      to: user.email,
      subject: "Verify your email",
      html: `
        <h1>Welcome!</h1>
        <p>Hello ${user.name || "there"},</p>
        <p>Please verify your email by clicking the link below:</p>
        <a href="${url}" style="padding: 12px 24px; background: #0070f3; color: white; text-decoration: none; border-radius: 5px;">Verify Email</a>
        <p>Or copy and paste this URL:</p>
        <p>${url}</p>
        <p>This link will expire in 24 hours.</p>
      `,
    });
    console.log(`✅ Verification email sent to ${user.email}`);
  } catch (error) {
    console.error("Failed to send verification email:", error);
  }
};

export const sendPasswordResetEmail = async ({
  user,
  url,
}: {
  user: { email: string; name?: string | null };
  url: string;
}) => {
  console.log(`📧 Password reset for ${user.email}: ${url}`);

  if (!isProduction) {
    return;
  }

  const client = getResend();
  if (!client) {
    console.warn("Email not sent - RESEND_API_KEY not configured");
    return;
  }

  try {
    await client.emails.send({
      from: fromEmail,
      to: user.email,
      subject: "Reset your password",
      html: `
        <h1>Password Reset</h1>
        <p>Hello ${user.name || "there"},</p>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <a href="${url}" style="padding: 12px 24px; background: #0070f3; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
        <p>Or copy and paste this URL:</p>
        <p>${url}</p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    });
    console.log(`✅ Password reset email sent to ${user.email}`);
  } catch (error) {
    console.error("Failed to send password reset email:", error);
  }
};

export const sendWelcomeEmail = async ({
  user,
}: {
  user: { email: string; name?: string | null };
}) => {
  console.log(`📧 Welcome email for ${user.email}`);

  if (!isProduction) {
    return;
  }

  const client = getResend();
  if (!client) {
    console.warn("Email not sent - RESEND_API_KEY not configured");
    return;
  }

  try {
    await client.emails.send({
      from: fromEmail,
      to: user.email,
      subject: "Welcome to our platform!",
      html: `
        <h1>Welcome aboard!</h1>
        <p>Hello ${user.name || "there"},</p>
        <p>Thank you for joining us. We're excited to have you on board!</p>
        <p>If you have any questions, feel free to reach out.</p>
      `,
    });
    console.log(`✅ Welcome email sent to ${user.email}`);
  } catch (error) {
    console.error("Failed to send welcome email:", error);
  }
};

export const sendOrganizationInvitationEmail = async ({
  email,
  organization,
  inviter,
  url,
}: {
  email: string;
  organization: { name: string };
  inviter: { name?: string | null; email: string };
  url: string;
}) => {
  console.log(`📧 Org invite to ${email} for ${organization.name}: ${url}`);

  if (!isProduction) {
    return;
  }

  const client = getResend();
  if (!client) {
    console.warn("Email not sent - RESEND_API_KEY not configured");
    return;
  }

  try {
    await client.emails.send({
      from: fromEmail,
      to: email,
      subject: `You've been invited to join ${organization.name}`,
      html: `
        <h1>Organization Invitation</h1>
        <p>Hello,</p>
        <p>${inviter.name || inviter.email} has invited you to join <strong>${organization.name}</strong>.</p>
        <p>Click the link below to accept the invitation:</p>
        <a href="${url}" style="padding: 12px 24px; background: #0070f3; color: white; text-decoration: none; border-radius: 5px;">Accept Invitation</a>
        <p>Or copy and paste this URL:</p>
        <p>${url}</p>
        <p>This invitation will expire in 7 days.</p>
      `,
    });
    console.log(`✅ Invitation email sent to ${email}`);
  } catch (error) {
    console.error("Failed to send invitation email:", error);
  }
};
