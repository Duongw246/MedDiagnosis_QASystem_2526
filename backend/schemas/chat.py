from pydantic import BaseModel, Field


class ChatTurn(BaseModel):
    user: str
    bot: str


class ChatRequest(BaseModel):
    question: str
    temperature: float = 0.7
    max_tokens: int = 512
    model: str = "gemini-2.5-flash-lite"
    api_key: str = None
    pinecone_api_key: str | None = None
    pinecone_index_name: str | None = None
    conversation_history: list[ChatTurn] = Field(default_factory=list)

