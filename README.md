# Hermann Planner

TickTick 유료 캘린더 위젯을 대체하기 위한 개인용 Windows 데스크탑 위젯입니다.
Google Calendar와 Google Tasks를 하나의 항상-위(always-on-top) 미니 창에서 함께 보여줍니다.

## 주요 특징

- 항상 위(always-on-top), 배경 반투명, 크기 조절 가능한 프레임리스 위젯
- 시스템 트레이 아이콘으로 최소화/복원
- Google Calendar 일정 조회 (여러 캘린더 통합, 향후 14일)
- Google Tasks 목록 조회 및 체크박스로 완료 처리
- OAuth2 로그인 (로컬 루프백 리다이렉트 방식, 시스템 기본 브라우저 사용)

## 폴더 구조

```
src/
  main/        Electron 메인 프로세스 (창 생성, 트레이, IPC)
  renderer/    렌더러 UI (HTML/CSS/JS)
  auth/        Google OAuth 및 Calendar/Tasks API 연동
assets/        아이콘 리소스
```

## 사전 준비: Google Cloud OAuth 클라이언트 설정

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트를 만들고 **Google Calendar API**, **Google Tasks API**를 활성화합니다.
2. "OAuth 동의 화면"을 구성합니다 (테스트 사용자로 본인 계정을 추가하면 됩니다).
3. "사용자 인증 정보" > "OAuth 클라이언트 ID 만들기" > 애플리케이션 유형은 **데스크톱 앱**을 선택합니다.
4. 생성된 클라이언트의 JSON을 다운로드하여 `credentials.json`으로 저장합니다.
5. 이 파일을 아래 위치 중 한 곳에 둡니다:
   - 개발 중: 프로젝트 루트(`hermann-planner/credentials.json`)
   - 패키징된 앱: `%APPDATA%/hermann-planner/credentials.json`

`credentials.json`과 로그인 후 생성되는 `token.json`은 `.gitignore`에 포함되어 있어 Git에 커밋되지 않습니다.

## 실행 방법

```bash
npm install
npm start
```

## exe 패키징

```bash
npm run build:win
```

`electron-builder` 설정은 `package.json`의 `build` 필드에 있으며, 결과물은 `dist/` 폴더에 생성됩니다.

## 현재 구현 범위 (1단계 골격)

- [x] 투명/always-on-top 위젯 창 + 트레이
- [x] Google OAuth2 로그인/로그아웃
- [x] 캘린더 일정 조회 (읽기 전용)
- [x] 할일 조회 및 완료 체크
- [ ] 월간/주간 뷰 전환, 일정 상세/수정, 스타일 다듬기 (다음 단계)
