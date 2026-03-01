
import os
import sys
import time
from dotenv import load_dotenv

# Ensure we can import from the current directory
sys.path.append(os.path.dirname(__file__))

# Load environment variables
load_dotenv(override=True)

from rag_service import LLMs_calling

def test_rag_full():
    print("--- Testing Full RAG Pipeline ---")
    
    query = "Tràn dịch màng phổi là gì?"
    print(f"\nTest Query: {query}")
    
    try:
        response = LLMs_calling(query)
        print("\n=== RAG Response ===")
        print(response)
        print("====================")
        
    except Exception as e:
        print(f"\nERROR in RAG Pipeline: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_rag_full()
