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
