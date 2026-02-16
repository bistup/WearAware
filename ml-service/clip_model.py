"""
CLIP Model Wrapper for Clothing Image Embeddings
Uses OpenAI's CLIP ViT-B/32 model for fashion similarity
"""

from transformers import CLIPProcessor, CLIPModel
from PIL import Image
import requests
from io import BytesIO
import torch
import numpy as np

class CLIPEmbeddingExtractor:
    """
    Extracts 512-dimensional embeddings from clothing images using CLIP
    """

    def __init__(self, model_name="openai/clip-vit-base-patch32"):
        """
        Initialize CLIP model and processor

        Args:
            model_name: HuggingFace model identifier
        """
        print(f"Loading CLIP model: {model_name}")
        self.model = CLIPModel.from_pretrained(model_name)
        self.processor = CLIPProcessor.from_pretrained(model_name)

        # Set to evaluation mode (no training)
        self.model.eval()

        # Move to GPU if available
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model.to(self.device)

        print(f"CLIP model loaded on device: {self.device}")

    def extract_embedding(self, image_url):
        """
        Extract CLIP embedding from image URL

        Args:
            image_url: URL or local path to image

        Returns:
            List of 512 floating point numbers (normalized embedding)
        """
        try:
            # Load image from URL or file
            if image_url.startswith('http://') or image_url.startswith('https://'):
                response = requests.get(image_url, timeout=10)
                response.raise_for_status()
                image = Image.open(BytesIO(response.content))
            else:
                image = Image.open(image_url)

            # Convert to RGB if needed (some images might be RGBA or grayscale)
            if image.mode != 'RGB':
                image = image.convert('RGB')

            # Process image through CLIP processor
            inputs = self.processor(images=image, return_tensors="pt")

            # Move inputs to same device as model
            inputs = {k: v.to(self.device) for k, v in inputs.items()}

            # Extract image features (no gradient calculation needed)
            with torch.no_grad():
                outputs = self.model.get_image_features(**inputs)

            # Convert output to tensor (it might be wrapped in an object)
            if hasattr(outputs, 'pooler_output'):
                image_tensor = outputs.pooler_output
            elif isinstance(outputs, torch.Tensor):
                image_tensor = outputs
            else:
                # It's likely already a tensor but wrapped, try to convert
                image_tensor = torch.tensor(outputs) if not torch.is_tensor(outputs) else outputs

            # Normalize embedding to unit length (important for cosine similarity)
            embedding_normalized = image_tensor / image_tensor.norm(dim=-1, keepdim=True)

            # Convert to numpy array and then to Python list
            embedding_list = embedding_normalized[0].cpu().numpy().tolist() if embedding_normalized.dim() > 1 else embedding_normalized.cpu().numpy().tolist()

            return embedding_list

        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to download image from {image_url}: {str(e)}")
        except Exception as e:
            raise Exception(f"Failed to extract embedding: {str(e)}")

    def compute_similarity(self, embedding1, embedding2):
        """
        Compute cosine similarity between two embeddings

        Args:
            embedding1: List of 512 numbers
            embedding2: List of 512 numbers

        Returns:
            Similarity score between 0 and 1 (1 = identical)
        """
        # Convert to numpy arrays
        emb1 = np.array(embedding1)
        emb2 = np.array(embedding2)

        # Cosine similarity (embeddings are already normalized)
        similarity = np.dot(emb1, emb2)

        return float(similarity)
