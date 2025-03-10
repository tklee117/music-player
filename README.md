# Cute Music Player

Flask 기반의 음악 플레이어 웹 애플리케이션입니다. YouTube 영상을 추가하여 개인 음악 재생 목록을 만들고 관리할 수 있습니다.

## 기능

- YouTube URL을 통한 음악 추가
- 음악 재생, 일시정지, 다음 곡, 이전 곡 기능
- 재생 목록 관리 (추가, 삭제, 셔플)
- 진행 바를 통한 재생 위치 조절
- 반응형 디자인으로 모바일 환경 지원

## 기술 스택

- **백엔드**: Flask (Python)
- **프론트엔드**: HTML, CSS, JavaScript
- **데이터베이스**: SQLite
- **API**: YouTube IFrame API

## 로컬 실행 방법

1. 저장소 클론
```
git clone <repository-url>
cd music-player
```

2. 필요한 패키지 설치
```
pip install -r requirements.txt
```

3. 애플리케이션 실행
```
python app.py
```

4. 브라우저에서 접속
```
http://localhost:5000
```

## 배포 정보

이 애플리케이션은 Render 플랫폼을 사용하여 배포됩니다.

## 라이선스

MIT 라이선스 