/**
 * Server-side proxy to SerpApi Google search. The browser calls same-origin `/api/serp-google`
 * so SerpApi CORS does not apply (unlike calling https://serpapi.com from the client).
 * Local dev continues to use Vite `/serpapi` → see helpers.js.
 */

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "GET, OPTIONS");
    return res.status(204).end();
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return res.status(405).end("Method Not Allowed");
  }
  try {
    const host = req.headers.host || "localhost";
    const incoming = new URL(req.url || "/", `https://${host}`);
    const target = new URL("https://serpapi.com/search.json");
    incoming.searchParams.forEach((value, key) => {
      target.searchParams.append(key, value);
    });
    const r = await fetch(target.toString(), {
      headers: { Accept: "application/json" },
    });
    const text = await r.text();
    const ct = r.headers.get("content-type") || "application/json; charset=utf-8";
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "no-store");
    return res.status(r.status).send(text);
  } catch (e) {
    console.error("[serp-google]", e);
    return res.status(502).json({ error: "SerpApi proxy failed" });
  }
}
