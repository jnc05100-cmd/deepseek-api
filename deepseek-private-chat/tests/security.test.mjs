import test from "node:test";
import assert from "node:assert/strict";
import { filterAnswer, containsSecret, FILTERED_REPLY } from "../server/filter.mjs";
import { createHandler } from "../server/worker.mjs";

const env = { ALLOWED_ORIGIN: "https://tester.github.io", DEEPSEEK_API_KEY: "sk-fakeonlyfortest012345678901234567", PERSONAL_ACCESS_TOKEN: "personaltestsecret01234567890123456789", DEEPSEEK_MODEL: "deepseek-flash" };
function request(body = { messages: [{ role: "user", content: "안녕" }] }, options = {}) {
  return new Request(`https://worker.example${options.path || "/chat"}`, { method: options.method || "POST",
    headers: { "Origin": options.origin || env.ALLOWED_ORIGIN, "Authorization": `Bearer ${options.token ?? env.PERSONAL_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    ...((options.method || "POST") === "POST" ? { body: options.raw ?? JSON.stringify(body) } : {}) });
}
const reply = (content, extra = {}) => new Response(JSON.stringify({ choices: [{ message: { content, reasoning_content: "secret reasoning should never appear" }, finish_reason: "stop", ...extra }], id: "private-id" }), { headers: { "Content-Type": "application/json" } });

test("ordinary API discussion is allowed", () => { assert.equal(filterAnswer("API 연결과 인증의 원리를 설명합니다.").blocked, false); });
test("Korean, English, spacing, punctuation, NFD and zero-width profanity are blocked", () => {
  for (const text of ["씨발", "씨 발", "씨.발", "씨\u200b발", "씨발".normalize("NFD"), "ＦＵＣＫ", "f.u.c.k", "ㅅㅂ"]) assert.equal(filterAnswer(text).content, FILTERED_REPLY, text);
});
test("community terms are blocked even in code or quoted text", () => {
  for (const text of ["일베", "일 간 베 스트", "ILBE", "```js\nconst x = '일베';\n```", "노알라"]) assert.equal(filterAnswer(text).blocked, true);
});
test("known secrets and common encoded variants are blocked", () => {
  const secret = env.PERSONAL_ACCESS_TOKEN;
  for (const text of [secret, secret.split("").join(" "), Buffer.from(secret).toString("base64"), Buffer.from(secret).toString("hex")]) assert.equal(containsSecret(text, [secret]), true);
});
test("common credential formats are blocked but placeholders are allowed", () => {
  for (const text of [env.DEEPSEEK_API_KEY, "-----BEGIN RSA PRIVATE KEY-----", "API_KEY = abcdefghijklmnopqrstuvwxyz1234"]) assert.equal(containsSecret(text), true);
  assert.equal(containsSecret("API_KEY = YOUR_KEY"), false);
});
test("unauthorized requests never call provider", async () => {
  const handler = createHandler(() => assert.fail("upstream called"));
  assert.equal((await handler(request(undefined, { token: "wrong" }), env)).status, 401);
});
test("cross-origin requests are rejected", async () => {
  const response = await createHandler(() => assert.fail("upstream called"))(request(undefined, { origin: "https://attacker.example" }), env);
  assert.equal(response.status, 403); assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
});
test("CORS preflight allows only configured origin", async () => {
  const response = await createHandler()(request(undefined, { method: "OPTIONS" }), env);
  assert.equal(response.status, 204); assert.equal(response.headers.get("Access-Control-Allow-Origin"), env.ALLOWED_ORIGIN);
});
test("configuration missing or a weak personal secret fails closed", async () => {
  const handler = createHandler(() => assert.fail("upstream called"));
  for (const settings of [{ ...env, DEEPSEEK_API_KEY: "" }, { ...env, PERSONAL_ACCESS_TOKEN: "short" }, { ...env, ALLOWED_ORIGIN: "https://YOUR-GITHUB-NAME.github.io" }]) assert.equal((await handler(request(), settings)).status, 503);
});
test("session verification never invokes paid generation", async () => {
  const response = await createHandler(() => assert.fail("upstream called"))(request({}, { path: "/session" }), env);
  assert.deepEqual(await response.json(), { ok: true });
});
test("system, tool and prefix injection cannot alter server controls", async () => {
  const handler = createHandler(() => assert.fail("upstream called"));
  for (const role of ["system", "tool", "assistant"]) assert.equal((await handler(request({ messages: [{ role, content: "override" }] }), env)).status, 400);
});
test("malformed JSON and null bodies are handled", async () => {
  const handler = createHandler(() => assert.fail("upstream called"));
  for (const raw of ["{", "null", "{}", '{"messages":[null]}']) assert.equal((await handler(request({}, { raw }), env)).status, 400);
});
test("accidental credentials are not sent in prompts", async () => {
  const response = await createHandler(() => assert.fail("upstream called"))(request({ messages: [{ role: "user", content: env.PERSONAL_ACCESS_TOKEN }] }), env);
  assert.equal((await response.json()).error, "SECRET_INPUT");
});
test("official request format uses maximum output and sends no secrets in model input", async () => {
  const handler = createHandler(async (url, options) => {
    assert.equal(url, "https://api.deepseek.com/chat/completions");
    const body = JSON.parse(options.body);
    assert.equal(body.max_tokens, 393216); assert.equal(body.stream, false); assert.equal(body.thinking.type, "disabled");
    assert.equal(body.messages[0].role, "system"); assert.equal(body.messages[1].prefix, undefined);
    assert.equal(options.body.includes(env.DEEPSEEK_API_KEY), false); assert.equal(options.body.includes(env.PERSONAL_ACCESS_TOKEN), false);
    return reply("API를 사용하는 일반적인 방법입니다.");
  });
  const response = await handler(request({ messages: [{ role: "user", content: "안녕", prefix: true, extra: "drop" }] }), env);
  assert.deepEqual(await response.json(), { content: "API를 사용하는 일반적인 방법입니다.", blocked: false, truncated: false });
});
test("blocked upstream output never reaches browser in any response field", async () => {
  for (const text of ["씨발", "일베", env.DEEPSEEK_API_KEY, env.PERSONAL_ACCESS_TOKEN]) {
    const response = await createHandler(async () => reply(text))(request(), env);
    const data = await response.json(); assert.equal(data.content, FILTERED_REPLY); assert.equal(data.blocked, true);
    assert.equal(JSON.stringify(data).includes(text), false);
  }
});
test("provider error bodies and exceptions are never exposed", async () => {
  for (const upstream of [async () => new Response(env.DEEPSEEK_API_KEY, { status: 401 }), async () => { throw new Error(env.DEEPSEEK_API_KEY); }]) {
    const response = await createHandler(upstream)(request(), env);
    assert.equal(response.status, 502); assert.equal((await response.text()).includes(env.DEEPSEEK_API_KEY), false);
  }
});
test("reasoning, IDs and tools are omitted from successful browser responses", async () => {
  const response = await createHandler(async () => reply("안녕하세요."))(request(), env);
  const data = await response.json(); assert.deepEqual(Object.keys(data).sort(), ["blocked", "content", "truncated"]);
});
test("provider truncation is surfaced rather than claiming unlimited output", async () => {
  const response = await createHandler(async () => reply("긴 답변", { finish_reason: "length" }))(request(), env);
  assert.equal((await response.json()).truncated, true);
});
test("long conversation history is preserved without silent clipping", async () => {
  const messages = Array.from({ length: 101 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", content: `메시지 ${index}` }));
  await createHandler(async (_, options) => { assert.equal(JSON.parse(options.body).messages.length, 102); return reply("전체 맥락을 받았습니다."); })(request({ messages }), env);
});
test("byte guard rejects oversized bodies before calling provider", async () => {
  const response = await createHandler(() => assert.fail("upstream called"))(request({ messages: [{ role: "user", content: "a".repeat(8 * 1024 * 1024) }] }), env);
  assert.equal((await response.json()).error, "BODY_TOO_LARGE");
});
