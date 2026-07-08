# Phase 0 리서치 결과 (2026-07-08)

CLAUDE.md §3의 3개 리스크 + 리서치 중 발견한 1개 추가 리스크. **전부 해소 — 빌드 진행 OK.**

## R1. raw 텍스트 페이지에 content script 주입이 되는가 → ✅ 된다

- Chrome은 `text/plain` 등 raw 텍스트 응답을 `<html><body><pre>…</pre></body></html>` 구조의
  내부 뷰어 페이지로 감싸서 표시한다. 이건 일반 페이지라서 content script가 정상 주입된다.
- 실증: [simov/markdown-viewer](https://github.com/simov/markdown-viewer),
  [matpb/markdown-viewer-extension](https://github.com/matpb/markdown-viewer-extension) 등
  기존 확장들이 정확히 이 방식(contentType 확인 → pre 내용 치환)으로 동작.
- **`file://` 전제조건:** `chrome://extensions` → 확장 상세 → **"파일 URL에 대한 액세스 허용"**
  토글을 사용자가 직접 켜야 함 (프로그램으로 불가). README 설치 절차에 명시.
- 감지 로직: `document.contentType`이 텍스트 계열 && body 자식이 `<pre>` 하나 && URL 확장자가
  registry에 있을 때만 발동. `text/html`은 스킵 → GitHub/GitLab 렌더 뷰와 충돌 없음(§3 세 번째 항목).

## R2. MV3 CSP — CDN 로드 → ✅ 로컬 번들로 해소 (실물 확보·검증 완료)

MV3는 원격 호스팅 코드 금지. 전 라이브러리를 IIFE/UMD 빌드로 `app/libs/`에 번들:

| 파일 | 버전 | 전역 | 크기 |
|---|---|---|---|
| marked.min.js | 15.0.12 | `marked` | 40KB |
| purify.min.js | DOMPurify 3.4.11 | `DOMPurify` | 28KB |
| mermaid.min.js | 11.x | `globalThis.mermaid` | 3.5MB |
| wavedrom.min.js (+skin) | 3.6.1 | `WaveDrom` / `WaveSkin` | 84KB |
| highlight.min.js | 11.11.1 common | `hljs` | 127KB |
| hljs-verilog/vhdl/tcl.min.js | 11.11.1 | (hljs에 등록) | 10KB |
| json5.min.js | 2.x | `JSON5` | 32KB |

- 각 파일 head/tail에서 전역 노출 패턴 직접 확인함 (mermaid v11도 IIFE 빌드 제공 — ESM 전용 아님).
- **highlight.js는 verilog 문법 공식 지원** (SystemVerilog 키워드 포함) → Phase 2 리스크도 동시 해소.
  common 번들에는 verilog가 없어서 별도 grammar 파일 3종(verilog/vhdl/tcl) 추가 번들.

## R3. 3.5MB mermaid를 모든 페이지에 넣지 않기 → ✅ 2단 주입 구조

- content_scripts로 항상 주입되는 건 **감지기(detect.js + registry.js, ~7KB)뿐**.
- 감지 성공 시에만 service worker가 `chrome.scripting.executeScript`로 해당 타입의
  렌더러+라이브러리를 주입. 일반 웹서핑에는 영향 없음.
- 참고: 같은 확장의 content script와 executeScript(기본 ISOLATED world)는 **같은 isolated
  world를 공유** → detect.js가 `window.__rxSpec`에 스펙을 남기면 렌더러가 그대로 읽음.

## R4. (추가 발견) Windows에서 `.sv`/`.v` 등은 file:// 로 열면 다운로드됨 → ✅ 레지스트리 등록

- Chrome은 `file://` MIME을 OS에서 조회. 미등록 확장자(`.sv`, `.v`, 클린 Windows의 `.md` 등)는
  `application/octet-stream` → 렌더 기회 없이 **다운로드**된다. (이게 §3에 없던 실질 최대 리스크)
- 해결: `tools/register-mime.ps1` — `HKCU\Software\Classes\.<ext>`에 `Content Type=text/plain`만
  기록. 사용자 단위(관리자 불필요), 파일 연결(더블클릭 핸들러)은 건드리지 않음, 기존 값 있으면 스킵.
  실행 후 Chrome 재시작 필요.

## 확정 아키텍처

```
[모든 페이지]                          [raw 파일 페이지만]
registry.js + detect.js  --메시지-->  sw.js --executeScript-->  markdown: marked→DOMPurify→DOM
(contentType/ext/pre 확인)            (파일 목록은 SW가 결정,     →블록별 mermaid/wavedrom/hljs
                                       whitelist 검증)           code: hljs + 줄번호 거터
```

- 보안: 렌더 HTML은 DOMPurify 통과 후 삽입(웹 raw 파일의 XSS 차단), mermaid `securityLevel:
  'strict'`, SW는 registry whitelist에 있는 파일만 주입.
- 주의 테스트 케이스: `raw.githubusercontent.com`은 CSP `sandbox` 헤더를 보냄 — content script는
  페이지 CSP에 면제라 동작해야 하지만, 실기기 확인 항목으로 등재 (README 체크리스트 T7).

## 부록. Web Store 배포 시 register-mime.ps1 대체 방안 (Nick 질문, 2026-07-08)

**결론: 완전 대체 불가.** Chrome 확장에는 OS 레지스트리/MIME 설정을 건드릴 API가 없고
(보안상 의도된 제한), MV3의 `declarativeNetRequest` 헤더 재작성도 `file://`에는 적용되지
않는다. 배포 시 현실적 선택지 3가지:

1. **온보딩 안내 (업계 표준)** — `chrome.runtime.onInstalled`에서 설치 직후 안내 페이지를
   열고, 스크립트(.ps1/.reg)를 확장 내 리소스로 제공해 사용자가 1회 실행하게 유도.
   Markdown Viewer 등 기존 확장들도 전부 이 방식("OS에서 MIME 등록하세요" 문서화).
   "파일 URL 액세스 허용" 토글도 같은 페이지에서 안내 (이것도 프로그램 설정 불가).
2. **확장 내장 뷰어 페이지로 우회 (구조적 해결)** — `chrome-extension://…/viewer.html?src=
   file:///…` 형태의 자체 페이지는 파일 액세스 허용 시 `fetch()`로 file://를 직접 읽을 수
   있어 MIME과 무관하게 렌더 가능. 폴더 뷰의 파일 링크를 viewer로 라우팅하면 다운로드 문제가
   진입 경로 차원에서 사라짐. 단, 주소창에 파일 경로 직접 입력하는 경우는 여전히 1번 필요.
   → 배포 결정 시 구현 후보 1순위.
3. **Native messaging host + 인스톨러** — 확실하지만 별도 설치 프로그램 필요. 이 도구의
   규모에는 과함.

참고: `http(s)` raw URL은 이 문제 자체가 없음(서버가 MIME을 보내줌). 순수 `file://` +
Windows 미등록 확장자 조합에서만 발생하는 문제다.
