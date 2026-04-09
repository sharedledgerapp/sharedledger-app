import { Resend } from "resend";

const FROM_EMAIL = "SharedLedger <hello@sharedledger.app>";
const SUPPORT_EMAIL = "hello@sharedledger.app";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendWelcomeEmail(toEmail: string, name: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY is not set — welcome email not sent.");
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
  <div style="text-align:center;margin-bottom:28px">
    <img src="https://sharedledger.app/icons/icon-192.png" alt="SharedLedger" width="72" height="72"
         style="border-radius:16px;margin-bottom:16px" />
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
  <div style="text-align:center;margin:28px 0">
    <a href="https://sharedledger.app/app"
       style="display:inline-block;background:#4f46e5;color:#ffffff;font-size:15px;font-weight:600;
              padding:12px 28px;border-radius:8px;text-decoration:none;margin-bottom:12px">
      Open SharedLedger
    </a>
    <br/>
    <a href="https://sharedledger.app/#install-section"
       style="display:inline-block;background:#f3f4f6;color:#4f46e5;font-size:14px;font-weight:600;
              padding:10px 24px;border-radius:8px;text-decoration:none">
      📲 How to install the app
    </a>
  </div>
  <p style="font-size:14px;color:#6b7280;line-height:1.6">
    Not sure where to start? Visit our
    <a href="https://sharedledger.app" style="color:#4f46e5;text-decoration:none">website</a>
    to learn more about what SharedLedger can do for you.
  </p>
  <p style="font-size:14px;color:#9ca3af;line-height:1.6;border-top:1px solid #f3f4f6;padding-top:20px;margin-top:8px">
    If you have any questions, just reply to this email — we're happy to help.<br>
    <strong style="color:#6b7280">The SharedLedger Team</strong>
  </p>
</div>
`.trim();

  try {
    const { error } = await getResend().emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: `Welcome to SharedLedger, ${name}!`,
      text: textBody,
      html: htmlBody,
    });
    if (error) throw error;
    console.log(`[email] Welcome email sent to ${toEmail}`);
  } catch (err) {
    console.error("[email] Failed to send welcome email:", err);
  }
}

export async function sendPasswordResetEmail(toEmail: string, name: string, resetUrl: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY is not set — password reset email not sent.");
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
    const { error } = await getResend().emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: "Reset your SharedLedger password",
      text: textBody,
      html: htmlBody,
    });
    if (error) throw error;
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

  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY is not set — feedback email not sent.");
    return;
  }

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

  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: SUPPORT_EMAIL,
    replyTo: userEmail ? `${userName || "User"} <${userEmail}>` : undefined,
    subject: `SharedLedger Feedback – ${group}`,
    text: textBody,
    html: htmlBody,
  });
  if (error) throw error;
}

export async function sendWhatsNewEmail(toEmail: string, name: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY is not set — whats-new email not sent.");
    return;
  }

  const textBody = [
    `Hi ${name},`,
    ``,
    `We've just shipped a new feature in SharedLedger: Income Tracking.`,
    ``,
    `You can now log your income — salary, freelance work, or any one-off payment —`,
    `under the "Money In" tab on the Expenses page.`,
    ``,
    `If you're in a family or couple group, you can also choose to share your income`,
    `with your household. The Group Dashboard will show a combined household income view`,
    `alongside your shared spending.`,
    ``,
    `Open the app to give it a try:`,
    `https://sharedledger.app/app/expenses`,
    ``,
    `— The SharedLedger Team`,
  ].join("\n");

  const htmlBody = `
<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px 24px;background:#ffffff">
  <div style="text-align:center;margin-bottom:28px">
    <img src="https://sharedledger.app/icons/icon-192.png" alt="SharedLedger" width="72" height="72"
         style="border-radius:16px;margin-bottom:16px" />
    <h1 style="font-size:26px;font-weight:700;color:#1d1d1f;margin:0">New in SharedLedger</h1>
    <p style="color:#6b7280;font-size:15px;margin-top:8px">Income Tracking is here</p>
  </div>
  <p style="font-size:15px;color:#374151;line-height:1.6">Hi <strong>${name}</strong>,</p>
  <p style="font-size:15px;color:#374151;line-height:1.6">
    We've just shipped a feature many of you have been asking for: <strong>Income Tracking</strong>.
  </p>
  <div style="background:#f5f3ff;border:1px solid #ede9fe;border-radius:12px;padding:20px;margin:20px 0">
    <h2 style="font-size:17px;font-weight:700;color:#4f46e5;margin:0 0 10px">💰 What's new</h2>
    <ul style="font-size:14px;color:#374151;line-height:1.8;margin:0;padding-left:20px">
      <li>Log salary, freelance income, or one-off payments under <strong>Money In</strong> on the Expenses page</li>
      <li>See your real net position — income minus spending — each month</li>
      <li>Families and couples can share income privately with their household</li>
      <li>Group Dashboards now show a combined household income overview</li>
    </ul>
  </div>
  <div style="text-align:center;margin:28px 0">
    <a href="https://sharedledger.app/app/expenses"
       style="display:inline-block;background:#4f46e5;color:#ffffff;font-size:15px;font-weight:600;
              padding:12px 28px;border-radius:8px;text-decoration:none">
      Try Income Tracking
    </a>
  </div>
  <p style="font-size:14px;color:#6b7280;line-height:1.6">
    As always, if you have feedback or questions just reply to this email — we read every message.
  </p>
  <p style="font-size:14px;color:#6b7280;margin-top:24px">— The SharedLedger Team</p>
</div>
`.trim();

  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    subject: "New in SharedLedger: Income Tracking is live",
    text: textBody,
    html: htmlBody,
  });
  if (error) throw error;
}
