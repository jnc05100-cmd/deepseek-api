(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const state = { token: "", server: "", history: [], active: null, loginActive: null, lastFailed: "" };
  const errors = {
    UNAUTHORIZED: "접속 비밀번호가 올바르지 않습니다. 다시 연결해 주세요.",
    SERVER_NOT_READY: "서버 설정이 아직 완료되지 않았습니다. 서버의 비밀값과 허용 주소를 확인해 주세요.",
    ORIGIN_DENIED: "이 웹사이트 주소가 서버에 허용되어 있지 않습니다.",
    PROVIDER_AUTH: "DeepSeek 인증 설정을 확인해 주세요.",
    PROVIDER_BALANCE: "DeepSeek 잔액이 부족합니다.",
    PROVIDER_BUSY: "요청이 몰리고 있습니다. 잠시 뒤 다시 시도해 주세요.",
    PROVIDER_REQUEST: "모델이 요청을 처리할 수 없습니다. 대화가 너무 길다면 새 대화를 시작해 주세요.",
    PROVIDER_FAILED: "DeepSeek가 응답하지 않았습니다. 잠시 뒤 다시 시도해 주세요.",
    EMPTY_REPLY: "빈 답변을 받았습니다. 다시 시도해 주세요.",
    SECRET_INPUT: "입력에 민감한 정보가 감지되었습니다. 키나 비밀번호를 지우고 다시 보내 주세요.",
    BODY_TOO_LARGE: "대화 데이터가 너무 큽니다. 새 대화를 시작해 주세요.",
    INVALID_MESSAGES: "대화 형식에 문제가 있습니다. 새 대화를 시작해 주세요.",
    CONNECTION_FAILED: "연결하지 못했습니다. 서버 주소와 네트워크를 확인해 주세요."
  };
  try { state.server = localStorage.getItem("yeobaek-server") || window.CHAT_CONFIG?.serverUrl || ""; }
  catch { state.server = window.CHAT_CONFIG?.serverUrl || ""; }

  function icon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", `#i-${name}`); svg.setAttribute("aria-hidden", "true"); svg.append(use);
    return svg;
  }
  function showNotice(message) { $("notice").textContent = message; $("notice").hidden = !message; }
  function update() {
    $("connection").textContent = state.token ? "개인 연결됨" : "연결 설정 필요";
    $("connection").classList.toggle("connected", Boolean(state.token));
    $("send").disabled = !state.active && !$("prompt").value.trim();
    $("send").setAttribute("aria-label", state.active ? "답변 생성 중지" : "질문 보내기");
    $("send").replaceChildren(icon(state.active ? "stop" : "send"));
    $("compose-status").textContent = state.active ? "답변을 작성하고 검사하는 중…" : "Enter로 전송 · Shift + Enter로 줄바꿈";
    $("prompt").disabled = Boolean(state.active);
  }
  function openConnection() {
    $("server-url").value = state.server;
    $("access-password").value = "";
    $("dialog-error").hidden = true;
    if (!$("connect-dialog").open) $("connect-dialog").showModal();
    (state.server ? $("access-password") : $("server-url")).focus();
  }
  function validateServer(value) {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1"].includes(url.hostname);
    if ((url.protocol !== "https:" && !(local && url.protocol === "http:"))
      || url.username || url.password || url.search || url.hash || !["", "/"].includes(url.pathname)) throw new Error("BAD_URL");
    return url.origin;
  }
  async function callServer(path, payload, signal, server = state.server, token = state.token) {
    const response = await fetch(`${server}${path}`, {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify(payload), signal, credentials: "omit", cache: "no-store", redirect: "error"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(errors[data.error] || "서버가 요청을 처리하지 못했습니다.");
    return data;
  }
  $("connect-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (state.loginActive) return;
    const controller = new AbortController(); state.loginActive = controller;
    $("dialog-error").hidden = true;
    $("connect-submit").disabled = true; $("connect-submit").textContent = "연결 확인 중…";
    try {
      let server;
      try { server = validateServer($("server-url").value.trim()); }
      catch { throw new Error("서버의 HTTPS 주소만 입력해 주세요. 주소 뒤의 경로는 제외해 주세요."); }
      const token = $("access-password").value;
      if (token.startsWith("sk-")) throw new Error("DeepSeek 키 대신 개인 접속 비밀번호를 입력해 주세요.");
      const result = await callServer("/session", {}, controller.signal, server, token);
      if (result.ok !== true) throw new Error("서버의 연결 확인 응답이 올바르지 않습니다.");
      state.server = server; state.token = token;
      try { localStorage.setItem("yeobaek-server", server); } catch { /* Storage is optional. */ }
      $("access-password").value = ""; $("connect-dialog").close();
      showNotice("연결되었습니다. 질문을 입력해 주세요."); $("prompt").focus();
    } catch (error) {
      if (error.name !== "AbortError") {
        $("dialog-error").textContent = error instanceof TypeError ? errors.CONNECTION_FAILED : error.message;
        $("dialog-error").hidden = false;
      }
    } finally {
      if (state.loginActive === controller) state.loginActive = null;
      $("connect-submit").disabled = false; $("connect-submit").textContent = "연결하기"; update();
    }
  });
  $("connect-dialog").addEventListener("close", () => { state.loginActive?.abort(); $("access-password").value = ""; });
  $("close-dialog").addEventListener("click", () => $("connect-dialog").close());
  for (const id of ["settings", "connection"]) $(id).addEventListener("click", openConnection);

  function scrollBottom() { $("conversation").scrollTop = $("conversation").scrollHeight; }
  function renderText(container, content) {
    // Parse only fenced code; all content is textContent, never raw HTML/Markdown.
    const parts = content.split(/(```[^\n]*\n[\s\S]*?```)/g);
    for (const part of parts) {
      if (part.startsWith("```") && part.endsWith("```")) {
        const pre = document.createElement("pre"), code = document.createElement("code");
        code.textContent = part.slice(part.indexOf("\n") + 1, -3).replace(/\n$/, "");
        pre.append(code); container.append(pre);
      } else container.append(document.createTextNode(part));
    }
  }
  function addMessage(role, content, kind = "") {
    const row = document.createElement("article"); row.className = `message ${role} ${kind}`;
    if (role === "assistant") {
      const heading = document.createElement("div"); heading.className = "message-heading";
      const mark = document.createElement("span"); mark.className = "mini-mark"; mark.append(icon("spark"));
      heading.append(mark, document.createTextNode("DeepSeek")); row.append(heading);
    }
    const text = document.createElement("div"); text.className = "message-text";
    renderText(text, content); row.append(text);
    if (role === "assistant" && !kind) {
      const actions = document.createElement("div"); actions.className = "message-actions";
      const copy = document.createElement("button"); copy.className = "copy-button";
      copy.append(icon("copy"), document.createTextNode("복사"));
      copy.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(content); copy.textContent = "복사됨"; }
        catch { copy.textContent = "텍스트를 선택해서 복사해 주세요"; }
      });
      actions.append(copy); row.append(actions);
    }
    $("messages").append(row); scrollBottom(); return row;
  }
  function sizePrompt() {
    $("prompt").style.height = "auto";
    $("prompt").style.height = `${Math.min(170, $("prompt").scrollHeight)}px`; update();
  }
  $("prompt").addEventListener("input", sizePrompt);
  document.querySelectorAll("[data-prompt]").forEach(button => button.addEventListener("click", () => {
    $("prompt").value = button.dataset.prompt; sizePrompt(); $("prompt").focus();
  }));
  function resetChat() {
    state.active?.abort(); state.active = null; state.history = []; state.lastFailed = "";
    $("messages").replaceChildren(); $("welcome").hidden = false;
    $("chat-title").textContent = "아직 시작하지 않은 대화"; $("prompt").value = "";
    showNotice(""); sizePrompt();
  }
  $("new-chat").addEventListener("click", resetChat);
  $("lock").addEventListener("click", () => { resetChat(); state.token = ""; update(); showNotice("잠겼습니다. 다시 연결하려면 연결 설정을 눌러 주세요."); });
  // Mobile needs the same new-chat and lock actions without a hidden sidebar.
  const mobileActions = document.createElement("div"); mobileActions.className = "mobile-actions";
  for (const [name, label, action] of [["plus", "새 대화", resetChat], ["lock", "잠그기", () => $("lock").click()]]) {
    const button = document.createElement("button"); button.className = "icon-button";
    button.setAttribute("aria-label", label); button.title = label; button.append(icon(name)); button.addEventListener("click", action); mobileActions.append(button);
  }
  $("connection").before(mobileActions);

  async function sendQuestion(question, retry = false) {
    if (!question.trim()) return;
    if (!state.token) { openConnection(); return; }
    if (state.active) return;
    document.querySelectorAll(".message.error").forEach(row => row.remove());
    if (!retry && state.lastFailed) document.querySelector(".message.user[data-failed]")?.remove();
    const controller = new AbortController(); state.active = controller;
    $("welcome").hidden = true; showNotice(""); state.lastFailed = "";
    if (state.history.length === 0) $("chat-title").textContent = question;
    const userRow = retry ? document.querySelector(".message.user[data-failed]") : addMessage("user", question);
    if (userRow) delete userRow.dataset.failed;
    const pending = addMessage("assistant", "답변을 준비하고 있습니다", "pending");
    $("prompt").value = ""; sizePrompt();
    try {
      const messages = [...state.history, { role: "user", content: question }];
      const data = await callServer("/chat", { messages }, controller.signal);
      // A reset/lock can supersede a request even if its response just arrived.
      if (state.active !== controller) return;
      if (typeof data.content !== "string" || !data.content) throw new Error(errors.EMPTY_REPLY);
      pending.remove(); addMessage("assistant", data.content);
      state.history.push({ role: "user", content: question }, { role: "assistant", content: data.content });
      if (data.blocked) showNotice("표시 전 검사에서 답변이 차단되었습니다.");
      else if (data.truncated) showNotice("모델의 출력 한도에 도달했습니다. 이어서 설명해 달라고 요청할 수 있습니다.");
    } catch (error) {
      if (state.active !== controller) return;
      pending.remove(); state.lastFailed = question; if (userRow) userRow.dataset.failed = "true";
      const description = error.name === "AbortError" ? "답변 생성을 중지했습니다." : error instanceof TypeError ? errors.CONNECTION_FAILED : error.message;
      const row = addMessage("assistant", description, "error");
      const actions = document.createElement("div"); actions.className = "message-actions";
      const retryButton = document.createElement("button"); retryButton.className = "retry-button"; retryButton.textContent = "다시 시도";
      retryButton.addEventListener("click", () => sendQuestion(question, true)); actions.append(retryButton); row.append(actions);
    } finally {
      if (state.active === controller) { state.active = null; update(); $("prompt").focus(); }
    }
  }
  $("chat-form").addEventListener("submit", event => {
    event.preventDefault(); if (state.active) state.active.abort(); else sendQuestion($("prompt").value.trim());
  });
  $("prompt").addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) { event.preventDefault(); $("chat-form").requestSubmit(); }
  });
  window.addEventListener("pagehide", () => { state.token = ""; state.history = []; state.active?.abort(); resetChat(); update(); });
  update();
})();
