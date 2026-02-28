# Hướng dẫn cài & chạy XRAY App (Windows)

Tài liệu này viết theo kiểu “làm theo là chạy”, tránh rối mắt.

## Yêu cầu

- Python 3.10+ (`python --version`)
- Node.js 18+ (`node --version`)

## Cách nhanh nhất (khuyên dùng)

1) Cài toàn bộ dependencies

- Chạy file `install_all.bat` ở thư mục gốc.

2) Cấu hình API key cho Chatbot (bắt buộc nếu muốn dùng chat)

- Vào thư mục `backend/`
- Copy `backend/.env.example` thành `backend/.env`
- Điền các biến:
  - `GEMINI_API_KEY=...`
  - `PINECONE_API_KEY=...`
  - `PINECONE_INDEX_NAME=diseases` (hoặc index của bạn)

Ghi chú: Bạn cũng có thể nhập key trực tiếp trong UI (trang Chatbot). Nếu để trống, hệ thống sẽ lấy từ `backend/.env`.

3) Chạy app

- Chạy `run_app.bat`
- Mở:
  - Frontend: http://localhost:3000
  - Backend: http://localhost:8000 (Docs: http://localhost:8000/docs)

## Cách thủ công (khi cần)

### 1) Backend

```bat
cd backend
python -m venv venv
venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Tạo `backend/.env` (copy từ `.env.example`) rồi chạy:

```bat
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2) Frontend

```bat
cd frontend
npm install
npm run dev
```

## Lỗi hay gặp

- Không chat được / báo thiếu key: kiểm tra `backend/.env` đã có `GEMINI_API_KEY` và `PINECONE_API_KEY`.
- Lỗi port: nếu 8000 hoặc 3000 bị chiếm, tắt app đang dùng port đó hoặc đổi port khi chạy.