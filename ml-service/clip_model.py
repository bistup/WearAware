"""
CLIP Model Wrapper for Clothing Image Embeddings
Uses OpenAI CLIP models for fashion similarity
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

    def __init__(self, model_name="openai/clip-vit-base-patch16"):
        """
        Initialize CLIP model and processor

        Args:
            model_name: HuggingFace model identifier
        """
        self.model_name = model_name
        print(f"Loading CLIP model: {model_name}")
        self.model = CLIPModel.from_pretrained(model_name)
        self.processor = CLIPProcessor.from_pretrained(model_name)
        self.embedding_dim = getattr(self.model.config, "projection_dim", None)

        # Set to evaluation mode (no training)
        self.model.eval()

        # Move to GPU if available
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model.to(self.device)

        print(f"CLIP model loaded on device: {self.device} (dim={self.embedding_dim})")

    def extract_embedding(self, image_url):
        """
        Extract CLIP embedding from image URL

        Args:
            image_url: URL or local path to image

        Returns:
            List of 512 floating point numbers (normalized embedding)
        """
        try:
            image = self._load_image(image_url)

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

    def _load_image(self, image_url):
        """Load image from URL or file path and convert to RGB"""
        if image_url.startswith('http://') or image_url.startswith('https://'):
            response = requests.get(image_url, timeout=10)
            response.raise_for_status()
            image = Image.open(BytesIO(response.content))
        else:
            image = Image.open(image_url)

        if image.mode != 'RGB':
            image = image.convert('RGB')

        # center crop to square for more consistent CLIP results
        # removes background noise and focuses on the garment
        w, h = image.size
        if w != h:
            crop_size = min(w, h)
            left = (w - crop_size) // 2
            top = (h - crop_size) // 2
            image = image.crop((left, top, left + crop_size, top + crop_size))

        return image

    def _classify_with_ensemble(self, image, labels, prompt_templates):
        """
        Classify image against labels using prompt ensembling.
        Averages probabilities across multiple prompt templates per label
        for more robust predictions (3-5% accuracy improvement over single prompts).

        Args:
            image: PIL Image
            labels: list of label strings
            prompt_templates: list of format strings with {label} placeholder

        Returns:
            (best_label, confidence, all_probs_dict)
        """
        # accumulate probabilities across all prompt templates
        accumulated_probs = np.zeros(len(labels))

        for template in prompt_templates:
            text_prompts = [template.format(label=label) for label in labels]

            inputs = self.processor(
                text=text_prompts,
                images=image,
                return_tensors="pt",
                padding=True,
            )
            inputs = {k: v.to(self.device) for k, v in inputs.items()}

            with torch.no_grad():
                outputs = self.model(**inputs)
                logits = outputs.logits_per_image[0]
                probs = logits.softmax(dim=0).cpu().numpy()

            accumulated_probs += probs

        # average across all prompt templates
        avg_probs = accumulated_probs / len(prompt_templates)

        best_idx = int(np.argmax(avg_probs))
        return labels[best_idx], float(avg_probs[best_idx])

    def describe_image(self, image_url):
        """
        Use CLIP zero-shot classification with prompt ensembling to describe
        a garment image. Classifies across color, pattern, style, and garment type.
        Uses multiple prompt templates per category and averages results for
        more accurate predictions.

        Args:
            image_url: URL or local path to image

        Returns:
            dict with keys: color, pattern, style, garment_type, description,
                  plus confidence scores for each category
        """
        try:
            image = self._load_image(image_url)

            # expanded classification categories with more granular labels
            categories = {
                'color': {
                    'labels': [
                        'red', 'blue', 'navy blue', 'light blue', 'sky blue',
                        'green', 'dark green', 'sage green', 'black', 'white',
                        'off-white', 'beige', 'brown', 'tan', 'grey', 'charcoal',
                        'light grey', 'pink', 'hot pink', 'purple', 'lavender',
                        'yellow', 'mustard', 'orange', 'multicolored', 'cream',
                        'olive', 'khaki', 'burgundy', 'maroon', 'teal',
                        'coral', 'rust', 'denim blue',
                    ],
                    'prompts': [
                        "a photo of {label} colored clothing",
                        "a {label} piece of clothing",
                        "{label} clothing item on display",
                    ],
                },
                'pattern': {
                    'labels': [
                        'solid color', 'striped', 'horizontal stripes',
                        'plaid', 'tartan', 'floral', 'geometric', 'animal print',
                        'leopard print', 'tie-dye', 'polka dot', 'camouflage',
                        'checkered', 'gingham', 'abstract print', 'color block',
                        'herringbone', 'paisley', 'graphic print',
                    ],
                    'prompts': [
                        "a photo of a {label} garment",
                        "clothing with a {label} pattern",
                        "a {label} fabric pattern on clothing",
                    ],
                },
                'style': {
                    'labels': [
                        'casual', 'formal', 'sporty', 'athletic', 'streetwear',
                        'vintage', 'bohemian', 'minimalist', 'elegant',
                        'workwear', 'outdoor', 'loungewear', 'preppy',
                    ],
                    'prompts': [
                        "a {label} style piece of clothing",
                        "clothing in a {label} fashion style",
                        "{label} fashion clothing item",
                    ],
                },
                'garment_type': {
                    'labels': [
                        't-shirt', 'long sleeve shirt', 'button-up shirt', 'blouse',
                        'sweater', 'hoodie', 'jacket', 'denim jacket', 'leather jacket',
                        'coat', 'winter coat', 'puffer jacket', 'windbreaker',
                        'jeans', 'trousers', 'chinos', 'joggers', 'leggings',
                        'shorts', 'skirt', 'midi skirt', 'dress', 'midi dress',
                        'maxi dress', 'cardigan', 'vest', 'polo shirt',
                        'tank top', 'crop top', 'sweatshirt', 'blazer', 'parka',
                        'jumpsuit', 'dungarees', 'raincoat',
                    ],
                    'prompts': [
                        "a photo of a {label}",
                        "a {label} clothing item",
                        "someone wearing a {label}",
                    ],
                },
            }

            # minimum confidence threshold - attributes below this are excluded
            # from search queries to avoid adding noise
            CONFIDENCE_THRESHOLD = 0.15

            results = {}
            for category, config in categories.items():
                best_label, confidence = self._classify_with_ensemble(
                    image, config['labels'], config['prompts']
                )
                results[category] = best_label
                results[f'{category}_confidence'] = confidence

            # build description using only high-confidence attributes
            description_parts = []
            if results.get('color') and results.get('color_confidence', 0) >= CONFIDENCE_THRESHOLD:
                description_parts.append(results['color'])
            else:
                results['color'] = None  # mark low-confidence as None

            if (results.get('pattern') and results['pattern'] != 'solid color'
                    and results.get('pattern_confidence', 0) >= CONFIDENCE_THRESHOLD):
                description_parts.append(results['pattern'])

            if results.get('style') and results.get('style_confidence', 0) >= CONFIDENCE_THRESHOLD:
                description_parts.append(results['style'])

            if results.get('garment_type') and results.get('garment_type_confidence', 0) >= CONFIDENCE_THRESHOLD:
                description_parts.append(results['garment_type'])
            else:
                results['garment_type'] = None

            results['description'] = ' '.join(description_parts) if description_parts else ''

            return results

        except Exception as e:
            raise Exception(f"Failed to describe image: {str(e)}")

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
