export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ==============================
    // 1️⃣ INGEST ENDPOINT (iOS)
    // ==============================
    if (url.pathname === "/") {
      if (request.method !== "POST") {
        return new Response("Only POST allowed", { status: 405 });
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return new Response("Invalid JSON", { status: 400 });
      }

      const { user_id, raw_message, received_at, source } = body;

      if (!user_id || !raw_message || !received_at) {
        return new Response("Missing required fields", { status: 400 });
      }

      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(
          `${user_id}-${received_at}-${raw_message}`
        )
      );

      const key = [...new Uint8Array(hashBuffer)]
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");

      const existing = await env.SMS_KV.get(key);
      if (existing) {
        return Response.json({ ok: true, deduped: true });
      }

      await env.SMS_KV.put(
        key,
        JSON.stringify({
          user_id,
          raw_message,
          received_at,
          source: source || "unknown",
          ingested_at: Date.now()
        }),
        { expirationTtl: 60 * 60 * 24 * 7 }
      );

      return Response.json({ ok: true });
    }

    // ==============================
    // 2️⃣ POLL ENDPOINT (Render)
    // ==============================
    if (url.pathname === "/poll") {
      // 🔐 simple protection
      const apiKey = request.headers.get("x-api-key");
      if (apiKey !== " ios_secrect_key_123") {
        return new Response("Unauthorized", { status: 401 });
      }

      const keys = await env.SMS_KV.list({ limit: 50 });

      const messages = [];

      for (const key of keys.keys) {
        const value = await env.SMS_KV.get(key.name);
        if (value) {
          messages.push({
            id: key.name,
            data: JSON.parse(value)
          });
        }
      }

      return Response.json({ messages });
    }

    return new Response("Not Found", { status: 404 });
  }
};