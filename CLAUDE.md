# render-ext — 코드/문서 렌더링 Chrome Extension (부트스트랩)

> 부트 포인터. 이 문서 하나로 자기완결 (별도 `C:\idea\migration\` 가이드 없음 — 도구 프로젝트).

## 새 세션 시작 ★
이 워크스페이스(`C:\01_Labs\render-ext`)에서 Claude 실행. 순서:
1. 이 CLAUDE.md 정독
2. **Phase 0 리서치(§3)부터** — 기술 리스크가 커서 빌드 전에 반드시 검증
3. 실 샘플로 검증 (§5 경로)

## 1. 문제 정의
Chrome에서 raw 파일(`.md` `.v` `.sv` `.py` `.json` `.yaml` `.c` `.cpp` 등)을 열면 문법강조 없는 plain text로만 보임. 특히 Markdown 안의 mermaid·wavedrom 다이어그램은 코드 블록 그대로 노출되고 렌더되지 않음. 목표: 이런 raw 파일을 보기 좋게 렌더하는 Chrome extension.

## 2. 스코프
- **렌더 대상:** Markdown(**mermaid + wavedrom 다이어그램 렌더 포함 — 최우선**) · Verilog/SystemVerilog · Python · JSON · YAML · C/C++ · 확장 가능한 기타 언어(언어별 registry 패턴 권장 — 나중에 추가 쉽게)
- **❌ Out of scope: 에디터 기능 없음.** 읽기 전용 렌더/뷰어만. 수정·저장 기능은 넣지 말 것.

## 3. ★ Phase 0 필수 리서치 (기술 리스크 — 빌드 전에 먼저 검증)
- Chrome이 raw 텍스트/코드 파일(`file://` 로컬, `http(s)` raw URL 등)을 열 때 **content script 주입이 실제로 되는지** 확인 — Chrome이 일부 MIME(`text/plain` 등)에 대해 확장 프로그램 실행을 제한하는 경우가 있음.
- **Manifest V3 CSP 제약** — extension 안에서 mermaid.js/wavedrom.js/highlight.js를 **CDN으로 로드하는 건 보통 막힘** → 로컬 번들 필요. (Nick의 기존 "무빌드+CDN" 패턴과 다름 — extension이라 예외.)
- GitHub/GitLab 등은 이미 자체적으로 mermaid를 렌더함(raw 뷰는 제외) — 진짜 필요한 케이스는 **raw 파일 보기 / 로컬 file:// / mermaid 미지원 사이트** 위주로 좁혀서 검증할 것.

## 4. 단계
| Phase | 목표 |
|---|---|
| 0 | 리서치(§3) — content script 주입 가능 범위 확정, CSP 하 라이브러리 번들 방법 확정 |
| 1 proof | **Markdown 렌더러** (marked.js + mermaid + wavedrom 코드블록 렌더) — 임팩트 최대, Nick 기존 스택(uvm-drill 등)과 직결 |
| 2 | **Verilog/SystemVerilog 문법강조** (Nick 핵심 니즈 — highlight.js가 verilog 지원하는지 확인, 부족하면 커스텀 문법 정의) |
| 3 | Python/JSON/YAML/C·C++ 확장 — 언어 registry 패턴으로 추가 쉽게 |
| 4 (선택) | 다크/라이트 토글, on/off 설정, Chrome Web Store 배포 검토 |

## 5. 실 테스트 샘플 (진짜 파일로 검증)
- Verilog: `C:\Nick\10_Study\30_HW_Study\nvdla_analysis\nvdla-hw\vmod\nvdla\` (NVDLA RTL 다수, 450+ 파일)
- SystemVerilog: `C:\Nick\90_Archive\CodePractice\trial_anti_gravitiy_2511\src\rtl\axi_arbiter.sv` + `src\tb\axi_arbiter_tb.sv`
- Markdown + mermaid (이미 쓰는 실사례): `C:\Nick\30_Apps\uvm-drill\content\` 챕터들
- JSON/YAML: 아무 hub의 `content\manifest.json` 등 (예: `C:\01_Labs\*\content\manifest.json`)
- WaveDrom: 실사례 없음(Nick 생태계에 아직 미도입) — 공식 예제 JSON으로 시작

## 6. 기술 스택 후보 (세션에서 확정)
- Markdown = marked.js · Mermaid = mermaid.js · WaveDrom = wavedrom.js · 문법강조 = highlight.js 또는 Prism.js — 전부 Nick 기존 앱에서 이미 검증된 라이브러리. **단 extension이라 로컬 번들 필요** (§3)
- **Manifest V3 필수** (V2 지원 종료 임박)

## 7. ★ 특별 주의
- 에디터 아님(§2) — 렌더 전용, 수정 기능 절대 추가 금지
- Manifest V3 준수
- 범용 개발자 도구 — 다른 엔지니어도 원할 만한 수요라 공개 후보. 단 **초기엔 private**, 나중 선별 공개 검토

## 8. 상태
빈 골격 — 계획 착수 전. **Phase 0 리서치부터 시작.**

## 규칙 (요약)
- private-first, 이건 빌드 세션(계획 재토론 아님)
- 막히면 Nick에게 짧은 결정 질문
