export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  // Apollo posts async phone reveal updates here.
  // Keep this endpoint fast and always acknowledge receipt.
  try {
    const payload = req.body ?? {};
    console.log("[apollo-webhook] payload received", {
      hasBody: Boolean(payload && Object.keys(payload).length),
      keys: payload && typeof payload === "object" ? Object.keys(payload).slice(0, 12) : [],
    });
    return res.status(200).json({ ok: true, received: true });
  } catch {
    return res.status(200).json({ ok: true, received: false });
  }
}
