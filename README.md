# render-ext

raw 파일(Markdown·Verilog/SV·Python·JSON·YAML·C/C++ …)을 Chrome에서 보기 좋게 렌더하는
**읽기 전용** 확장. Markdown 안의 **mermaid·wavedrom 다이어그램 렌더**가 최우선 기능.
에디터 아님 — 수정/저장 기능 없음(설계 원칙).

전 라이브러리 로컬 번들(MV3, CDN 없음). 상세 배경: `CLAUDE.md`, 리서치: `docs/phase0_research.md`.

## 설치

**→ [INSTALL.md](INSTALL.md)** (설치 가이드 SSOT — zip에도 동봉됨). 요약:

| | 받는 법 | 로드할 폴더 |
|---|---|---|
| **A. zip (권장)** | [Releases](https://github.com/jwj-nick/render-ext/releases)에서 `render-ext-vX.Y.Z.zip` → 압축 해제 | 압축 푼 `render-ext/` |
| **B. git clone** | `git clone https://github.com/jwj-nick/render-ext` | repo의 **`app/`** |

공통 4단계: ① MIME 등록 스크립트 1회 실행(zip: `setup/register-mime.ps1`, clone:
`tools/register-mime.ps1`) + Chrome 재시작 → ② `chrome://extensions` 개발자 모드 →
압축해제된 확장 프로그램 로드 → ③ 세부정보에서 **"파일 URL 액세스 허용" ON** →
④ `.md`/`.sv` 파일 드래그로 확인.

릴리스 zip 재생성: `tools/make-zip.ps1` → `dist/` (빌드 없음 — app/ 그대로 패키징).

## 사용

- 대상 파일을 Chrome에서 열면(주소창에 경로 입력 or 드래그) 자동 렌더.
- 우상단 토글 pill: **Raw ↔ Rendered** 전환, 파일 타입/줄 수 표시.
- **폴더 뷰** (`file://` 디렉토리): 상단 breadcrumb으로 임의 상위 폴더 점프,
  `/` 키로 파일명 필터, 항목 수 표시.
- 툴바 아이콘 클릭 = 설정 팝업: 전체 on/off + 기능별(Markdown/코드/폴더 뷰) on/off.
  변경은 새로 여는 탭부터 적용.
- 다크/라이트: OS 설정 자동 추종.

## 테스트 체크리스트 (`samples/`, 전부 실파일)

| # | 파일 | 확인 사항 |
|---|---|---|
| T1 | `feature_test.md` | front matter 접힘·`:::` 콜아웃·mermaid 2종·**의도된 mermaid 오류 1종**(에러 박스)·wavedrom·SV/Python 강조·```check 뱃지·표·상대 링크 |
| T2 | `uvm_class-hierarchy.md` | 실전 uvm-drill 챕터 (mermaid 포함) |
| T3 | `axi_arbiter.sv` / `axi_arbiter_tb.sv` | SystemVerilog 문법강조 + 줄번호 |
| T4 | `NV_NVDLA_cmac.v` (44KB) / `NV_NVDLA_CMAC_CORE_mac.v` (400KB) | 실전 NVDLA RTL 강조 |
| T5 | `perf_test_2MB.v` (2.1MB) | 대용량 → 강조 자동 OFF("large file" 표시) + 줄번호는 유지 |
| T6 | `uvm_manifest.json` / `sample.yaml` | JSON·YAML 강조 |
| T7 | 아무 GitHub raw URL (예: uvm-drill repo의 .md raw) | http(s) raw에서도 렌더 (CSP sandbox 환경) |
| T8 | `file:///C:/01_Labs/render-ext/samples/` 폴더 열기 | breadcrumb 상위 이동 · `/` 필터 · 다크모드 |
| T9 | 툴바 아이콘 팝업에서 기능 off → 새 탭 | off한 기능이 발동 안 함, 다시 on → 복구 |

## 구조

```
app/                    ← Chrome에 로드하는 디렉토리
├── manifest.json        MV3
├── common/registry.js   언어 registry (SSOT) — 언어 추가는 여기 한 곳
├── content/detect.js    경량 감지기 (모든 페이지, ~7KB) — storage 설정 확인 후 발동
├── sw.js                service worker — 감지 시에만 무거운 렌더러 주입
├── render/              markdown.js / code.js / dirlist.js(폴더 뷰) / ui.js(토글 툴바)
├── styles/              base.css / dirlist.css / hljs-theme.css(라이트+다크 결합)
├── options/             설정 팝업 겸 옵션 페이지 (chrome.storage.sync)
├── icons/               16/32/48/128 PNG (tools/make-icons.ps1로 생성)
└── libs/                marked·DOMPurify·mermaid·wavedrom·hljs·JSON5 (전부 로컬)
INSTALL.md               설치 가이드 SSOT (zip에 동봉)
tools/register-mime.ps1  Windows MIME 등록 (1회)
tools/make-icons.ps1     아이콘 재생성
tools/make-zip.ps1       릴리스 zip 빌드 → dist/
tests/harness.html       라이브러리/파이프라인 자가 검증 (16항목)
samples/                 실파일 테스트 세트
docs/phase0_research.md  Phase 0 리서치 결론
```

## 언어 추가 방법

`app/common/registry.js`의 `languages`에 항목 추가. hljs common 번들에 없는 문법이면
grammar 파일을 `app/libs/`에 받고 `extraLibs`에 경로 기입 → `sw.js`가 whitelist를
registry에서 자동 생성하므로 다른 수정 불필요.

## 상태

- Phase 0 ✅ 리서치 / Phase 1 ✅ Markdown(mermaid+wavedrom) / Phase 2 ✅ Verilog/SV
- Phase 3 ✅ Python·JSON·YAML·C/C++ + α (JS/TS/Tcl/VHDL/shell/diff…)
- Phase 4 ✅ 다크모드 자동·on/off 옵션 팝업·아이콘 / +α ✅ 폴더 뷰(breadcrumb·필터)
- 남은 것: Web Store 배포 검토 (배포 시 MIME 스크립트 대체 방안은 `docs/phase0_research.md` 부록)
- **렌더 파이프라인 검증 완료** (2026-07-08): `tests/harness.html` — 확장과 동일 번들·동일
  파이프라인을 실Chrome에서 실행, **16/16 PASS** (`tests/harness_result.png`).
  mermaid·wavedrom·verilog(sv/systemverilog)·python·DOMPurify·콜아웃 실렌더 확인.
- **미검증 (수동 로드 필요):** 확장 플러밍 — content script 자동 주입, SW 주입, MIME/file
  액세스, 옵션 storage, 폴더 뷰. → 위 체크리스트 T1~T9.
