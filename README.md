# Fit4Work 간편 주문 시스템 MVP

Flask 기반의 거래처용 간편 주문 시스템입니다. 카카오 채널에서 바로 연결되는 주문 페이지를 목표로 하며, 로그인 없이 거래처명 입력 후 상품 사진을 보면서 사이즈별 수량을 선택해 주문할 수 있습니다.

주문 처리 핵심 순서:

1. 주문 데이터 수신
2. 주문번호 생성
3. `orders_log.csv`에 먼저 저장
4. Teams Webhook 전송 시도
5. Teams 성공/실패 상태 기록
6. 실패 시 `failed_orders.csv` 저장
7. 실패 시 관리자 이메일 발송
8. 고객에게 주문 완료 응답

## 주요 기능

- 거래처명 입력 및 `localStorage` 저장
- 상품 엑셀 `products.xlsx` 기반 주문 화면
- 상품 이미지 + 사이즈별 `+/-` 수량 선택
- 총수량/총 참고금액 실시간 계산
- 주문 확인 모달과 중복 클릭 방지
- 관리자 로그인 세션
- `products.xlsx` 업로드 및 컬럼 검증
- 상품 이미지 다중 업로드, 400px 정사각형 WebP 변환
- Teams 전송 실패 시 CSV 분리 저장 + 이메일 알림
- `products.xlsx`, `orders_log.csv`, `failed_orders.csv`, `placeholder.webp` 자동 생성

## 폴더 구조

```text
order-app/
├─ app.py
├─ requirements.txt
├─ .env.example
├─ products.xlsx
├─ orders_log.csv
├─ failed_orders.csv
├─ templates/
│  ├─ order.html
│  └─ admin.html
├─ static/
│  ├─ css/
│  │  └─ order.css
│  ├─ js/
│  │  └─ order.js
│  └─ product_images/
│     └─ placeholder.webp
├─ backups/
│  └─ images/
└─ README.md
```

## 자동 생성 항목

앱 실행 시 아래 파일이 없으면 자동 생성됩니다.

- `products.xlsx`
  샘플 상품 3개가 포함된 기본 엑셀 파일
- `orders_log.csv`
- `failed_orders.csv`
- `static/product_images/placeholder.webp`
- `backups/`, `backups/images/`

## 로컬 실행 방법

1. 가상환경 생성

```bash
python3 -m venv .venv
source .venv/bin/activate
```

2. 패키지 설치

```bash
pip install -r requirements.txt
```

3. 환경변수 파일 준비

```bash
cp .env.example .env
```

`.env`에 아래 값을 채워주세요.

- `SECRET_KEY`
- `ADMIN_PASSWORD`
- `TEAMS_WEBHOOK_URL`
- `EMAIL_HOST`
- `EMAIL_PORT`
- `EMAIL_USER`
- `EMAIL_PASSWORD`
- `ALERT_EMAIL_TO`

4. 앱 실행

```bash
python app.py
```

5. 접속

```text
http://127.0.0.1:5001
http://127.0.0.1:5001/admin
```

기본 포트는 `5001`이며, 기존 `5000` 포트 서버와 충돌하지 않도록 설정되어 있습니다.

## 관리자 운영 방법

### 1. 관리자 로그인

- `/admin` 접속
- `.env`의 `ADMIN_PASSWORD` 입력
- 세션 방식으로 로그인 유지

### 2. 상품 엑셀 업로드

- `products.xlsx` 업로드
- 기존 파일은 `backups/products_YYYYMMDD_HHMMSS.xlsx`로 백업
- 필수 컬럼 검증 후 교체

필수 컬럼:

```text
품목코드, 상품명, 카테고리, 도매가, 사이즈, 이미지파일, 노출
```

선택 컬럼:

```text
정렬순서
```

### 3. 상품 이미지 업로드

- 여러 파일 한 번에 업로드 가능
- 파일명은 품목코드 기준 사용 권장
- 허용 확장자: `jpg`, `jpeg`, `png`, `webp`
- 업로드 시 400x400 정사각형 WebP로 변환
- 기존 파일이 있으면 `backups/images/`로 백업 후 교체

### 4. 이미지 연결 규칙

- `products.xlsx`의 `이미지파일` 컬럼명을 그대로 사용
- 실제 이미지가 없으면 `placeholder.webp`가 자동 표시

## 주문 로그 파일

### orders_log.csv

컬럼:

```text
created_at, order_id, customer_name, items, total_qty, total_amount, teams_status, email_alert_status
```

상태값 예:

- `PENDING`
- `TEAMS_SUCCESS`
- `TEAMS_FAIL`
- `EMAIL_SENT`
- `EMAIL_FAIL`
- `NOT_REQUIRED`

### failed_orders.csv

컬럼:

```text
created_at, order_id, customer_name, items, total_qty, total_amount, error_message
```

## 주문번호 규칙

주문번호는 날짜별 순번 증가 방식입니다.

```text
F4W-YYYYMMDD-001
```

예:

```text
F4W-20260425-001
```

## Cafe24 VPS 실행 방법

1. VPS 접속
2. 프로젝트 폴더 업로드
3. 가상환경 생성
4. `requirements.txt` 설치
5. `.env` 설정
6. `python app.py` 실행
7. `http://서버IP:5001` 접속 확인

예시:

```bash
cd /home/USER/order-app
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python app.py
```

## systemd 예시

상시 실행이 필요하면 아래 같은 형태로 확장할 수 있습니다.

```ini
[Unit]
Description=Fit4Work Order App
After=network.target

[Service]
User=www-data
WorkingDirectory=/home/USER/order-app
Environment="PATH=/home/USER/order-app/.venv/bin"
ExecStart=/home/USER/order-app/.venv/bin/python app.py
Restart=always

[Install]
WantedBy=multi-user.target
```

적용 예시:

```bash
sudo systemctl daemon-reload
sudo systemctl enable fit4work-order
sudo systemctl start fit4work-order
sudo systemctl status fit4work-order
```

## nginx 연동 메모

이번 MVP는 구조를 단순하게 유지했습니다. 나중에 nginx에서 `/order`로 프록시 연결할 수 있도록 앱은 단일 Flask 엔트리포인트로 구성되어 있습니다.

## 이번 MVP에 포함하지 않은 항목

- 로그인/회원가입
- 결제
- 실시간 재고
- 거래처별 할인율 노출
- ERP 직접 연동
- 복잡한 쇼핑몰형 장바구니
- 상품 상세페이지
- 쿠폰/포인트

## 운영 팁

- Teams 전송이 실패해도 주문은 먼저 `orders_log.csv`에 저장됩니다.
- 실패 주문은 `failed_orders.csv`와 서버 로그에서 함께 추적할 수 있습니다.
- Gmail 사용 시 `EMAIL_PASSWORD`에는 일반 비밀번호가 아니라 앱 비밀번호를 사용하는 것을 권장합니다.
