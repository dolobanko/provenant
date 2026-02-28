import nodemailer from 'nodemailer';
import { logger } from './logger';

interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

function createTransporter() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' }
      : undefined,
  });
}

export async function sendEmail(opts: MailOptions): Promise<void> {
  const transporter = createTransporter();
  const from = process.env.SMTP_FROM ?? 'Provenant <noreply@provenant.dev>';

  if (!transporter) {
    // Dev fallback — log to console
    const plainText = opts.text ?? opts.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    logger.info(
      `[Email DEV — SMTP not configured]\nTo:      ${opts.to}\nSubject: ${opts.subject}\n\n${plainText}\n`,
    );
    return;
  }

  await transporter.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });

  logger.info(`[Email] Sent "${opts.subject}" to ${opts.to}`);
}

// ── Template helpers ────────────────────────────────────────────────────────

export function invitationEmail(opts: {
  inviterName: string;
  orgName: string;
  role: string;
  inviteUrl: string;
}): Pick<MailOptions, 'subject' | 'html' | 'text'> {
  const { inviterName, orgName, role, inviteUrl } = opts;
  return {
    subject: `You've been invited to join ${orgName} on Provenant`,
    html: `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px">
  <h2 style="margin-bottom:8px">You're invited! 🎉</h2>
  <p><strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong> on Provenant as a <strong>${role}</strong>.</p>
  <p style="margin:24px 0">
    <a href="${inviteUrl}" style="background:#6366f1;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;display:inline-block;font-weight:600">
      Accept Invitation
    </a>
  </p>
  <p style="color:#666;font-size:13px">This invitation expires in 7 days. If you weren't expecting this, you can safely ignore it.</p>
  <p style="color:#999;font-size:12px">Or copy this link: ${inviteUrl}</p>
</div>`,
    text: `${inviterName} invited you to join ${orgName} on Provenant (role: ${role}).\n\nAccept: ${inviteUrl}\n\nThis link expires in 7 days.`,
  };
}

export function passwordResetEmail(opts: { resetUrl: string }): Pick<MailOptions, 'subject' | 'html' | 'text'> {
  const { resetUrl } = opts;
  return {
    subject: 'Reset your Provenant password',
    html: `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px">
  <h2 style="margin-bottom:8px">Password reset</h2>
  <p>We received a request to reset your Provenant password. Click the button below to choose a new one.</p>
  <p style="margin:24px 0">
    <a href="${resetUrl}" style="background:#6366f1;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;display:inline-block;font-weight:600">
      Reset Password
    </a>
  </p>
  <p style="color:#666;font-size:13px">This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
  <p style="color:#999;font-size:12px">Or copy this link: ${resetUrl}</p>
</div>`,
    text: `Reset your Provenant password: ${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, ignore it.`,
  };
}
