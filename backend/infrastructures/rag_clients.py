import os
from typing import Optional

from dotenv import load_dotenv
from google import genai
from langchain_huggingface import HuggingFaceEmbeddings
from pinecone import Pinecone

from core.encoding import safe_print


_BACKEND_DIR = os.path.dirname(os.path.dirname(__file__))
_DOTENV_PATH = os.path.join(_BACKEND_DIR, ".env")
load_dotenv(dotenv_path=_DOTENV_PATH, override=True)

PINECONE_API_KEY_ENV = "PINECONE_API_KEY"
PINECONE_INDEX_NAME_ENV = "PINECONE_INDEX_NAME"
GEMINI_API_KEY_ENV = "GEMINI_API_KEY"
EMBEDDING_MODEL_ENV = "EMBEDDING_MODEL_NAME"

_pinecone_client: Optional[Pinecone] = None
_pinecone_index = None
_pinecone_indexes: dict[tuple[str, str], object] = {}
_embeddings: Optional[HuggingFaceEmbeddings] = None


def get_pinecone_index(api_key: Optional[str] = None, index_name: Optional[str] = None):
    global _pinecone_client, _pinecone_index, _pinecone_indexes

    resolved_api_key = (api_key or "").strip() or os.getenv(PINECONE_API_KEY_ENV, "").strip()
    if not resolved_api_key:
        raise RuntimeError(
            f"Missing Pinecone API key. Provide request.pinecone_api_key or set {PINECONE_API_KEY_ENV} in backend/.env."
        )

    resolved_index_name = (index_name or "").strip() or os.getenv(PINECONE_INDEX_NAME_ENV, "diseases").strip() or "diseases"
    cache_key = (resolved_api_key, resolved_index_name)

    cached = _pinecone_indexes.get(cache_key)
    if cached is not None:
        return cached

    if (not api_key) and (not index_name) and _pinecone_index is not None:
        return _pinecone_index

    safe_print("Initializing Pinecone...")
    pc = Pinecone(api_key=resolved_api_key)
    idx = pc.Index(resolved_index_name)
    _pinecone_indexes[cache_key] = idx

    if (not api_key) and (not index_name):
        _pinecone_client = pc
        _pinecone_index = idx

    return idx


def get_embeddings():
    global _embeddings
    if _embeddings is not None:
        return _embeddings

    model_name = os.getenv(EMBEDDING_MODEL_ENV, "BAAI/bge-m3").strip() or "BAAI/bge-m3"
    safe_print("Initializing Embeddings (this may take a while on first run)...")
    _embeddings = HuggingFaceEmbeddings(model_name=model_name)
    return _embeddings


def get_gemini_client(api_key: Optional[str] = None) -> genai.Client:
    key = (api_key or "").strip() or os.getenv(GEMINI_API_KEY_ENV, "").strip()
    if not key:
        raise RuntimeError(
            f"Missing Gemini API key. Provide request.api_key or set {GEMINI_API_KEY_ENV} in backend/.env."
        )
    return genai.Client(api_key=key)

