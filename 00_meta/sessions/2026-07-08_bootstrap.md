# 2026-07-08 — Phase 0~3 일괄 빌드

## 한 것
- **Phase 0 리서치 완료** → `docs/phase0_research.md`. 3개 리스크 전부 해소 + 신규 리스크
  1개 발견·해결(Windows MIME 미등록 → file:// 다운로드 문제, `tools/register-mime.ps1`).
- **확장 전체 빌드** (`app/`): 2단 주입 구조(경량 detect.js → SW가 렌더러 on-demand 주입).
  - Markdown: marked 15 → DOMPurify → mermaid 11 / wavedrom 3.6(JSON5 파싱) / hljs 11,
    front matter details, `:::` 콜아웃(uvm-drill 스타일), 헤딩 앵커, Raw 토글.
  - Code: hljs + 줄번호 거터, 900KB 초과 시 강조 자동 OFF, Raw 토글.
  - registry 패턴: `common/registry.js` SSOT — verilog/vhdl/tcl grammar 추가 번들 포함 15개 언어군.
- 라이브러리 로컬 번들 완료(전역 노출 실검증). 전 JS `node --check` 통과.
- `samples/` 실파일 7종 + 종합 테스트 md 구성 (NVDLA 44KB/400KB/2.1MB, axi_arbiter SV/TB,
  uvm-drill 챕터+manifest, yaml).

## 2차 작업 (같은 날, Nick 요청 1/2/3)
1. **배포 시 MIME 스크립트 대체 방안** 답변 → `docs/phase0_research.md` 부록으로 기록
   (결론: API 없음, 온보딩 안내가 표준 / 내장 뷰어 페이지 우회가 구조적 해결 후보).
2. **폴더 뷰** (`render/dirlist.js` + `styles/dirlist.css`): file:// 디렉토리 리스팅에
   breadcrumb(상위 폴더 점프)·`/` 파일명 필터·항목 카운터·다크모드. 네이티브 리스팅 유지.
3. **Phase 4 완료**: 옵션 팝업(`options/` — action 팝업 겸 옵션 페이지, chrome.storage.sync,
   전체+기능별 on/off, detect.js가 설정 확인 후 발동) + 아이콘 4종(`tools/make-icons.ps1`
   생성, "</>" 글리프). manifest 0.2.0.

## 3차 작업 (같은 날) — 실브라우저 파이프라인 검증
- `tests/harness.html` + `harness.js`: 확장이 주입하는 **동일 번들·동일 파이프라인**을
  일반 페이지로 실행하는 자가 검증 하네스 (localhost 서빙, PASS/FAIL 리포트).
- **결과 16/16 PASS** (Chrome 실행 확인, `tests/harness_result.png`):
  mermaid 2종 SVG + 오류 격리, wavedrom SVG, verilog/sv/systemverilog/python 강조,
  DOMPurify, 콜아웃, front matter.
- **하네스가 잡아낸 실버그 2건 수정:**
  1. hljs에 `systemverilog` alias 없음(공식 alias는 v/sv/svh만) → markdown.js에
     FENCE_ALIAS 맵 추가 (systemverilog→verilog, c++→cpp, yml→yaml 등)
  2. wavedrom 3.x는 **PascalCase `RenderWaveForm`** (camelCase는 2.x) → 호출 수정
- 참고: Claude-in-Chrome은 file:// 탐색 불가 + 이 페이지 스크린샷 불가(document_idle
  대기 이슈) → localhost 서빙 + headless Chrome `--screenshot`으로 우회.

## 남은 검증 (extension 플러밍 — 수동 unpacked 로드 필요)
content script 자동 주입 / SW 메시징·주입 / MIME·file 액세스 / 옵션 storage / 폴더 뷰 DOM.
→ README 체크리스트 T1~T9.

## 5차 작업 (2026-07-09) — v0.3.0 왼쪽 사이드바
- **사이드바** (`render/sidebar.js` + `styles/sidebar.css`): 파일 페이지 좌측 패널.
  - **Files 모드**(file:// 전용): 현재 파일과 같은 폴더 목록 + 상위 폴더. Chrome file://
    디렉토리 리스팅을 `fetch` → `addRow(...)` 파싱(앵커 폴백). 폴더/렌더가능 문서=같은 탭,
    **HTML=새 탭(브라우저 렌더)**, 기타=새 탭. 현재 파일 하이라이트.
  - **Contents 모드**(markdown): h1~h6 TOC + IntersectionObserver 스크롤스파이.
  - md는 Files/Contents 토글, 코드는 Files만, http(s) 코드파일은 사이드바 없음.
  - 접기/펼치기(⟨/☰) + 모드·접힘 상태 chrome.storage.local 저장. 옵션에 `sidebar` on/off 추가.
- **검증**: harness **26/26 PASS**(파이프라인 16 + 사이드바 헬퍼 10). Files/TOC 실렌더는
  headless Chrome `file://` 스크린샷으로 확인 — 실제 Chrome addRow 리스팅 파싱 end-to-end OK.
- **배포**: manifest 0.3.0 → make-zip.ps1 → `dist/render-ext-v0.3.0.zip`(1.06MB).
- 신규 파일: `tests/sidebar_demo.html`(?files 쿼리로 Files 모드 프리뷰). result png는 gitignore.

## 다음 세션
1. README 설치 절차대로 Chrome에 로드 (MIME 스크립트 → unpacked 로드 → file URL 액세스 ON)
2. README 테스트 체크리스트 **T1~T11** 실행 — T10/T11 사이드바 포함
3. 발견 이슈 수정 → Web Store 배포 검토 여부 결정

## 6차 (2026-07-09) — v0.3.1 사이드바 Files 버그픽스
- **증상**: Nick 실사용 시 사이드바 Files가 “폴더 목록을 불러올 수 없습니다” 계속(파일 액세스는
  ON, md·목차는 정상). → Files fetch만 실패.
- **원인**: `fetch()`는 content script(isolated world)에서 `file:` 스킴을 못 읽고 throw.
  headless 데모는 페이지 메인월드+`--allow-file-access-from-files`라 우연히 통과했던 것(실확장과 다름).
- **수정**: `rxFetchText`를 **XMLHttpRequest 우선**(file:// 표준 방식) + fetch 폴백으로 교체.
  실패 시 콘솔에 실제 에러 로그. → 0.3.1 재배포. **Nick: chrome://extensions에서 확장 새로고침(↻) 필요.**

## 7차 (2026-07-09) — v0.3.2 사이드바 Files 진짜 픽스
- v0.3.1(XHR)도 실패. Nick 콘솔: `Access to fetch at 'file:///C:/01_Labs/' from origin 'null'
  blocked by CORS` — **콘텐츠 스크립트는 페이지 origin(file://=null)으로 동작**해서 fetch·XHR
  둘 다 file:// 차단됨(MV3에서 콘텐츠 스크립트가 확장 CORS 특권 상실).
- **정답 = 서비스 워커 경유**: SW는 확장 origin이라 host_permissions(`file:///*`)+파일액세스로
  file:// 읽기 가능(웹검색으로 확인: extension pages/SW는 CORS 우회). sidebar가
  `chrome.runtime.sendMessage({action:'rx-listdir'})` → sw.js가 fetch→text 반환. XHR/fetch는
  데모/harness용 폴백으로만 유지.
- 변경: `app/render/sidebar.js`(rxFetchText→SW 메시지 우선), `app/sw.js`(rx-listdir 핸들러 추가).
  → 0.3.2 재배포. **Nick: 확장 새로고침(↻) 후 재확인.**
- ⚠️ 미검증 리스크: SW의 file:// 디렉토리 fetch 실제 동작은 실확장 로드로만 확인 가능(harness
  범위 밖). 안 되면 콘솔 `[render-ext] directory load failed` + SW 콘솔 로그로 진단.

## 8차 (2026-07-09) — v0.4.0 지속 뷰어 셸 (대규모 리팩터링)
- **문제**: 사이드바에서 폴더 클릭 시 브라우저가 실제 이동→Chrome 기본 디렉토리 화면, 뷰어 소실.
  Nick 요구: 왼쪽 사이드바 항상 유지 / 오른쪽=마지막 성공 파일 / 폴더이동=목록만 갱신 /
  파일선택=in-place 교체 / 실패해도 사이드바 유지+메시지.
- **해결 = 내장 뷰어 컨트롤러(SPA-in-page)**. phase0 부록의 "구조적 해결" 실제 구현.
  - `render/app.js`(신규): 셸(사이드바+`.rx-content`) 소유. openFile/openDir/openInitial/showError.
    사이드바 클릭을 **가로채(preventDefault)** 네비 대신 in-place: 폴더→목록만, 파일→SW로 읽어
    렌더 교체. HTML/비렌더=새 탭. 실패→메시지(사이드바 유지).
  - `render/render-md.js`·`render-code.js`(신규): 마크다운/코드를 **document.body 안 건드리고 노드 반환**하는
    순수 함수로 분리. `rxRenderMarkdown`+`rxRenderDiagrams`(분리 핵심, 아래).
  - `render/sidebar.js`(재작성): `rxCreateSidebar({onOpenFile,onOpenDir})` 콜백형. 순수 헬퍼 유지.
  - `sw.js`(재작성): `rx-fetch`(file:// 읽기 대행) + `rx-render`(앱 번들 주입). detect.js: 파일/폴더
    감지→앱 주입. **삭제**: markdown.js·code.js·dirlist.js·ui.js·dirlist.css(앱으로 흡수).
  - 옵션 `sidebar` 토글 제거(이제 뷰어 핵심). `dirlist`=폴더 열기로 레이블 변경.
- **잡은 버그(자체검증 중)**: 다이어그램을 attach 전 렌더 → mermaid/wavedrom "null getAttribute/childNodes".
  → `rxRenderDiagrams`를 분리해 **app이 contentSet(node) 후 호출**(attach 후 측정). 해결 확인.
- **검증**: harness **26/26 유지**. `tests/app_demo.html`로 셸 4상태 헤드리스 실렌더 확인:
  ?file(mermaid·wavedrom·SV 전부 렌더), ?code(SV+줄번호), 디렉토리(사이드바+빈 뷰어),
  ?err(사이드바 유지+"파일을 찾거나 렌더링하지 못했습니다"+경로+이유). 스크린샷 저장(gitignore).
  ⚠️ 남은 미검증: SW rx-fetch의 file:// 읽기(격리월드↔SW)만 실확장 로드로 최종확인.
- 배포: 0.4.0 zip + release. **Nick: 확장 새로고침(↻) 필수.**

## 9차 (2026-07-09) — v0.4.1 폴더 네비 슬래시 버그
- **증상**(Nick): 사이드바로 폴더 따라가면 `C:/idea/migration`→`C:/ideamigration`,
  `.../idea/x.md`→`.../ideax.md`로 **슬래시가 빠져** "Failed to fetch". 폴더 항목 url에 끝
  슬래시 없을 때 `dir + e.url` 문자열 결합이 깨짐(다음 hop부터 base가 슬래시 잃음).
- **부수 확인**: 에러가 SW의 `String(e)`에서 왔고 첫 목록은 정상 → **SW file:// 읽기는 동작**
  (그간 미검증이던 부분 해소). 유일 버그는 URL 결합.
- **수정**: `rxChildUrl(dir, entry)` — 슬래시로 끝나는 base에 `new URL()`로 resolve, 디렉토리
  결과는 끝 슬래시 보장. showDir는 dir 정규화. fileRow가 이걸 사용.
- **검증**: harness **32/32**(childUrl 6종 추가 — "folder WITHOUT trailing slash gets one"이
  정확히 그 버그). `app_demo.html?nav`로 root→app 폴더 클릭 실네비게이션 스크린샷 →
  `C:/01_Labs/render-ext/app` 슬래시 정상 + 뷰어 유지 확인.
- 배포 0.4.1. **Nick: 확장 새로고침(↻).**

## 10차 (2026-07-25) — 뷰어 확장 3단계 착수
Nick 지시: VCD 제외 전 포맷 추가, hwpx-tool 통합, 3단계로 나눠 순차 진행.
계획: **P1 v0.5.0** 미디어/데이터(무의존) → **P2 v0.6.0** HWPX·docx·xlsx·ipynb →
**P3 v0.7.0** graphviz·drawio·단독 다이어그램·PlantUML(옵트인).
사전 조사: hwpx-tool(`C:\01_Labs\hwpx-tool`)은 **제로 의존성 바닐라 ESM**
(`src/{zip,xml,xml-tree,header,render,hwpx}.js` + `BASE_CSS`) → web_accessible_resources +
동적 `import()`로 원본 그대로 벤더링 가능(빌드 불필요, 업스트림 재동기화 쉬움). P2에서 사용.

### v0.5.0 (P1) — 이미지·SVG·PDF·CSV·ANSI 로그
- `common/registry.js` 재구성: `viewers{image,svg,pdf,table,log}` + `RX_MIME`. rxLookupExt이
  `{kind,label,binary,icon,mime}` 반환 → 사이드바 아이콘도 종류별.
- **바이너리 경로 신설**: SW `rx-fetch-bin`(fetch→arrayBuffer→chunked btoa→base64) +
  `rxFetchBinary`/`rxB64ToBytes`. data: URL로 넘겨 **file:// 서브리소스 제약을 원천 회피**
  (P2의 zip 컨테이너도 이 경로 재사용).
- `render/render-media.js` 신규: rxRenderImage(클릭 1:1 토글·치수) / rxRenderSvg(DOMPurify svg
  프로필) / rxRenderPdf(embed) / rxRenderTable(RFC4180 파서+구분자 자동감지, 헤더 sticky) /
  rxRenderLog(ANSI SGR→span, 16색+bold/dim/italic/underline, 2MB 상한).
- app.js render() 디스패치를 kind 기반으로 일반화. 텍스트 계열만 Raw 토글 노출.
- detect.js: **이미지 직접 열기**(contentType image/* + 단일 IMG)도 인수 → 사이드바 확보.
  SVG/PDF 직접 열기는 Chrome 기본 뷰어에 양보(사이드바에서 클릭하면 인라인).
- 검증: harness **52/52**(신규 20 — registry 6·CSV 7·ANSI 7). 실렌더 스크린샷 4종
  (csv/log/svg/png) 전부 정상. 샘플 추가: coverage.csv·sim.log·dataflow.svg·datapath.png.

### v0.6.0 (P2) — HWPX·docx·xlsx·pptx·ipynb
- **hwpx-tool 통합**: `src/{zip,xml,xml-tree,extract,header,render,hwpx}.js`를 `app/libs/hwpx/`에
  **원본 그대로 벤더링**(`VENDOR.md`에 출처 커밋·재동기화 명령·"여기서 고치지 말 것" 명시).
  manifest `web_accessible_resources`에 등록 → `render-doc.js`가 동적 `import()`로 로드.
  BinData 이미지는 blob 대신 **data: URL**(file:// 페이지에서 blob은 opaque origin).
- 신규 `render/render-doc.js`: rxRenderHwpx / rxRenderDocx(mammoth, 이미지 base64) /
  rxRenderXlsx(SheetJS, 시트 탭) / rxRenderPptx(**hwpx zip.js 재사용** — 슬라이드 텍스트만) /
  rxRenderNotebook(마크다운 셀은 rxRenderMarkdown 재사용, 출력 텍스트/이미지/HTML표/**ANSI traceback**).
  ipynb 목차는 마크다운 셀 헤딩을 모아 id 중복 제거 후 사이드바 Contents로.
- **잡은 버그 3건(자체검증)**:
  1. `import()`가 **문서가 아니라 스크립트 URL 기준**으로 해석 → `app/app/...` 중복.
     `rxLibUrl`을 절대 URL(`new URL('../'+rel, document.currentScript.src)`)로 수정.
  2. 샘플 생성기: `ZipFile::CreateFromDirectory`가 항목명을 **역슬래시**로 기록 → OOXML 리더가
     거부("could not find main document part"). ZipArchive로 항목별 생성 + `/` 정규화.
  3. `.rx-nb-md .rx-md-root` 자손 셀렉터 오류(그 요소 자신) → `min-height:100vh`가 남아 셀 사이
     100vh 공백. `.rx-md-root.rx-nb-md`로 수정.
  (부수: ps1을 UTF-8 BOM으로 저장해야 PS5.1이 한글 파싱 — 샘플 한글 깨짐 해결.
   ipynb 샘플의 raw ESC는 JSON 규격 위반이라 `` 이스케이프로 수정.)
- 검증: harness **67/67**(신규 15 — 문서 registry/라이브러리/노트북 7·HWPX 3 등). 실렌더
  스크린샷 5종 전부 정상(HWPX 표·병합셀·서식, docx 한글·표, xlsx 시트탭, pptx 슬라이드, ipynb 전체).
- ⚠️ ES 모듈은 file://에서 CORS로 못 읽어 **harness는 localhost 서빙으로 실행**(확장은
  chrome-extension:// origin이라 무관). `tests/app_demo.html`은 file/http 양쪽 지원하도록 base 계산.
- 신규 샘플: sample.hwpx(hwpx-tool 합성본) · design_note.docx · metrics.xlsx · review_deck.pptx ·
  analysis.ipynb + 생성기 `tools/make-office-samples.ps1`.

### v0.7.0 (P3) — 단독 다이어그램 (graphviz·mermaid·wavedrom·drawio·plantuml)
- `render/render-diagram.js` 신규. registry에 dot/gv·mmd·wd·drawio·puml 추가.
- **Graphviz**: `@viz-js/viz` standalone(WASM 인라인, 외부 fetch 없음). **서비스 워커에서 실행** —
  MV3에서 WASM은 extension_pages CSP(`'wasm-unsafe-eval'`, manifest에 선언)가 필요한데 콘텐츠
  스크립트의 WASM 취급은 불명확 → SW가 dot→SVG 문자열로 변환해 반환(page는 DOM만 다룸).
- **draw.io**: mxfile 디코드(base64+**raw deflate**+URL인코딩, pako) → mxGraphModel 파싱 →
  자체 SVG 렌더(rect/ellipse/rhombus, fill/stroke/rounded, 엣지 waypoint·dashed·라벨,
  박스 경계 클리핑 화살표). 완전 재현 아님(단순 렌더 명시).
  - 잡은 버그: 바운딩 박스를 노드만으로 계산 → waypoint 우회 엣지가 캔버스 밖으로 잘림. pts 포함으로 수정.
- **mermaid/wavedrom 단독 파일**: 기존 rxRenderDiagrams 재사용(attach 후 렌더).
- **PlantUML**: 로컬 엔진 부재(Java 필요) → **기본 소스만 표시**. 옵션 `plantuml`(기본 false)를
  켠 뒤 **다이어그램마다 버튼 클릭**해야 서버 전송. 서버 URL을 화면에 명시. 인코더는 PlantUML
  전용 base64 알파벳 + deflateRaw 자체 구현.
- 검증: harness **78/78**(신규 11). 실렌더 5종 스크린샷 정상(NVDLA dot 파이프라인, drawio NPU
  블록도, AXI wavedrom, mermaid 플로우, PlantUML 옵트인 게이트).
- 신규 샘플: pipeline.dot · flow.mmd · handshake.wd · arch.drawio · sequence.puml.

## 아이디어 백로그 (Nick 제시 요청, 2026-07-09)
- 디렉토리 페이지(dirlist)에도 동일 사이드바 부착해 파일↔폴더 UX 일관화
- 코드 뷰: 라인 클릭 시 `#L42` 앵커/하이라이트, 코드블록 복사 버튼
- Markdown: 상대 링크(`./other.md`) 클릭 시 확장이 이어서 렌더(현재 브라우저 기본 동작)
- mermaid/wavedrom 다이어그램 클릭 확대(zoom)·SVG 저장
- 파일 상단 메타(경로/크기/수정일) 바, 최근 연 파일 목록(팝업)

## 4차 작업 (같은 날) — git/배포 체계
- **git 정리 완료**: init → 첫 커밋 → GitHub **private** repo `jwj-nick/render-ext` 생성+push
  (CLAUDE.md §7 private-first). `.gitignore`는 `dist/`만 제외.
- **zip 배포 체계**: `tools/make-zip.ps1` — `app/` + `INSTALL.md` + `setup/register-mime.ps1`을
  `dist/render-ext-v<ver>.zip`으로 패키징 (버전은 manifest에서 자동). 빌드 없음.
- **Release v0.2.0** 발행 + zip 첨부: https://github.com/jwj-nick/render-ext/releases/tag/v0.2.0
- **INSTALL.md 신설(SSOT)**: zip/clone 두 경로 기준 4단계 설치 + 사용법 + 문제해결 표.
  README 설치 섹션은 INSTALL.md 요약으로 교체.
- 버전 올릴 때 절차: manifest version 수정 → make-zip.ps1 → git tag vX.Y.Z →
  `gh release create vX.Y.Z dist/render-ext-vX.Y.Z.zip`
