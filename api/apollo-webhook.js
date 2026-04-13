/**
 * Apollo.io `people/match` with `reveal_phone_number` + `webhook_url` POSTs here when async data is ready.
 * Vercel deploys this as: https://<your-project>.vercel.app/api/apollo-webhook
 *
 * Must return 2xx quickly; Apollo retries on failure. See Vercel logs for payloads.
 */

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, path: "/api/apollo-webhook" });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).end("Method Not Allowed");
  }
  try {
    const payload = req.body;
    const line =
      typeof payload === "object" && payload !== null
        ? JSON.stringify(payload).slice(0, 4000)
        : String(payload ?? "").slice(0, 4000);
    console.log("[apollo-webhook]", line);
  } catch (e) {
    console.error("[apollo-webhook]", e);
  }
  return res.status(200).json({ ok: true });
}
