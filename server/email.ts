import nodemailer from "nodemailer";

const SUPPORT_EMAIL = "SharedLedger.app@gmail.com";

function createTransporter() {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
    auth: {
      user: SUPPORT_EMAIL,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

export async function sendWelcomeEmail(toEmail: string, name: string): Promise<void> {
  if (!process.env.GMAIL_APP_PASSWORD) {
    console.warn("[email] GMAIL_APP_PASSWORD is not set — welcome email not sent.");
    return;
  }

  const textBody = [
    `Welcome to SharedLedger, ${name}!`,
    ``,
    `We're glad you're here. SharedLedger makes it easy to track shared expenses,`,
    `manage budgets, and stay on top of your finances together.`,
    ``,
    `Get started by adding your first expense or inviting someone to your group.`,
    ``,
    `If you have any questions, just reply to this email — we're happy to help.`,
    ``,
    `— The SharedLedger Team`,
  ].join("\n");

  const htmlBody = `
<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px 24px;background:#ffffff">
  <div style="text-align:center;margin-bottom:32px">
    <h1 style="font-size:28px;font-weight:700;color:#1d1d1f;margin:0">Welcome to SharedLedger</h1>
    <p style="color:#6b7280;font-size:15px;margin-top:8px">Your shared finances, simplified.</p>
  </div>
  <p style="font-size:15px;color:#374151;line-height:1.6">Hi <strong>${name}</strong>,</p>
  <p style="font-size:15px;color:#374151;line-height:1.6">
    We're glad you're here. SharedLedger makes it easy to track shared expenses,
    manage budgets, and stay on top of your finances — whether with family, roommates, or a partner.
  </p>
  <p style="font-size:15px;color:#374151;line-height:1.6">
    Get started by adding your first expense or inviting someone to your group.
  </p>
  <div style="text-align:center;margin:32px 0">
    <a href="https://sharedledger.app/app"
       style="display:inline-block;background:#4f46e5;color:#ffffff;font-size:15px;font-weight:600;
              padding:12px 28px;border-radius:8px;text-decoration:none">
      Open SharedLedger
    </a>
  </div>
  <p style="font-size:14px;color:#9ca3af;line-height:1.6;border-top:1px solid #f3f4f6;padding-top:20px;margin-top:8px">
    If you have any questions, just reply to this email — we're happy to help.<br>
    <strong style="color:#6b7280">The SharedLedger Team</strong>
  </p>
</div>
`.trim();

  try {
    await createTransporter().sendMail({
      from: `SharedLedger <${SUPPORT_EMAIL}>`,
      to: toEmail,
      subject: `Welcome to SharedLedger, ${name}!`,
      text: textBody,
      html: htmlBody,
    });
    console.log(`[email] Welcome email sent to ${toEmail}`);
  } catch (err) {
    console.error("[email] Failed to send welcome email:", err);
  }
}

export async function sendPasswordResetEmail(toEmail: string, name: string, resetUrl: string): Promise<void> {
  if (!process.env.GMAIL_APP_PASSWORD) {
    console.warn("[email] GMAIL_APP_PASSWORD is not set — password reset email not sent.");
    return;
  }

  const textBody = [
    `Hi ${name},`,
    ``,
    `We received a request to reset your SharedLedger password.`,
    ``,
    `Click the link below to set a new password (valid for 1 hour):`,
    `${resetUrl}`,
    ``,
    `If you didn't request this, you can safely ignore this email.`,
    ``,
    `— The SharedLedger Team`,
  ].join("\n");

  const htmlBody = `
<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px 24px;background:#ffffff">
  <div style="text-align:center;margin-bottom:32px">
    <h1 style="font-size:24px;font-weight:700;color:#1d1d1f;margin:0">Reset your password</h1>
    <p style="color:#6b7280;font-size:15px;margin-top:8px">SharedLedger account recovery</p>
  </div>
  <p style="font-size:15px;color:#374151;line-height:1.6">Hi <strong>${name}</strong>,</p>
  <p style="font-size:15px;color:#374151;line-height:1.6">
    We received a request to reset the password for your account. Click the button below to choose a new one.
    This link is valid for <strong>1 hour</strong>.
  </p>
  <div style="text-align:center;margin:32px 0">
    <a href="${resetUrl}"
       style="display:inline-block;background:#4f46e5;color:#ffffff;font-size:15px;font-weight:600;
              padding:12px 28px;border-radius:8px;text-decoration:none">
      Reset Password
    </a>
  </div>
  <p style="font-size:14px;color:#9ca3af;line-height:1.6">
    If you didn't request a password reset, you can safely ignore this email — your password won't change.
  </p>
  <p style="font-size:14px;color:#9ca3af;line-height:1.6;border-top:1px solid #f3f4f6;padding-top:20px;margin-top:8px">
    <strong style="color:#6b7280">The SharedLedger Team</strong>
  </p>
</div>
`.trim();

  try {
    await createTransporter().sendMail({
      from: `SharedLedger <${SUPPORT_EMAIL}>`,
      to: toEmail,
      subject: "Reset your SharedLedger password",
      text: textBody,
      html: htmlBody,
    });
    console.log(`[email] Password reset email sent to ${toEmail}`);
  } catch (err) {
    console.error("[email] Failed to send password reset email:", err);
    throw err;
  }
}

export interface FeedbackPayload {
  group: string;
  message: string;
  userEmail: string | null;
  userName: string | null;
}

export async function sendFeedbackEmail(payload: FeedbackPayload): Promise<void> {
  const { group, message, userEmail, userName } = payload;

  if (!process.env.GMAIL_APP_PASSWORD) {
    console.warn("[email] GMAIL_APP_PASSWORD is not set — feedback email not sent.");
    return;
  }

  const transporter = createTransporter();

  const timestamp = new Date().toLocaleString("en-GB", {
    timeZone: "UTC",
    dateStyle: "full",
    timeStyle: "short",
  });

  const textBody = [
    `SharedLedger Feedback`,
    ``,
    `Group:     ${group}`,
    `From:      ${userName || "Unknown"} <${userEmail || "no email"}>`,
    `Submitted: ${timestamp} UTC`,
    ``,
    `--- Message ---`,
    message,
    ``,
  ].join("\n");

  const htmlBody = `
<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px">
  <h2 style="margin-top:0;color:#1d1d1f">SharedLedger Feedback</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px">
    <tr>
      <td style="padding:6px 0;color:#6b7280;width:90px"><strong>Group</strong></td>
      <td style="padding:6px 0">${group}</td>
    </tr>
    <tr>
      <td style="padding:6px 0;color:#6b7280"><strong>From</strong></td>
      <td style="padding:6px 0">${userName || "Unknown"} &lt;${userEmail || "no email"}&gt;</td>
    </tr>
    <tr>
      <td style="padding:6px 0;color:#6b7280"><strong>Submitted</strong></td>
      <td style="padding:6px 0">${timestamp} UTC</td>
    </tr>
  </table>
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px;font-size:14px;line-height:1.6;white-space:pre-wrap">${message}</div>
</div>
`.trim();

  await transporter.sendMail({
    from: `SharedLedger <${SUPPORT_EMAIL}>`,
    to: SUPPORT_EMAIL,
    replyTo: userEmail ? `${userName || "User"} <${userEmail}>` : undefined,
    subject: `SharedLedger Feedback – ${group}`,
    text: textBody,
    html: htmlBody,
  });
}
