# WearAware ML Service

Python Flask API for visual similarity matching using CLIP embeddings.

## Setup

### 1. Create Virtual Environment

```bash
cd "c:/project demo/ml-service"
python -m venv venv
```

### 2. Activate Virtual Environment

**Windows:**
```bash
venv\Scripts\activate
```

**Linux/Mac:**
```bash
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

**Note:** First run will download CLIP model (~1.7GB). This is normal and only happens once.

### 4. Run the Service

```bash
python app.py
```

The service will start on `http://localhost:5000`

## API Endpoints

### Health Check
```bash
GET /health
```

### Extract Single Embedding
```bash
POST /extract-embedding
Content-Type: application/json

{
  "image_url": "https://example.com/image.jpg"
}
```

Response:
```json
{
  "success": true,
  "embedding": [512 floating point numbers],
  "dimension": 512
}
```

### Extract Batch Embeddings
```bash
POST /extract-embedding-batch
Content-Type: application/json

{
  "image_urls": ["url1.jpg", "url2.jpg"]
}
```

## Testing

Test the service is working:

```bash
curl http://localhost:5000/health
```

## Deployment

For production, use gunicorn:

```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

## Model Information

- **Model:** OpenAI CLIP ViT-B/32
- **Embedding Dimension:** 512
- **Use Case:** Fashion/clothing visual similarity
- **Performance:** ~2-3 seconds per image on CPU, <1 second on GPU
