export const runtime = "nodejs";

const MODEL = "HuggingFaceTB/SmolLM3-3B:hf-inference";

type Msg = { role: "system" | "user" | "assistant"; content: string };

export async function POST(req: Request) {
  const hfToken = process.env.HF_TOKEN;
  if (!hfToken) return new Response("Missing HF_TOKEN", { status: 500 });

  const { messages } = (await req.json()) as { messages: Msg[] };

  // --- Simple in-memory rate limit (10 msgs/hour per IP) ---
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const key = `rl:${ip}`;
  // @ts-ignore - global cache for dev/serverless
  globalThis.__rl ??= new Map<string, { count: number; resetAt: number }>();
  // @ts-ignore
  const bucket: Map<string, { count: number; resetAt: number }> = globalThis.__rl;

  const limit = 10;
  const windowMs = 60 * 60 * 1000;

  const cur = bucket.get(key);
  if (!cur || now > cur.resetAt) bucket.set(key, { count: 1, resetAt: now + windowMs });
  else {
    if (cur.count >= limit) {
      const retryAfter = Math.ceil((cur.resetAt - now) / 1000);
      return new Response("Rate limit reached. Try again later.", {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      });
    }
    cur.count += 1;
  }
  // --------------------------------------------------------

  const resp = await fetch("https://router.huggingface.co/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${hfToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 256,
      stream: false,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    return new Response(`HF error ${resp.status}: ${text}`, { status: 500 });
  }

  const data = await resp.json();
  const answer = data?.choices?.[0]?.message?.content ?? "";

  return new Response(answer, { headers: { "Content-Type": "text/plain" } });
}
