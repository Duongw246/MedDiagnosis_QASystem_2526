# XRAYAPP Backend

Backend API cho hệ thống phát hiện bệnh lý phổi từ ảnh X-quang sử dụng YOLO.

## Cài đặt & chạy

Xem hướng dẫn ở file `README.md` (thư mục gốc).

Chạy backend (dev):

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Server sẽ chạy tại: http://localhost:8000

## API Endpoints

### 1. Phân tích ảnh đơn
**POST** `/analyze`

FormData:
- `file`: File ảnh X-quang
- `confidence`: Ngưỡng confidence (default: 0.25)
- `iou`: Ngưỡng IoU (default: 0.45)
- `max_det`: Số detection tối đa (default: 100)
- `model`: Tên model (default: "best.pt")

Response:
```json
{
  "result": "Phát hiện 2 vùng bất thường:\n- Pneumonia: 85.5%\n- Nodule: 72.3%\n",
  "detected_image": "data:image/jpeg;base64,...",
  "detections": [
    {"class": "Pneumonia", "confidence": 0.855},
    {"class": "Nodule", "confidence": 0.723}
  ]
}
```

### 2. Phân tích hàng loạt (ZIP)
**POST** `/analyze_batch`

FormData: Tương tự `/analyze` nhưng `file` là file ZIP chứa nhiều ảnh

Response:
```json
{
  "results": [
    {"filename": "xray1.jpg", "result": "Phát hiện..."},
    {"filename": "xray2.jpg", "result": "Không phát hiện bệnh lý"}
  ]
}
```

### 3. Chatbot
**POST** `/chat`

FormData:
- `question`: Câu hỏi
- `temperature`: Temperature (default: 0.7)
- `max_tokens`: Max tokens (default: 512)

Response:
```json
{
  "answer": "Câu trả lời từ chatbot..."
}
```

## Cấu trúc thư mục

```
backend/
├── main.py              # FastAPI server
├── requirements.txt     # Python dependencies
└── README.md           # Documentation
```

Thư mục weights (ngang hàng với backend/):
```
weights/
├── best.pt            # Custom trained model
├── yolo12n.pt         # YOLO12 nano
├── yolo12s.pt         # YOLO12 small
└── yolo12m.pt         # YOLO12 medium
```
