"""
ML Service for WearAware - CLIP Image Understanding
Provides garment image description via REST API (Flask).
Author: Caitriona McCann

Overview:
  This service runs the OpenAI CLIP model (clip-vit-base-patch16) locally
  on the Proxmox server at port 5000. It is called by the Node.js backend's
  webSearchService.js when building search queries for sustainable alternatives.

Active endpoints:
  GET  /health               - liveness check, returns model name and embedding dimension
  POST /describe             - zero-shot garment description (color, pattern, style, type)
                               Used by webSearchService to refine search queries
  POST /extract-embedding    - returns raw 512-dim CLIP embedding for a single image URL
  POST /extract-embedding-batch - returns embeddings for multiple image URLs

The /extract-embedding endpoints are no longer called by the backend after
visual similarity search was removed, but are kept for potential future use.
CLIP model is loaded once on startup (takes ~10s) and stays in memory.
GPU is used automatically if CUDA is available, otherwise falls back to CPU.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from clip_model import CLIPEmbeddingExtractor
import traceback

app = Flask(__name__)
CORS(app)

# load model once at startup - this is the expensive step (~200MB download on first run)
# subsequent starts use the cached HuggingFace model from ~/.cache/huggingface/
CLIP_MODEL_NAME = os.environ.get("CLIP_MODEL_NAME", "openai/clip-vit-base-patch16")
print("Loading CLIP model...")
clip_extractor = CLIPEmbeddingExtractor(model_name=CLIP_MODEL_NAME)
print("CLIP model loaded successfully!")

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'model': clip_extractor.model_name,
        'embedding_dimension': clip_extractor.embedding_dim,
        'version': '1.1.0'
    })

@app.route('/extract-embedding', methods=['POST'])
def extract_embedding():
    """
    Extract CLIP embedding from image URL

    Request body:
    {
        "image_url": "https://example.com/image.jpg"
    }

    Response:
    {
        "success": true,
        "embedding": [512 floating point numbers],
        "dimension": 512
    }
    """
    try:
        data = request.get_json()

        if not data or 'image_url' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing image_url in request body'
            }), 400

        image_url = data['image_url']

        # Extract embedding
        embedding = clip_extractor.extract_embedding(image_url)

        return jsonify({
            'success': True,
            'embedding': embedding,
            'dimension': len(embedding)
        })

    except Exception as e:
        print(f"Error extracting embedding: {str(e)}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/describe', methods=['POST'])
def describe_image():
    """
    Use CLIP zero-shot classification to describe a garment image.
    Returns color, pattern, style, garment type, and a combined description.

    Request body:
    {
        "image_url": "https://example.com/image.jpg"
    }

    Response:
    {
        "success": true,
        "color": "blue",
        "pattern": "solid color",
        "style": "casual",
        "garment_type": "jacket",
        "description": "blue casual jacket"
    }
    """
    try:
        data = request.get_json()

        if not data or 'image_url' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing image_url in request body'
            }), 400

        image_url = data['image_url']

        # Use CLIP zero-shot to describe the garment
        description = clip_extractor.describe_image(image_url)

        return jsonify({
            'success': True,
            **description
        })

    except Exception as e:
        print(f"Error describing image: {str(e)}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/extract-embedding-batch', methods=['POST'])
def extract_embedding_batch():
    """
    Extract CLIP embeddings from multiple image URLs

    Request body:
    {
        "image_urls": ["url1", "url2", ...]
    }

    Response:
    {
        "success": true,
        "embeddings": [[512 numbers], [512 numbers], ...],
        "count": 2
    }
    """
    try:
        data = request.get_json()

        if not data or 'image_urls' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing image_urls in request body'
            }), 400

        image_urls = data['image_urls']

        if not isinstance(image_urls, list):
            return jsonify({
                'success': False,
                'error': 'image_urls must be an array'
            }), 400

        # Extract embeddings for all URLs
        embeddings = []
        for url in image_urls:
            embedding = clip_extractor.extract_embedding(url)
            embeddings.append(embedding)

        return jsonify({
            'success': True,
            'embeddings': embeddings,
            'count': len(embeddings)
        })

    except Exception as e:
        print(f"Error extracting batch embeddings: {str(e)}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
