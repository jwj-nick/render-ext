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

- 대상 파일/폴더를 Chrome에서 열면(주소창에 경로 입력 or 드래그) **뷰어 셸**로 전환.
- **지속 셸 구조** (v0.4.0): 왼쪽 사이드바는 항상 유지, 오른쪽은 **마지막으로 성공한 파일**을 표시.
  - 사이드바 **Files**: 같은 폴더 목록 + 상위 폴더. **폴더 클릭 = 목록만 갱신**(뷰어 유지),
    **파일 클릭 = 그 자리에서 렌더**(페이지 이동 없음). HTML은 새 탭(브라우저 렌더).
  - 사이드바 **Contents**: Markdown 목차 + 스크롤 연동. Markdown이면 Files/Contents 토글, 그 외 Files만.
  - 폴더를 열었는데 아직 연 파일이 없으면 오른쪽은 비어 있음. 없는 파일/렌더 실패 시 사이드바는
    유지되고 오른쪽에 실패 메시지 표시.
- 우상단 pill: **Raw ↔ Rendered** 전환, 파일 타입/줄 수. (이미지·PDF는 원문이 없어 숨김)

### 지원 포맷

| 종류 | 확장자 | 렌더 |
|---|---|---|
| Markdown | `.md` 외 | mermaid·wavedrom·`:::`콜아웃·front matter·목차 |
| 코드 | `.v .sv .vhd .tcl .py .json .yaml .c .cpp .ts .sh .diff` 외 | 문법강조 + 줄번호 |
| **이미지** | `.png .jpg .gif .webp .bmp .ico .avif` | 인라인(클릭 시 원본 크기), 치수 표시 |
| **SVG** | `.svg` | 인라인 렌더(DOMPurify 정화) + Raw 소스 |
| **PDF** | `.pdf` | Chrome PDF 뷰어 내장 |
| **표** | `.csv .tsv` | 표 렌더(헤더 고정·행번호·구분자 자동감지) |
| **로그** | `.log .txt .out .rpt .err` | ANSI 컬러 해석 |
| **HWPX** | `.hwpx` | 한/글 문서 — 서식·표·이미지 ([hwpx-tool](https://jwj-nick.github.io/hwpx/) 엔진 통합). 구형 `.hwp`는 안내 메시지 |
| **Word** | `.docx` | 제목·서식·목록·표·이미지 (mammoth) |
| **Excel** | `.xlsx .xlsm .xls` | 시트 탭 + 표 (SheetJS) |
| **PowerPoint** | `.pptx` | 슬라이드별 텍스트 (레이아웃 미지원) |
| **Jupyter** | `.ipynb` | 마크다운(mermaid 포함)·코드 강조·출력(텍스트/이미지/HTML표)·ANSI traceback |
| HTML | `.html` | 확장 비관여 — 새 탭에서 브라우저가 렌더 |
- 툴바 아이콘 클릭 = 설정 팝업: 전체 on/off + 기능별(Markdown/코드/폴더 열기) on/off.
  변경은 새로 여는 탭부터 적용.
- 다크/라이트: OS 설정 자동 추종.

## 테스트 체크리스트 (`samples/`, 전부 실파일)

| # | 시나리오 | 확인 사항 |
|---|---|---|
| T1 | `feature_test.md` 열기 | front matter 접힘·`:::` 콜아웃·mermaid 2종·**의도된 mermaid 오류 1종**(에러 박스)·wavedrom·SV/Python 강조·```check 뱃지·표 |
| T2 | `axi_arbiter.sv` 열기 | SystemVerilog 강조 + 줄번호 (사이드바 Files만) |
| T3 | `perf_test_2MB.v` (2.1MB) | 대용량 → 강조 자동 OFF("large file") + 줄번호 유지 |
| T4 | `NV_NVDLA_cmac.v` / `uvm_manifest.json` / `sample.yaml` | NVDLA RTL·JSON·YAML 강조 |
| T5 | **폴더 열기** `file:///C:/01_Labs/render-ext/samples/` | 사이드바에 목록, 오른쪽 "파일을 선택하세요" |
| T6 | ★ **사이드바에서 폴더 클릭** (상위 폴더/하위 폴더) | 왼쪽 목록만 갱신, **오른쪽 뷰어 그대로 유지**(페이지 이동 X) |
| T7 | ★ **사이드바에서 다른 파일 클릭** | 오른쪽이 그 파일로 교체, 현재 파일 하이라이트 이동 |
| T8 | `feature_test.md`에서 Contents 탭 | 목차 클릭 시 스크롤, 스크롤 시 활성 항목 이동 |
| T9 | 사이드바에서 `.html` 클릭 | 새 탭에서 브라우저가 렌더 (뷰어는 그대로) |
| T10 | 없는 파일/깨진 경로로 이동 | 사이드바 유지 + 오른쪽 "파일을 찾거나 렌더링하지 못했습니다" |
| T11 | 아무 GitHub raw `.md` URL | http(s) raw에서도 렌더 (Files 없이 Contents만) |
| T12 | 툴바 아이콘 팝업 기능 off → 새 탭 | off한 기능 발동 안 함, 다시 on → 복구 |

## 구조

```
app/                    ← Chrome에 로드하는 디렉토리
├── manifest.json        MV3
├── common/registry.js   언어 registry (SSOT) — 언어 추가는 여기 한 곳
├── content/detect.js    경량 감지기 (모든 페이지) — 파일/폴더 감지 → SW에 앱 주입 요청
├── sw.js                service worker — 앱 번들 주입 + rx-fetch(file:// 읽기 대행)
├── render/
│   ├── app.js            뷰어 셸 컨트롤러 (사이드바+콘텐츠, 파일/폴더 열기, 에러)
│   ├── sidebar.js        사이드바 (Files 네비게이터 + Contents 목차) + 디렉토리 파싱 헬퍼
│   ├── render-md.js      rxRenderMarkdown / rxRenderDiagrams (마크다운→노드, mermaid·wavedrom)
│   ├── render-code.js    rxRenderCode (코드→노드, hljs+줄번호)
│   ├── render-media.js   이미지·SVG·PDF·CSV표·ANSI로그 (+ CSV/ANSI 파서)
│   └── render-doc.js     HWPX·docx·xlsx·pptx·ipynb
├── libs/hwpx/           hwpx-tool 벤더링 (VENDOR.md 참조 — 원본 그대로, 재동기화 가능)
├── styles/              base.css / sidebar.css / hljs-theme.css(라이트+다크 결합)
├── options/             설정 팝업 겸 옵션 페이지 (chrome.storage.sync)
├── icons/               16/32/48/128 PNG (tools/make-icons.ps1로 생성)
└── libs/                marked·DOMPurify·mermaid·wavedrom·hljs·JSON5 (전부 로컬)
INSTALL.md               설치 가이드 SSOT (zip에 동봉)
tools/register-mime.ps1  Windows MIME 등록 (1회)
tools/make-icons.ps1     아이콘 재생성
tools/make-zip.ps1       릴리스 zip 빌드 → dist/
tests/harness.html       라이브러리/파이프라인 자가 검증 (26항목)
tests/app_demo.html      뷰어 셸 자가 검증 (?file/?code/?err/디렉토리)
samples/                 실파일 테스트 세트
docs/phase0_research.md  Phase 0 리서치 결론
```

## 언어 추가 방법

`app/common/registry.js`의 `languages`에 항목 추가. hljs common 번들에 없는 문법이면
grammar 파일을 `app/libs/`에 받고 `extraLibs`에 경로 기입 후 `sw.js`의 `APP_JS`에 추가.

## 상태

- Phase 0~3 ✅ 리서치 + Markdown(mermaid+wavedrom) + Verilog/SV + Python·JSON·YAML·C/C++ +α
- Phase 4 ✅ 다크모드·옵션 팝업·아이콘
- **v0.4.0 ✅ 지속 뷰어 셸**: 왼쪽 사이드바 고정 + 오른쪽 in-place 렌더. 폴더 이동해도 뷰어
  유지, 파일 선택 시 그 자리에서 교체, 실패 시 사이드바 유지+메시지. (아키텍처=내장 뷰어
  컨트롤러 `render/app.js` — SW가 file:// 읽기 대행, 클릭 가로채 네비게이션 대신 in-place 갱신)
- 남은 것: Web Store 배포 검토 (MIME 스크립트 대체 방안은 `docs/phase0_research.md` 부록)
- **검증 완료** (실Chrome): `tests/harness.html` **26/26 PASS**(파이프라인 16 + 사이드바 헬퍼 10);
  `tests/app_demo.html` 헤드리스로 셸 4상태 실렌더 확인 — Markdown(mermaid·wavedrom·hljs),
  코드(SV 강조+줄번호), 디렉토리(사이드바+빈 뷰어), 에러(사이드바 유지+실패 메시지).
- **미검증 (수동 로드 필요):** SW rx-fetch의 file:// 읽기(격리월드↔SW 메시징)는 실확장 로드로만
  최종 확인. 안 되면 페이지 콘솔 `[render-ext]` + SW 콘솔 로그로 진단. → 체크리스트 T1~T11.
