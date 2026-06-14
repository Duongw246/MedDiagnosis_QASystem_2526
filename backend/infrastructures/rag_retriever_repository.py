import json
import traceback
from typing import Optional

from core.encoding import safe_print
from infrastructures.rag_clients import get_embeddings, get_pinecone_index


def retrieve_context(
    query,
    top_k=3,
    pinecone_api_key: Optional[str] = None,
    pinecone_index_name: Optional[str] = None,
):
    try:
        safe_print(f"Embedding query: {query}")
        embeddings = get_embeddings()
        query_embedding = embeddings.embed_query(query)

        index = get_pinecone_index(api_key=pinecone_api_key, index_name=pinecone_index_name)
        safe_print("Querying Pinecone index namespace='chest-diseases'...")
        results = index.query(
            vector=query_embedding,
            top_k=top_k,
            namespace="chest-diseases",
            include_metadata=True,
        )

        context_data = []
        for match in results.get("matches", []):
            metadata = match.get("metadata", {})
            if metadata:
                context_data.append(metadata)

        if not context_data:
            safe_print("Warning: No context data retrieved from Pinecone")
            return json.dumps([], ensure_ascii=False)

        return json.dumps(context_data, ensure_ascii=False, indent=2)
    except Exception as exc:
        safe_print(f"Error in retrieve_context: {exc}")
        safe_print(traceback.format_exc())
        raise

