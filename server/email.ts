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
    `Thank you for being part of the SharedLedger beta. Your feedback has been`,
    `shaping the product from the start and we genuinely appreciate it.`,
    ``,
    `One of the most consistent pieces of feedback we heard from many of you was this:`,
    `it is hard to understand your spending when you can only see what goes out.`,
    `You wanted to see what comes in too, so that the numbers actually add up`,
    `and your financial picture makes sense.`,
    ``,
    `So we built it.`,
    ``,
    `Income Tracking is now live in SharedLedger. Head to the Expenses page`,
    `and tap "Money In" to log your salary, freelance work, or any one-off payment.`,
    `The more you log, the clearer your real net position becomes each month.`,
    ``,
    `A few things worth knowing:`,
    ``,
    `- Your monthly net position updates in real time as you log income and expenses`,
    `- Shared household income is available for families and couples to start.`,
    `  If you are in a couple or family group, you can share your income with your`,
    `  household so everyone sees the full picture together`,
    `- We have not forgotten roommates. Shared income for roommate groups is`,
    `  on our roadmap and we would love to hear your thoughts on how it should work`,
    `- Income you would rather keep private stays private by default`,
    ``,
    `Open the app to give it a try:`,
    `https://sharedledger.app/app/expenses`,
    ``,
    `As always, reply to this email with any thoughts. We read every message.`,
    ``,
    `The SharedLedger Team`,
  ].join("\n");

  const htmlBody = `
<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px 24px;background:#ffffff">
  <div style="text-align:center;margin-bottom:28px">
    <img src="https://sharedledger.app/icons/icon-192.png" alt="SharedLedger" width="72" height="72"
         style="border-radius:16px;margin-bottom:16px" />
    <h1 style="font-size:26px;font-weight:700;color:#1d1d1f;margin:0">New in SharedLedger</h1>
    <p style="color:#6b7280;font-size:15px;margin-top:8px">Income Tracking is now live</p>
  </div>
  <p style="font-size:15px;color:#374151;line-height:1.6">Hi <strong>${name}</strong>,</p>
  <p style="font-size:15px;color:#374151;line-height:1.6">
    Thank you for being part of the SharedLedger beta. Your feedback has been shaping the
    product from the start and we genuinely appreciate it.
  </p>
  <p style="font-size:15px;color:#374151;line-height:1.6">
    One of the most consistent pieces of feedback we heard from many of you was this: it is hard to
    understand your spending when you can only see what goes out. You wanted to see what
    comes in too, so that the numbers actually add up and your financial picture makes sense.
  </p>
  <p style="font-size:15px;color:#374151;line-height:1.6;font-weight:600">So we built it.</p>
  <p style="font-size:15px;color:#374151;line-height:1.6">
    <strong>Income Tracking</strong> is now live in SharedLedger. Head to the Expenses page
    and tap <strong>Money In</strong> to log your salary, freelance work, or any one-off
    payment. The more you log, the clearer your real net position becomes each month.
  </p>
  <div style="background:#f5f3ff;border:1px solid #ede9fe;border-radius:12px;padding:20px;margin:24px 0">
    <h2 style="font-size:15px;font-weight:700;color:#4f46e5;margin:0 0 12px">A few things worth knowing</h2>
    <ul style="font-size:14px;color:#374151;line-height:1.9;margin:0;padding-left:20px">
      <li>Your monthly net position updates in real time as you log income and expenses</li>
      <li>Shared household income is rolling out for <strong>families and couples</strong> first. If you are in one of these groups, you can share your income with your household so everyone sees the full picture together</li>
      <li>We have not forgotten roommates. Shared income for roommate groups is on our roadmap and we would love to hear how you think it should work. Just reply to this email</li>
      <li>Income you would rather keep private stays private by default</li>
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
    As always, reply to this email with any thoughts. We read every message.
  </p>
  <p style="font-size:14px;color:#6b7280;margin-top:24px">The SharedLedger Team</p>
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

export async function sendSageUpdateEmail(toEmail: string, name: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY is not set — sage update email not sent.");
    return;
  }

  const textBody = [
    `Hi ${name},`,
    ``,
    `We have been quietly building something new inside SharedLedger,`,
    `and we think you will find it genuinely useful.`,
    ``,
    `Introducing Sage — an AI financial advisor that lives right inside the app.`,
    ``,
    `Unlike generic AI tools, Sage reads your actual SharedLedger data:`,
    `your real expenses, categories, income, and spending patterns.`,
    `It uses all of that to give you answers and insights that are specific to you,`,
    `not just generic financial advice.`,
    ``,
    `Here is what Sage can do for you right now:`,
    ``,
    `- Generate a monthly spending analysis with trends and highlights`,
    `- Answer questions about your actual income and expense data`,
    `- Identify categories where you consistently overspend`,
    `- Suggest ways to stay on track with your savings goals`,
    ``,
    `You will find Sage in the Messages tab inside the app.`,
    `Just tap the Sage tab and ask it anything — or let it run`,
    `your monthly analysis automatically.`,
    ``,
    `One honest note: Sage is still early. It is powered by Google Gemini`,
    `and getting smarter every week. Answers are grounded in your real data,`,
    `but use your own judgement for big financial decisions.`,
    `We would love to hear what you think of it.`,
    ``,
    `Try Sage now:`,
    `https://sharedledger.app/app`,
    ``,
    `As always, reply to this email with any thoughts. We read every message.`,
    ``,
    `The SharedLedger Team`,
  ].join("\n");

  const htmlBody = `
<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px 24px;background:#ffffff">
  <div style="text-align:center;margin-bottom:28px">
    <img src="https://sharedledger.app/icons/icon-192.png" alt="SharedLedger" width="72" height="72"
         style="border-radius:16px;margin-bottom:16px" />
    <h1 style="font-size:26px;font-weight:700;color:#1d1d1f;margin:0">Meet Sage</h1>
    <p style="color:#6b7280;font-size:15px;margin-top:8px">Your AI financial advisor, now inside SharedLedger</p>
  </div>

  <p style="font-size:15px;color:#374151;line-height:1.6">Hi <strong>${name}</strong>,</p>
  <p style="font-size:15px;color:#374151;line-height:1.6">
    We have been quietly building something new inside SharedLedger,
    and we think you will find it genuinely useful.
  </p>

  <!-- Sage hero block -->
  <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:16px;padding:28px 24px;margin:24px 0;text-align:center">
    <div style="font-size:40px;margin-bottom:12px">✦</div>
    <h2 style="font-size:22px;font-weight:700;color:#ffffff;margin:0 0 10px">Introducing Sage</h2>
    <p style="font-size:14px;color:#c4b5fd;margin:0;line-height:1.6">
      An AI financial advisor that reads your <em>actual</em> SharedLedger data —
      your real expenses, income, categories, and patterns — and gives you
      insights that are specific to you.
    </p>
    <div style="margin-top:6px">
      <span style="display:inline-block;background:rgba(255,255,255,0.18);color:#e0d9ff;font-size:12px;font-weight:600;padding:4px 12px;border-radius:20px;border:1px solid rgba(255,255,255,0.25)">
        Beta · Powered by Gemini · Still in testing
      </span>
    </div>
  </div>

  <p style="font-size:15px;color:#374151;line-height:1.6">
    Here is what Sage can do for you right now:
  </p>

  <div style="background:#f5f3ff;border:1px solid #ede9fe;border-radius:12px;padding:20px;margin:0 0 24px">
    <ul style="font-size:14px;color:#374151;line-height:2;margin:0;padding-left:20px">
      <li>Generate a monthly spending analysis with trends and highlights</li>
      <li>Answer questions about your actual income and expense data</li>
      <li>Identify categories where you consistently overspend</li>
      <li>Suggest ways to stay on track with your savings goals</li>
    </ul>
  </div>

  <p style="font-size:15px;color:#374151;line-height:1.6">
    You will find Sage in the <strong>Messages tab</strong> inside the app.
    Just tap the <strong>Sage tab</strong> and ask it anything — or let it
    generate your monthly analysis automatically.
  </p>

  <div style="text-align:center;margin:28px 0">
    <a href="https://sharedledger.app/app"
       style="display:inline-block;background:#4f46e5;color:#ffffff;font-size:15px;font-weight:600;
              padding:12px 28px;border-radius:8px;text-decoration:none">
      ✦ Try Sage
    </a>
  </div>

  <div style="background:#fafafa;border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;margin-bottom:24px">
    <p style="font-size:13px;color:#6b7280;line-height:1.6;margin:0">
      <strong style="color:#374151">One honest note:</strong>
      Sage is still early. It is powered by Google Gemini and getting smarter every week.
      Answers are grounded in your real data, but use your own judgement for big financial decisions.
      We would love to hear what you think of it — just reply to this email.
    </p>
  </div>

  <p style="font-size:14px;color:#6b7280;line-height:1.6">
    As always, reply to this email with any thoughts. We read every message.
  </p>
  <p style="font-size:14px;color:#6b7280;margin-top:24px">The SharedLedger Team</p>
</div>
`.trim();

  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    subject: "Introducing Sage — your AI financial advisor inside SharedLedger",
    text: textBody,
    html: htmlBody,
  });
  if (error) throw error;
}
