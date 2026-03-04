export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ======================
    // 1️⃣ INGEST (Phone)
    // ======================
    if (request.method === "POST" && url.pathname === "/") {
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
          source: source || "ios",
          ingested_at: Date.now()
        }),
        { expirationTtl: 60 * 60 * 24 * 7 }
      );

      return Response.json({ ok: true });
    }

    // ======================
    // 2️⃣ FLUSH (Cron)
    // ======================
    if (url.pathname === "/flush") {
      console.log("🔄 FLUSH START: Checking KV for messages...");
      const keys = await env.SMS_KV.list({ limit: 50 });
      console.log(`📦 Found ${keys.keys.length} messages in KV`);

      if (!keys.keys.length) {
        console.log("✅ No messages to flush");
        return Response.json({ ok: true, message: "No messages" });
      }

      const batch = [];

      for (const key of keys.keys) {
        const value = await env.SMS_KV.get(key.name);
        if (value) {
          console.log(`✓ Loaded KV entry: ${key.name}`);
          batch.push({
            id: key.name,
            data: JSON.parse(value)
          });
        }
      }

      console.log(`📤 Sending ${batch.length} messages to: ${env.RENDER_URL}`);
      console.log(`🔐 Using API key header: x-api-key`);

      try {
        const renderResponse = await fetch(env.RENDER_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": env.RENDER_API_KEY
          },
          body: JSON.stringify({ messages: batch })
        });

        console.log(`📬 Render response status: ${renderResponse.status}`);
        const responseText = await renderResponse.text();
        console.log(`📬 Render response: ${responseText}`);

        if (!renderResponse.ok) {
          throw new Error(`Render rejected batch: ${renderResponse.status} ${responseText}`);
        }

        // Delete after successful push
        console.log(`🗑️  Deleting ${batch.length} messages from KV...`);
        for (const msg of batch) {
          await env.SMS_KV.delete(msg.id);
          console.log(`  ✓ Deleted: ${msg.id}`);
        }

        console.log(`✅ FLUSH COMPLETE: ${batch.length} messages pushed and cleared`);
        return Response.json({ ok: true, pushed: batch.length });

      } catch (err) {
        console.error(`❌ FLUSH ERROR: ${err.message}`);
        return Response.json({
          ok: false,
          error: err.message,
          batch_size: batch.length
        }, { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  },

  // ======================
  // 3️⃣ CRON TRIGGER
  // ======================
  async scheduled(event, env, ctx) {
    await fetch("https://sms-ingest.karthickrajab02.workers.dev/flush");
  }
};
