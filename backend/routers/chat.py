from fastapi import APIRouter
from fastapi.responses import JSONResponse

from core.encoding import safe_print
from schemas.chat import ChatRequest
from services.rag_service import LLMs_calling


router = APIRouter(tags=["rag"])


@router.post("/chat")
async def chat(request: ChatRequest):
    try:
        answer = LLMs_calling(
            query=request.question,
            model_name=request.model,
            api_key=request.api_key,
            pinecone_api_key=request.pinecone_api_key,
            pinecone_index_name=request.pinecone_index_name,
            conversation_history=[{"user": turn.user, "bot": turn.bot} for turn in request.conversation_history],
        )
        return JSONResponse(content={"answer": answer})
    except Exception as exc:
        safe_print(f"Error in chat endpoint: {exc}")
        return JSONResponse(status_code=500, content={"error": "Internal Server Error"})

