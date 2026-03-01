# X-RAY APP

Ứng dụng gồm 2 phần:
- **Backend**: FastAPI + Python (phân tích ảnh / RAG / API)
- **Frontend**: Next.js + React (giao diện web)

## 1) Yêu cầu trước khi cài

- Windows
- Python 3.10+ (`python --version`)
- Node.js 18+ (`node --version`)
- npm (`npm --version`)

## 2) Cài đặt nhanh (khuyên dùng)

Tại thư mục gốc project, chạy:

```bat
install_all.bat
```

Script sẽ tự động:
- Kiểm tra `backend/` và `frontend/`
- Tạo `backend/venv` nếu chưa có
- Cài thư viện Python từ `backend/requirements.txt`
- Tạo `backend/.env` nếu chưa có
  - Ưu tiên copy từ `backend/.env.example` nếu file này tồn tại
  - Nếu không có, script tạo file mẫu với các key cơ bản
- Cài dependencies frontend bằng `npm ci` (hoặc `npm install` nếu chưa có lock file)
- Tạo `frontend/.env.local` nếu chưa có

## 3) Chạy ứng dụng

Chạy:

```bat
run_app.bat
```

Sau khi chạy:
- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- API Docs: http://localhost:8000/docs

## 4) Cấu hình ENV cần lưu ý

### Backend ENV (`backend/.env`)

Các biến thường dùng:

```env
GEMINI_API_KEY=
PINECONE_API_KEY=
PINECONE_INDEX_NAME=diseases
```

> Nếu dùng chatbot/RAG, cần điền API key thật.

### Frontend ENV (`frontend/.env.local`)

Mặc định script sẽ tạo:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

Nếu backend chạy port khác thì sửa lại giá trị này.

## 5) Dữ liệu trong thư mục `Val data`

Cấu trúc đang dùng:

- `Val data/images/`: chứa file ảnh
- `Val data/labels/`: chứa file nhãn `.txt` tương ứng từng ảnh
- `Val data/data.yaml`: cấu hình dataset
- `Val data/label.txt`: danh sách class

### Cách thêm ảnh và label đúng

1. Thêm ảnh vào `Val data/images/` (ví dụ: `sample_001.jpg`)
2. Tạo file label cùng tên trong `Val data/labels/` (ví dụ: `sample_001.txt`)
3. Mỗi dòng trong file `.txt` theo format YOLO:

```txt
<class_id> <x_center> <y_center> <width> <height>
```

- Các giá trị tọa độ là số chuẩn hóa trong khoảng `0..1`
- Ảnh nào **không có đối tượng** thì tạo file `.txt` rỗng (hoặc xử lý theo quy ước dataset hiện tại của bạn)

### Quy tắc bắt buộc

- Tên ảnh và tên label phải **trùng nhau** (khác mỗi phần mở rộng)
- Không để thiếu cặp ảnh/label
- Giữ đúng cấu trúc thư mục `images` và `labels`
