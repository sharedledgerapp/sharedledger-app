import { sendWhatsNewEmail } from "./email";

let scheduled = false;
let sent = false;

export function scheduleWhatsNewEmail(
  getAllUsers: () => Promise<{ id: number; name: string; email: string }[]>
) {
  if (scheduled) {
    console.log("[email-scheduler] Already scheduled, skipping.");
    return;
  }
  scheduled = true;

  const now = new Date();

  // Target: 07:00 UTC = 09:00 CEST (Europe) = 10:00 EAT (Uganda)
  const target = new Date();
  target.setUTCHours(7, 0, 0, 0);

  // If 07:00 UTC has already passed today, push to tomorrow
  if (target.getTime() <= now.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1);
  }

  const delayMs = target.getTime() - now.getTime();
  const delayHrs = (delayMs / 1000 / 60 / 60).toFixed(1);

  console.log(
    `[email-scheduler] What's New bulk email scheduled for ${target.toUTCString()} ` +
    `(09:00 CEST / 10:00 EAT) — firing in ~${delayHrs}h`
  );

  setTimeout(async () => {
    if (sent) {
      console.log("[email-scheduler] Already sent, skipping duplicate fire.");
      return;
    }
    sent = true;
    console.log("[email-scheduler] Firing What's New bulk email now...");
    try {
      const users = await getAllUsers();
      let successCount = 0;
      let failCount = 0;
      for (const u of users) {
        try {
          await sendWhatsNewEmail(u.email, u.name);
          successCount++;
        } catch (err) {
          failCount++;
          console.error("[email-scheduler] Failed to send to", u.email, err);
        }
      }
      console.log(
        `[email-scheduler] Bulk send complete. Sent: ${successCount}, Failed: ${failCount}, Total: ${users.length}`
      );
    } catch (err) {
      console.error("[email-scheduler] Fatal error during bulk send:", err);
    }
  }, delayMs);
}

export function cancelWhatsNewEmail(): boolean {
  if (sent) return false; // already fired
  scheduled = false;
  return true;
}

export function getWhatsNewStatus(): { scheduled: boolean; sent: boolean } {
  return { scheduled, sent };
}
