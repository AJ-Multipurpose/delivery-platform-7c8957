import { getDatabase } from "@netlify/database";
import { EMAIL_SENDER, orderEmail } from "../../shared/email.mjs";
export default async () => {
  if (!process.env.RESEND_API_KEY)
    return new Response("Email delivery is not configured", { status: 503 });
  const client = await getDatabase().pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      "SELECT e.id email_id,e.event,e.recipient,o.* FROM email_outbox e JOIN orders o ON o.id=e.order_id WHERE e.status='pending' ORDER BY e.id LIMIT 3 FOR UPDATE OF e SKIP LOCKED",
    );
    for (const row of rows) {
      const content = orderEmail(row.event, row);
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + process.env.RESEND_API_KEY,
          "Content-Type": "application/json",
          "Idempotency-Key": "dbd-order-email-" + row.email_id,
        },
        body: JSON.stringify({
          from: EMAIL_SENDER,
          to: [row.recipient],
          ...content,
        }),
        signal: AbortSignal.timeout(6000),
      });
      if (!response.ok) throw Error("Email provider rejected delivery");
      await client.query("UPDATE email_outbox SET status='sent' WHERE id=$1", [
        row.email_id,
      ]);
    }
    await client.query("COMMIT");
    return new Response(null, { status: 204 });
  } catch {
    await client.query("ROLLBACK");
    return new Response("Email queue will retry", { status: 503 });
  } finally {
    client.release();
  }
};
export const config = { schedule: "* * * * *" };
