# 여백 — 나만의 DeepSeek 채팅

한국어 개인 채팅 웹사이트입니다. `docs/`는 GitHub Pages에, `server/`는 Cloudflare Workers에 배포합니다. GitHub Pages는 정적 파일만 제공하므로 키를 안전하게 보관하고 요청을 처리할 별도 서버가 필요합니다.

**현재 상태: 소스 완성·로컬 검사 완료. 실제 계정에 배포하거나 실제 DeepSeek 응답을 테스트한 상태는 아닙니다.** DeepSeek 키, GitHub 저장소, Cloudflare 계정 연결은 사용자가 설정해야 합니다. 실제 키를 채팅이나 저장소에 올리지 마세요.

## 제공 기능

- 질문과 답변, 같은 탭에서 대화 맥락 유지, 코드 블록 표시, 답변 복사, 새 대화, 생성 중지, 실패 시 재시도.
- 개인 접속 비밀번호 인증. 새로고침하거나 잠그면 다시 연결해야 합니다.
- DeepSeek 키는 서버의 Secret으로만 보관. 모델에 보내는 대화에는 서버의 키나 접속 비밀번호를 넣지 않습니다.
- 서버에서 답변 전체를 검사한 뒤 표시. 욕설·일간베스트 관련 사전의 표현이 있으면 답변 전체를 안내 문구로 대체합니다.
- **API라는 단어는 허용합니다.** 실제 인증키, 알려진 비밀값과 일부 흔한 키 형식은 차단합니다. 서버 오류 원문, 추론 내용, 도구 호출은 브라우저에 전달하지 않습니다.
- 외부 라이브러리·CDN 없이 동작하는 반응형 화면. 대화와 비밀번호를 브라우저 저장소에 보관하지 않습니다. 서버 주소만 기기 설정으로 저장합니다.

## 1. GitHub 저장소 준비

1. GitHub에서 새 저장소를 만듭니다. 예: `my-ai-chat`.
2. 이 폴더의 내용을 저장소 루트에 업로드합니다. 폴더 구조를 유지하세요. 키를 포함하는 `.dev.vars`나 `.env`는 업로드하지 않습니다.
3. 저장소 **Settings → Pages → Build and deployment**에서 **Deploy from a branch**, 브랜치 **main**, 폴더 **/docs**를 선택하고 저장합니다.
4. 사이트 주소는 일반적으로 `https://GITHUB-ID.github.io/my-ai-chat/`입니다.

일반 GitHub Pages 사이트의 HTML과 JavaScript는 공개 접근될 수 있습니다. 이 프로젝트는 화면 자체의 비공개 호스팅 대신 **실제 채팅 요청을 개인 비밀번호로 보호**합니다. 저장소를 비공개로 만들었다고 Pages 화면도 자동으로 비공개가 되는 것은 아닙니다. 무료 계정에서는 Pages용 공개 저장소가 필요합니다. 화면 전체에 로그인 차단이 필요하면 지원되는 GitHub Enterprise Pages 접근 제어나 다른 비공개 호스팅이 필요합니다.

## 2. 서버 준비 및 배포

[Node.js](https://nodejs.org/)의 지원되는 LTS 버전을 설치하고 [Cloudflare](https://dash.cloudflare.com/) 계정을 준비합니다. PowerShell 또는 터미널에서 이 프로젝트 폴더로 이동해 실행합니다. 앱 소스는 설치 과정 없이 사용할 수 있으며, `npx`는 서버 배포용 Wrangler를 실행합니다.

먼저 `server/wrangler.toml`을 엽니다.

```toml
ALLOWED_ORIGIN = "https://GITHUB-ID.github.io"
```

본인 아이디로 바꿉니다. **저장소 경로 `/my-ai-chat/`나 마지막 `/`는 넣지 않습니다.** 커스텀 도메인을 쓰면 그 도메인의 HTTPS origin으로 바꿉니다.

서버를 만들고 비밀값을 등록합니다.

```powershell
npx wrangler@4 login
npx wrangler@4 deploy --config server/wrangler.toml
npx wrangler@4 secret put DEEPSEEK_API_KEY --config server/wrangler.toml
npx wrangler@4 secret put PERSONAL_ACCESS_TOKEN --config server/wrangler.toml
```

첫 번째 Secret에는 본인 DeepSeek 키를, 두 번째에는 **32자 이상의 무작위 개인 접속 비밀번호**를 입력합니다. 배포 직후 Secret이 없으면 서버는 요청을 차단합니다. 키는 Cloudflare 대시보드에서도 Secret 유형으로 등록할 수 있습니다. 일반 텍스트 변수나 `wrangler.toml`에 넣지 마세요.

개인 접속 비밀번호는 아래처럼 만들 수 있습니다. 출력값을 비밀번호 관리 도구에 보관하고 `PERSONAL_ACCESS_TOKEN` 등록에 사용하세요.

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

배포 결과에서 `https://my-deepseek-chat.본인서브도메인.workers.dev` 형태의 주소를 확인합니다. 사이트의 **연결 설정**에 이 서버 주소와 **개인 접속 비밀번호**를 입력하면 됩니다. 웹사이트에는 DeepSeek 키를 입력하지 않습니다. 연결 확인은 모델을 호출하지 않습니다.

선택: `docs/config.js`의 `serverUrl`에 서버의 공개 주소를 넣고 GitHub에 반영하면 처음부터 주소가 채워집니다. **이 파일에는 비밀번호나 키를 넣으면 안 됩니다.** 서버 주소를 설정하지 않아도 연결 설정에서 직접 입력할 수 있습니다.

## 3. 직접 확인

1. 올바른 개인 비밀번호로 연결되고 잘못된 비밀번호는 거부되는지 확인합니다.
2. 평범한 질문에 답변하는지 확인합니다.
3. 욕설 또는 금칙어를 답변하도록 요구했을 때 금칙어가 화면에 표시되지 않는지 확인합니다. 모델 자체가 해당 표현을 만들지 않을 수도 있습니다.
4. 새 대화·답변 복사·생성 중지·모바일 화면을 확인합니다.

인증 후 질문과 대화 맥락은 DeepSeek로 전송됩니다. 이 앱은 대화를 별도 데이터베이스에 저장하지 않지만 제공업체의 데이터 처리 정책은 별도로 적용됩니다. 생성 중지는 브라우저 요청을 취소하며, 이미 시작한 제공업체 생성의 취소나 과금 중단까지 보장하지 않습니다.

## 모델과 출력 길이

기본 모델은 공식 문서에 있는 `deepseek-flash`입니다. `server/wrangler.toml`의 `DEEPSEEK_MODEL`을 `deepseek-v4-pro`로 바꿔 재배포하면 Pro를 사용합니다. 기본값은 비사고 모드입니다.

2026-10-09 확인한 공식 문서 기준 모델 최대 출력인 **393,216 토큰(384K)**을 요청합니다. 별도의 작은 토큰 상한이나 대화 개수 제한을 넣지 않았고, 오래된 대화를 몰래 자르지 않습니다. **무제한 출력은 아닙니다.** 모델의 컨텍스트·출력 한도, 계정 잔액, 제공업체 및 호스팅 제한은 적용됩니다. 긴 출력은 검사 완료까지 오래 걸릴 수 있습니다. 요청 본문에는 메모리 보호용 8MiB 바이트 제한이 있습니다. 제공업체 한도가 바뀌면 서버 검증값과 설정값을 함께 수정하세요.

## 금칙어와 비밀정보 필터

`server/filter.mjs`의 `BLOCKED_TERMS`를 수정하고 서버를 재배포하면 금칙어를 추가할 수 있습니다. 유니코드 정규화, 공백·구두점·제로폭 문자 제거 후 검사하며, 탐지하면 **답변 전체를 차단**합니다. 중간 스트리밍은 사용하지 않아 검사 전 단어가 먼저 보이지 않습니다.

사전 필터는 한계가 있습니다. 목록에 없는 욕설, 문맥에 따라 달라지는 의미, 새로운 은어, 모든 암호화·인코딩 방식까지 100% 막지는 못합니다. 정상적인 인용이나 지명 등도 목록과 일치하면 차단될 수 있습니다. 서버에 등록된 비밀값은 원문·일부 흔한 인코딩으로 검사하고, 일반적인 키 형식도 검사합니다. 제3자의 모든 비밀정보를 알아낼 수 있는 범용 탐지 기능은 아닙니다.

모델에 적용되는 제공업체 안전장치를 제거하거나 무력화하는 탈옥 프롬프트는 포함하지 않았습니다. 일반적인 질문에 직접 답하도록 설정했으며, 제공업체의 필터는 별도로 적용됩니다.

접속 비밀번호는 서버 요청 권한을 가진 비밀 토큰입니다. 다른 사람에게 공유하지 말고, 노출되면 Cloudflare Secret을 새 값으로 교체하세요. origin 제한만으로 인증을 대신하지 않습니다.

## 로컬 미리보기와 검사

```powershell
node tools/preview.mjs
node tests/security.test.mjs
```

미리보기: `http://127.0.0.1:4173`. 미리보기는 화면을 제공하며 가짜 AI 답변을 실사용 응답으로 표시하지 않습니다.

실제 로컬 연결이 필요하면 `server/.dev.vars.example`을 `server/.dev.vars`로 복사하고 본인 키와 개인 비밀번호를 입력합니다. 여기에 `ALLOWED_ORIGIN="http://127.0.0.1:4173"`도 추가합니다. 아래 명령으로 로컬 서버를 실행하고, 사이트의 연결 설정에 Wrangler가 출력한 로컬 주소를 입력합니다. `.dev.vars`는 저장소에 올리지 않습니다.

```powershell
npx wrangler@4 dev --config server/wrangler.toml
```

테스트는 실제 DeepSeek 대신 가짜 upstream 응답을 사용합니다. 인증, origin 제한, 프롬프트 역할 검증, 키 차단, 오류 비노출, 전체 답변 검사, 긴 대화 유지 등을 검증합니다. 실제 DeepSeek 호출 성공은 별도 확인이 필요합니다.

## 공식 참고 문서

- [GitHub Pages의 정적 호스팅과 저장소 조건](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [DeepSeek 요청 형식](https://api-docs.deepseek.com/api/create-chat-completion/)
- [DeepSeek 모델과 최대 출력](https://api-docs.deepseek.com/quick_start/pricing/)
- [Cloudflare Secret 보관](https://developers.cloudflare.com/workers/configuration/secrets/)
