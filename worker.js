const APP_ORIGIN = "https://grahamwe4-bit.github.io";
const LOCAL_ORIGINS = new Set(["http://localhost:8000", "http://127.0.0.1:8000"]);
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_CHARS = 7 * 1024 * 1024;
const MAX_QUESTION_CHARS = 3000;
const MAX_HISTORY_TURNS = 10;
const rateBuckets = new Map();

function corsHeaders(origin) {
  const headers = new Headers({
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  });
  if (origin === APP_ORIGIN || LOCAL_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return headers;
}

function json(data, status, headers) {
  const outputHeaders = new Headers(headers);
  outputHeaders.set("Content-Type", "application/json; charset=utf-8");
  outputHeaders.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(data), { status, headers: outputHeaders });
}

function allowRequest(ip, now) {
  // Best-effort per-Worker-isolate limits. Durable limits can be added with a
  // shared Cloudflare rate-limit binding if the app's traffic requires it.
  const minute = 60 * 1000;
  const day = 24 * 60 * minute;
  let bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.dayStart >= day) {
    bucket = { minuteStart: now, minuteCount: 0, dayStart: now, dayCount: 0 };
    rateBuckets.set(ip, bucket);
  }
  if (now - bucket.minuteStart >= minute) {
    bucket.minuteStart = now;
    bucket.minuteCount = 0;
  }
  if (bucket.minuteCount >= 6 || bucket.dayCount >= 40) return false;
  bucket.minuteCount += 1;
  bucket.dayCount += 1;
  if (rateBuckets.size > 5000) {
    for (const [key, value] of rateBuckets) {
      if (now - value.dayStart >= day) rateBuckets.delete(key);
    }
  }
  return true;
}

function isAllowedOrigin(origin) {
  return origin === APP_ORIGIN || LOCAL_ORIGINS.has(origin);
}

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .slice(-MAX_HISTORY_TURNS * 2)
    .filter((message) =>
      message &&
      (message.role === "user" || message.role === "assistant") &&
      typeof message.content === "string" &&
      message.content.length <= MAX_QUESTION_CHARS,
    )
    .map(({ role, content }) => ({ role, content }));
}

async function readJsonLimited(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing request body");
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new RangeError("Request body too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

function extractAnswer(response) {
  const parts = (response.output || [])
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text);
  return parts.join("\n\n").trim();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin);

    if (url.pathname === "/" || url.pathname === "/health") {
      return json({ service: "Frame / ask", ready: Boolean(env.OPENAI_API_KEY) }, 200, headers);
    }

    if (url.pathname !== "/api/ask") {
      return json({ error: "Not found." }, 404, headers);
    }
    if (request.method === "OPTIONS") {
      if (!isAllowedOrigin(origin)) return json({ error: "This site is not allowed." }, 403, headers);
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== "POST") {
      return json({ error: "Use POST to ask a question." }, 405, headers);
    }
    if (!isAllowedOrigin(origin)) {
      return json({ error: "This site is not allowed." }, 403, headers);
    }
    if (!env.OPENAI_API_KEY) {
      return json({ error: "The ChatGPT connection is still being set up. Please try again soon." }, 503, headers);
    }
    const contentLength = Number(request.headers.get("Content-Length") || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return json({ error: "This image is too large. Choose a smaller image and try again." }, 413, headers);
    }

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (!allowRequest(ip, Date.now())) {
      return json({ error: "You’ve reached the short-term guest limit. Please wait a little and try again." }, 429, headers);
    }

    let body;
    try {
      body = await readJsonLimited(request);
    } catch (error) {
      if (error instanceof RangeError) {
        return json({ error: "This image is too large. Choose a smaller image and try again." }, 413, headers);
      }
      return json({ error: "Could not read the question. Please try again." }, 400, headers);
    }
    const question = typeof body.question === "string" ? body.question.trim() : "";
    const image = typeof body.image === "string" ? body.image : "";
    if (!question || question.length > MAX_QUESTION_CHARS) {
      return json({ error: "Enter a question under 3,000 characters." }, 400, headers);
    }
    if (image.length > MAX_IMAGE_CHARS || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) {
      return json({ error: "That image format or size is not supported. Choose a smaller image and try again." }, 400, headers);
    }

    const input = [
      ...cleanHistory(body.history),
      {
        role: "user",
        content: [
          { type: "input_text", text: question },
          { type: "input_image", image_url: image, detail: "high" },
        ],
      },
    ];

    let upstream;
    try {
      upstream = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: env.OPENAI_MODEL || "gpt-4.1-mini",
          instructions: "You are a clear, helpful assistant answering questions about the user's image. Be direct, mention uncertainty when details are unclear, and keep the answer concise unless the user asks for detail.",
          input,
          max_output_tokens: 600,
          store: false,
        }),
      });
    } catch {
      return json({ error: "ChatGPT could not be reached. Please try again." }, 502, headers);
    }

    if (!upstream.ok) {
      if (upstream.status === 429) {
        return json({ error: "ChatGPT is busy right now. Please wait a moment and try again." }, 429, headers);
      }
      return json({ error: "ChatGPT could not answer just now. Please try again." }, 502, headers);
    }

    let result;
    try {
      result = await upstream.json();
    } catch {
      return json({ error: "ChatGPT returned an unreadable answer. Please try again." }, 502, headers);
    }
    const answer = extractAnswer(result);
    if (!answer) {
      return json({ error: "ChatGPT returned an empty answer. Please try again." }, 502, headers);
    }
    return json({ answer }, 200, headers);
  },
};
