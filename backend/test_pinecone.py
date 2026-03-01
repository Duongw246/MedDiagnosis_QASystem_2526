
import os
import sys
import json
from dotenv import load_dotenv
from pinecone import Pinecone

# Ensure we can import from the current directory
sys.path.append(os.path.dirname(__file__))

# Load environment variables
load_dotenv(override=True)

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "diseases")

def test_pinecone_connection():
    print("--- Testing Pinecone Connection ---")
    if not PINECONE_API_KEY:
        print("ERROR: PINECONE_API_KEY not found in environment variables.")
        return

    try:
        pc = Pinecone(api_key=PINECONE_API_KEY)
        print("Pinecone client initialized successfully.")
        
        # List indexes
        indexes = pc.list_indexes()
        print(f"Available indexes: {[i.name for i in indexes]}")
        
        if PINECONE_INDEX_NAME not in [i.name for i in indexes]:
            print(f"ERROR: Index '{PINECONE_INDEX_NAME}' not found.")
            return

        index = pc.Index(PINECONE_INDEX_NAME)
        print(f"Index '{PINECONE_INDEX_NAME}' initialized.")
        
        # Get index stats
        stats = index.describe_index_stats()
        print(f"Index Stats: {stats}")
        
        # Test Query (using a dummy vector if embedding not available, or just check connectivity)
        # We won't embed here to avoid loading heavy models, just checking DB access
        # But to see what metadata looks like, we might need a fetch or query
        
        print("\n--- Testing Fetch (Dummy ID) ---")
        # Try to fetch a non-existent ID just to see if it errors
        fetch_response = index.fetch(ids=["non_existent_id"], namespace="chest-diseases")
        print("Fetch successful (empty expected):")
        print(fetch_response)
        
        print("\n--- Pinecone Connection Test PASSED ---")
        return True

    except Exception as e:
        print(f"\nERROR: Failed to connect to Pinecone: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    test_pinecone_connection()
