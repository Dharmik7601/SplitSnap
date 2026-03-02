import pytest
from fastapi.testclient import TestClient
from main import app
import io
import os
import main

client = TestClient(app)

def test_cors_headers():
    response = client.options("/api/receipt/process", headers={
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
    })
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"

def test_receipt_process_no_file():
    response = client.post("/api/receipt/process")
    assert response.status_code == 422 # Unprocessable Entity

def test_receipt_process_unsupported_file():
    file_content = b"fake text content"
    response = client.post(
        "/api/receipt/process",
        files=[("files", ("test.txt", io.BytesIO(file_content), "text/plain"))]
    )
    assert response.status_code == 400
    assert "All files must be images" in response.json()["detail"]

# We mock out main.os.getenv and the Path.exists logic for the failure test
def test_receipt_process_missing_api_key(monkeypatch):
    original_getenv = os.getenv
    monkeypatch.setattr(main.os, "getenv", lambda k, d=None: None if k == "GEMINI_API_KEY" else original_getenv(k, d))
    
    # Mock Path to pretend the .env file doesn't exist so the manual fallback doesn't trigger
    class MockPath:
        def __init__(self, *args, **kwargs): pass
        @property
        def parent(self): return self
        def __truediv__(self, other): return self
        def exists(self): return False
        
    monkeypatch.setattr(main, "Path", MockPath)
    
    file_content = b"fake image content"
    response = client.post(
        "/api/receipt/process",
        files=[("files", ("test.jpg", io.BytesIO(file_content), "image/jpeg"))]
    )
    assert response.status_code == 500
    assert "Gemini API key is not configured" in response.json()["detail"]
