# render-ext 설치 가이드

Chrome에서 raw 파일(`.md` `.sv` `.v` `.py` `.json` `.yaml` …)을 열면 문법강조·다이어그램
(mermaid/wavedrom)과 함께 렌더해주는 **읽기 전용** 확장. 빌드 불필요 — 받아서 바로 로드.

## 설치 (3분)

### 0. 확장 폴더 준비 — 둘 중 하나

- **A. zip (권장):** GitHub Releases에서 `render-ext-vX.Y.Z.zip` 다운로드 → 원하는 위치에
  압축 해제. 안에 `render-ext/` 폴더가 나옴.
- **B. git clone:** `git clone https://github.com/jwj-nick/render-ext` → 확장 폴더는
  repo 안의 **`app/`**.

> ⚠️ 이 폴더가 곧 설치본입니다. **로드 후 폴더를 이동/삭제하면 확장이 죽습니다.**
> 지우지 않을 위치(예: `C:\tools\render-ext`)에 두세요.

### 1. Windows MIME 등록 (Windows 필수, 1회)

PowerShell에서:

```powershell
# zip 사용자 (render-ext 폴더 안에서)
powershell -ExecutionPolicy Bypass -File .\setup\register-mime.ps1

# clone 사용자 (repo 루트에서)
powershell -ExecutionPolicy Bypass -File .\tools\register-mime.ps1
```

- **왜:** Windows에 MIME 등록이 없는 확장자(`.sv` `.v`, 경우에 따라 `.md`)는 Chrome이
  `file://`로 열 때 렌더 대신 **다운로드**해버립니다.
- 사용자 레지스트리(HKCU)에 `Content Type=text/plain`만 기록 — **관리자 불필요**,
  더블클릭 파일 연결은 건드리지 않음, 이미 값이 있는 확장자는 건너뜀.
- 실행 후 **Chrome 완전 재시작** 필요.

### 2. Chrome에 로드

1. 주소창에 `chrome://extensions` 입력
2. 우상단 **개발자 모드** 토글 ON
3. **압축해제된 확장 프로그램을 로드합니다** 클릭
4. 폴더 선택 — zip: 압축 푼 `render-ext` 폴더 / clone: `app` 폴더
   (`manifest.json`이 바로 안에 있는 폴더)

### 3. 파일 URL 액세스 허용 (file:// 필수)

`chrome://extensions` → render-ext 카드의 **세부정보** →
**"파일 URL에 대한 액세스 허용"** 토글 ON.
(이걸 안 켜면 로컬 파일에서 아무 일도 안 일어납니다 — 가장 흔한 실수)

### 4. 동작 확인

아무 `.md`나 `.sv` 파일을 Chrome 창에 드래그하거나 주소창에 경로 입력.
렌더된 화면 우상단에 **Raw/Rendered 토글 pill**이 보이면 성공.

## 사용법

| 기능 | 방법 |
|---|---|
| **왼쪽 사이드바** | 파일 열면 좌측에 **Files**(같은 폴더 목록·상위 폴더 이동)와, Markdown이면 **Contents**(목차) 탭. 상단 `⟨`로 접기 |
| 사이드바에서 이동 | 폴더/렌더 가능한 문서 클릭 → 같은 탭에서 렌더 · **HTML 클릭 → 새 탭에서 브라우저 렌더** · 기타 파일 → 새 탭 |
| 렌더 ↔ 원문 전환 | 우상단 pill의 **Raw** 버튼 |
| 폴더 페이지 탐색 | `file://` 폴더 열면 breadcrumb(상위 폴더 점프) + `/` 키 파일명 필터 |
| 기능 on/off | 툴바의 render-ext 아이콘 클릭 → 전체/Markdown/코드/사이드바/폴더 뷰 개별 토글 |
| 다크모드 | OS 설정 자동 추종 |

지원: Markdown(mermaid·wavedrom·`:::콜아웃`·front matter) / Verilog·SystemVerilog /
VHDL / Tcl·SDC·XDC / Python / JSON / YAML / C·C++ / JS·TS / shell / diff 등.

## 업데이트

새 zip을 받아 **같은 위치에 덮어쓰기** → `chrome://extensions`에서 render-ext 카드의
**새로고침(↻)** 클릭. (clone 사용자는 `git pull` 후 새로고침)

## 문제 해결

| 증상 | 원인/해결 |
|---|---|
| 파일이 렌더 안 되고 **다운로드**됨 | 1단계 MIME 등록 안 함 or Chrome 재시작 안 함 |
| 로컬 파일에서 아무 반응 없음 | 3단계 "파일 URL 액세스" OFF 상태 |
| 특정 기능만 안 됨 | 툴바 아이콘 팝업에서 해당 기능이 OFF인지 확인 |
| 대용량 파일에서 강조 없음 | 정상 — 900KB 초과 시 성능 위해 강조만 자동 OFF (줄번호는 유지) |
| GitHub 렌더 뷰에서 동작 안 함 | 의도된 동작 — raw 뷰(`raw.githubusercontent.com` 등)에서만 발동 |

문제가 계속되면 F12 콘솔에서 `[render-ext]` 로그를 확인해 이슈로 알려주세요.
