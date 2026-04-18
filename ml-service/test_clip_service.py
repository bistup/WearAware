# author: caitriona mccann
# date: 15/04/2026
# unit tests for the CLIP ML Flask service
# covers health endpoint, embedding structure and describe endpoint response shape
# uses pytest with arrange-act-assert pattern
# run with: pytest test_clip_service.py -v

import pytest
import sys
import os
import tempfile
from PIL import Image

# add ml-service directory to path so app and clip_model can be imported
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


@pytest.fixture(scope='module')
def test_image_path(tmp_path_factory):
    """Create a small solid-colour RGB JPEG for use as a local test fixture."""
    img = Image.new('RGB', (224, 224), color=(100, 149, 237))
    path = tmp_path_factory.mktemp('fixtures') / 'test_garment.jpg'
    img.save(str(path), 'JPEG')
    return str(path)


@pytest.fixture(scope='module')
def client():
    """
    Create a Flask test client once for the entire module.
    Model loading (~10s) only happens once this way.
    """
    from app import app
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


# UT-06: health endpoint returns status healthy and correct model name
def test_health_endpoint(client):
    # Arrange — no input needed, GET request only

    # Act
    response = client.get('/health')
    data = response.get_json()

    # Assert
    assert response.status_code == 200
    assert data['status'] == 'healthy'
    assert 'clip-vit-base-patch16' in data['model']
    assert data['embedding_dimension'] is not None


# UT-07: extract-embedding returns a 512-dimensional float list
def test_embedding_response_structure(client, test_image_path):
    # Arrange — use a local test image to avoid network dependency
    payload = {'image_url': test_image_path}

    # Act
    response = client.post('/extract-embedding', json=payload)
    data = response.get_json()

    # Assert
    assert response.status_code == 200
    assert 'embedding' in data
    assert isinstance(data['embedding'], list)
    assert len(data['embedding']) == 512
    assert all(isinstance(v, float) for v in data['embedding'])


# UT-08: describe endpoint returns all four expected classification categories
def test_describe_response_structure(client, test_image_path):
    # Arrange — use a local test image to avoid network dependency
    payload = {'image_url': test_image_path}

    # Act
    response = client.post('/describe', json=payload)
    data = response.get_json()

    # Assert
    assert response.status_code == 200
    assert 'color' in data
    assert 'pattern' in data
    assert 'style' in data
    assert 'garment_type' in data
    assert 'description' in data
    assert isinstance(data['description'], str)
