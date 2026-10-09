// This is a finite, editable dictionary. It cannot identify every slang term,
// paraphrase, enciphered secret, or newly invented insult.
export const BLOCKED_TERMS = [
  "씨발", "시발", "씨팔", "시팔", "씨바", "씹새", "씹할", "씨벌",
  "ㅅㅂ", "ㅆㅂ", "병신", "븅신", "ㅂㅅ", "개새끼", "새끼", "개년",
  "미친놈", "미친년", "지랄", "ㅈㄹ", "좆", "존나", "졸라", "ㅈㄴ",
  "꺼져", "닥쳐", "엿먹", "보지", "자지", "창녀",
  "fuck", "shit", "bitch", "asshole", "bastard", "cunt",
  "일베", "일간베스트", "ilbe", "일게이", "운지", "홍어", "틀딱", "노알라"
];

export const FILTERED_REPLY = "답변에 허용되지 않는 표현 또는 민감한 정보가 포함되어 표시하지 않았습니다. 질문을 바꿔 다시 요청해 주세요.";

// Hangul NFD handles decomposed syllables as well as ordinary Korean text.
// Removing separators also catches spaced, zero-width and punctuated variants.
export function normalize(text) {
  return String(text).normalize("NFKC").normalize("NFD").toLowerCase()
    .replace(/[\p{M}\p{Cf}\p{Z}\p{P}\p{S}\s]/gu, "");
}
const normalizedTerms = BLOCKED_TERMS.map(normalize);

function encodedVariants(secret) {
  const bytes = new TextEncoder().encode(secret);
  const binary = Array.from(bytes, b => String.fromCharCode(b)).join("");
  return [secret, encodeURIComponent(secret), btoa(binary),
    Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("")];
}

export function containsSecret(text, secrets = []) {
  const compact = normalize(text);
  if (secrets.some(secret => secret && encodedVariants(secret)
    .some(value => compact.includes(normalize(value))))) return true;
  // Common credential formats, plus labelled credential values. Do not forbid
  // ordinary discussion of APIs, authentication, or placeholder examples.
  const canonical = String(text).normalize("NFKC").replace(/\p{Cf}/gu, "");
  return /\b(?:sk-[a-z0-9_-]{12,}|gh[pousr]_[a-z0-9]{20,}|github_pat_[a-z0-9_]{20,}|AKIA[A-Z0-9]{16})\b/i.test(canonical)
    || /-----BEGIN [A-Z ]*PRIVATE KEY-----/i.test(canonical)
    || /(?:api[\s_-]*key|access[\s_-]*token|secret|비밀번호|비밀키)\s*[=:]\s*["']?[a-z0-9_\/-]{20,}/i.test(canonical);
}

export function filterAnswer(text, secrets = []) {
  const normalized = normalize(text);
  const blocked = normalizedTerms.some(term => normalized.includes(term))
    || containsSecret(text, secrets);
  return { content: blocked ? FILTERED_REPLY : text, blocked };
}
