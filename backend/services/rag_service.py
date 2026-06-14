import os
import json
import time
import sys
import unicodedata
import io
import traceback
import re
from typing import Optional

from answer_formatting import (
    ensure_source_section,
    extract_source_from_text,
    filter_answer_to_sections,
    post_process_answer,
)
from infrastructures.rag_clients import get_gemini_client
from infrastructures.rag_retriever_repository import retrieve_context
from prompts import (
    diseases_prompt,
    normal_chatting_prompt,
    peripheral_prompt,
    rewrite_prompt,
    route_prompt,
)

# Ensure Vietnamese text can be printed on Windows terminals
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
    sys.stderr.reconfigure(encoding="utf-8", errors="backslashreplace")
except Exception:
    try:
        if hasattr(sys.stdout, "buffer"):
            sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="backslashreplace", line_buffering=True)
        if hasattr(sys.stderr, "buffer"):
            sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="backslashreplace", line_buffering=True)
    except Exception:
        pass


def safe_print(*args, **kwargs):
    """Print without crashing on misconfigured console encodings."""
    try:
        print(*args, **kwargs)
    except UnicodeEncodeError:
        try:
            msg = " ".join(str(a) for a in args)
            end = kwargs.get("end", "\n")
            sys.stdout.buffer.write((msg + end).encode("utf-8", errors="backslashreplace"))
        except Exception:
            pass

_BACKEND_DIR = os.path.dirname(os.path.dirname(__file__))
# List of models to try in order
MODELS_TO_TRY = [
    "gemini-2.5-flash-lite", 
    "gemini-2.5-flash", 
    "gemini-2.0-flash-lite", 
    "gemini-flash-latest",
    "gemini-2.0-flash",
    "gemini-2.5-pro"
]

MAX_MODEL_ATTEMPTS = 3
REQUEST_DELAY_SECONDS = 1.0
RETRY_BACKOFF_BASE_SECONDS = 1.5

_BASE_DIR = _BACKEND_DIR
_LOGS_DIR = os.path.join(_BASE_DIR, "logs")
_ERROR_LOG_PATH = os.path.join(_LOGS_DIR, "errors.log")

SOURCE_KEYS = ("source", "nguồn", "nguon", "Nguồn", "Nguon")


def _append_error_log(label: str, details: str, query: str | None = None):
    """Append errors to UTF-8 log safely without breaking request flow."""
    try:
        os.makedirs(_LOGS_DIR, exist_ok=True)
        with open(_ERROR_LOG_PATH, "a", encoding="utf-8", errors="backslashreplace") as f:
            f.write("\n" + "=" * 80 + "\n")
            f.write(time.strftime("%Y-%m-%d %H:%M:%S") + "\n")
            f.write(f"{label}\n")
            if query is not None:
                f.write(f"Query: {query}\n")
            f.write(details.rstrip() + "\n")
    except Exception:
        pass


def _is_empty_context(context: str | None) -> bool:
    if context is None:
        return True
    return context.strip() in ("", "[]", "null")


def _build_models_list(model_name: str | None) -> list[str]:
    if model_name and model_name.strip():
        preferred = model_name.strip()
        return [preferred] + [m for m in MODELS_TO_TRY if m != preferred]
    return MODELS_TO_TRY


def _looks_like_medical_sections(answer: str) -> bool:
    return bool(
        re.search(r"(?im)^\s*(Bệnh|Định nghĩa|Nguyên nhân|Triệu chứng|Biện pháp phòng)\s*:\s*", answer)
        or re.search(r"(?i)\*\*(Định nghĩa|Nguyên nhân|Triệu chứng|Biện pháp phòng|Nguồn)\s*:\*\*", answer)
    )


MAX_HISTORY_PAIRS = 10
NO_CONTEXT_FALLBACK_ANSWER = "Hiện tại chúng tôi chưa thể trả lời câu hỏi của bạn"

KNOWN_DISEASE_ALIASES: dict[str, tuple[str, ...]] = {
    "Xẹp phổi": ("xep phoi", "atelectasis"),
    "Phình động mạch chủ": ("phinh dong mach chu", "aortic enlargement"),
    "Tim to": ("tim to", "cardiomegaly"),
    "Bệnh phổi kẽ": ("benh phoi ke", "ild", "interstitial lung disease"),
    "Xơ phổi": ("xo phoi", "pulmonary fibrosis"),
    "Tràn khí màng phổi": ("tran khi mang phoi", "pneumothorax"),
    "Tràn dịch màng phổi": ("tran dich mang phoi", "pleural effusion"),
    "Dày màng phổi": ("day mang phoi", "pleural thickening"),
}

REFERENCE_DISEASE_MARKERS = (
    "benh nay",
    "benh do",
    "benh tren",
    "ca benh nay",
    "truong hop nay",
    "ca nay",
)


def _format_conversation_history(conversation_history: list[dict] | None) -> str:
    """Convert chat history to plain text and keep only the latest N user-bot pairs."""
    if not conversation_history:
        return ""

    normalized_pairs: list[tuple[str, str]] = []
    for item in conversation_history:
        if not isinstance(item, dict):
            continue
        user_text = str(item.get("user", "") or "").strip()
        bot_text = str(item.get("bot", "") or "").strip()
        if not user_text and not bot_text:
            continue
        normalized_pairs.append((user_text, bot_text))

    if not normalized_pairs:
        return ""

    recent_pairs = normalized_pairs[-MAX_HISTORY_PAIRS:]
    lines: list[str] = ["Lịch sử hội thoại gần đây (10 cặp gần nhất):"]
    for index, (user_text, bot_text) in enumerate(recent_pairs, start=1):
        lines.append(f"{index}. Người dùng: {user_text or '(trống)'}")
        lines.append(f"   Chatbot: {bot_text or '(trống)'}")
    return "\n".join(lines)


def _build_prompt_with_history(base_prompt: str, conversation_history: list[dict] | None) -> str:
    history_text = _format_conversation_history(conversation_history)
    if not history_text:
        return base_prompt
    return (
        f"{base_prompt.strip()}\n\n"
        "Bối cảnh bổ sung:\n"
        f"{history_text}\n"
        "Hãy dùng lịch sử này để hiểu ngữ cảnh cuộc hội thoại và tránh mâu thuẫn với các câu trả lời trước đó."
    )

def _strip_accents(s: str) -> str:
    if not s:
        return ""
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def _normalize_for_history_intent(text: str) -> str:
    normalized = _strip_accents((text or "").lower())
    normalized = re.sub(r"[^a-z0-9\s]", " ", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def _find_latest_disease_in_history(conversation_history: list[dict] | None) -> str | None:
    if not conversation_history:
        return None

    for item in reversed(conversation_history):
        if not isinstance(item, dict):
            continue
        combined = " ".join(
            [
                str(item.get("user", "") or ""),
                str(item.get("bot", "") or ""),
            ]
        ).strip()
        if not combined:
            continue
        normalized = _normalize_for_history_intent(combined)
        for canonical_name, aliases in KNOWN_DISEASE_ALIASES.items():
            if any(alias in normalized for alias in aliases):
                return canonical_name

    return None


def _rewrite_deictic_disease_query(query: str, conversation_history: list[dict] | None) -> str | None:
    normalized_query = _normalize_for_history_intent(query)
    if not normalized_query:
        return None

    has_reference_marker = any(marker in normalized_query for marker in REFERENCE_DISEASE_MARKERS)
    if not has_reference_marker:
        return None

    # Query already contains a specific disease => no need to rewrite here.
    for aliases in KNOWN_DISEASE_ALIASES.values():
        if any(alias in normalized_query for alias in aliases):
            return None

    disease_name = _find_latest_disease_in_history(conversation_history)
    if not disease_name:
        return None

    requested_sections = detect_requested_sections(query)
    if "Triệu chứng" in requested_sections:
        return f"Triệu chứng {disease_name} là gì?"
    if "Nguyên nhân" in requested_sections:
        return f"Nguyên nhân {disease_name} là gì?"
    if "Biện pháp phòng ngừa" in requested_sections:
        return f"Biện pháp phòng ngừa {disease_name} là gì?"

    return f"{disease_name} là gì?"


def _extract_user_questions(conversation_history: list[dict] | None) -> list[str]:
    if not conversation_history:
        return []
    questions: list[str] = []
    for item in conversation_history:
        if not isinstance(item, dict):
            continue
        user_text = str(item.get("user", "") or "").strip()
        if user_text:
            questions.append(user_text)
    return questions


def _answer_history_meta_query(query: str, conversation_history: list[dict] | None) -> str | None:
    """Return deterministic answer for questions that ask to recall previous user questions."""
    normalized_query = _normalize_for_history_intent(query)
    if not normalized_query:
        return None

    user_questions = _extract_user_questions(conversation_history)
    if not user_questions:
        return None

    asks_first_question = any(
        phrase in normalized_query
        for phrase in (
            "cau hoi luc dau",
            "cau hoi dau tien",
            "luc dau tao hoi gi",
            "luc dau toi hoi gi",
            "toi hoi gi dau tien",
            "tao hoi gi dau tien",
            "cau dau tien la gi",
        )
    )

    asks_previous_question = any(
        phrase in normalized_query
        for phrase in (
            "cau hoi truoc do",
            "cau hoi vua roi",
            "toi vua hoi gi",
            "tao vua hoi gi",
            "cau hoi gan nhat",
        )
    )

    if asks_first_question:
        return f"Câu hỏi đầu tiên của bạn là: \"{user_questions[0]}\""

    if asks_previous_question:
        return f"Câu hỏi gần nhất trước câu hiện tại của bạn là: \"{user_questions[-1]}\""

    return None


def detect_requested_sections(query: str) -> list[str]:
    """Detect which specific section(s) user is asking for.

    Returns canonical Vietnamese headers among:
    - Định nghĩa
    - Nguyên nhân
    - Triệu chứng
    - Biện pháp phòng ngừa

    If nothing specific detected, returns empty list (meaning: full answer allowed).
    """
    if not query:
        return []

    q = query.lower().strip()
    q_ascii = _strip_accents(q)

    wants: list[str] = []

    def has_any(*needles: str) -> bool:
        return any(n in q for n in needles) or any(n in q_ascii for n in needles)

    # Definition / what is
    if has_any(
        "định nghĩa",
        "khái niệm",
        "la gi",
        "là gì",
        "what is",
        "define",
        "definition",
    ):
        wants.append("Định nghĩa")

    # Cause
    if has_any(
        "nguyên nhân",
        "vi sao",
        "vì sao",
        "tai sao",
        "tại sao",
        "do dau",
        "do đâu",
        "nguyen nhan",
        "cause",
        "causes",
        "etiology",
    ):
        wants.append("Nguyên nhân")

    # Symptoms
    if has_any(
        "triệu chứng",
        "trieu chung",
        "dấu hiệu",
        "dau hieu",
        "biểu hiện",
        "bieu hien",
        "symptom",
        "symptoms",
        "signs",
    ):
        wants.append("Triệu chứng")

    # Prevention
    if has_any(
        "phòng ngừa",
        "phong ngua",
        "phòng tránh",
        "phong tranh",
        "ngăn ngừa",
        "ngan ngua",
        "cách phòng",
        "cach phong",
        "prevention",
        "prevent",
        "how to prevent",
    ):
        wants.append("Biện pháp phòng ngừa")

    # De-dup while preserving order
    seen = set()
    ordered = []
    for w in wants:
        if w not in seen:
            seen.add(w)
            ordered.append(w)
    return ordered


def build_template_for_sections(requested_sections: list[str]) -> tuple[str, list[str]]:
    """Return (template_text, allowed_headers_for_filtering)."""
    if not requested_sections:
        # Default behavior: if user didn't ask clearly (or asked "là gì"), return only definition + source.
        template = (
            "### Bệnh: <Tên bệnh>\n\n"
            "**Định nghĩa:**\n<Nội dung định nghĩa>\n\n"
            "**Nguồn:**\n<Nguồn thông tin cụ thể từ context>"
        )
        return template, ["Bệnh", "Định nghĩa", "Nguồn"]

    # Always keep disease name + source
    allowed = ["Bệnh", *requested_sections, "Nguồn"]

    sections_text = []
    for s in requested_sections:
        if s == "Định nghĩa":
            sections_text.append("**Định nghĩa:**\n<Nội dung định nghĩa>")
        elif s == "Nguyên nhân":
            sections_text.append("**Nguyên nhân:**\n<Nội dung nguyên nhân>")
        elif s == "Triệu chứng":
            sections_text.append("**Triệu chứng:**\n<Nội dung triệu chứng>")
        elif s == "Biện pháp phòng ngừa":
            sections_text.append("**Biện pháp phòng ngừa:**\n<Nội dung biện pháp phòng ngừa>")

    template = (
        "### Bệnh: <Tên bệnh>\n\n"
        + "\n\n".join(sections_text)
        + "\n\n**Nguồn:**\n<Nguồn thông tin cụ thể từ context>"
    )
    return template, allowed

def _is_transient_unavailable_error(error: Exception) -> bool:
    message = str(error).lower()
    transient_markers = [
        "503",
        "unavailable",
        "high demand",
        "resource_exhausted",
        "rate limit",
        "temporarily",
    ]
    return any(marker in message for marker in transient_markers)


def _classify_model_error(error: Exception) -> str:
    """Classify model call failures into stable buckets for user-facing messages."""
    message = str(error).lower()

    auth_markers = [
        "api key not valid",
        "invalid api key",
        "permission denied",
        "unauthorized",
        "authentication",
        "forbidden",
        "401",
        "403",
    ]
    quota_markers = [
        "resource_exhausted",
        "quota",
        "rate limit",
        "429",
        "token",
        "billing",
        "insufficient_quota",
        "exceeded",
    ]
    connection_markers = [
        "503",
        "service unavailable",
        "unavailable",
        "connection",
        "network",
        "timed out",
        "timeout",
        "dns",
        "name resolution",
        "socket",
    ]

    if any(marker in message for marker in auth_markers):
        return "auth"
    if any(marker in message for marker in quota_markers):
        return "quota"
    if any(marker in message for marker in connection_markers):
        return "connection"
    return "unknown"


def _build_user_friendly_model_error(last_exception: Exception | None) -> str:
    """Return a clear error text to show in chatbot UI."""
    if last_exception is None:
        return "Không thể kết nối tới mô hình AI lúc này. Vui lòng thử lại sau ít phút."

    category = _classify_model_error(last_exception)
    raw_message = str(last_exception).strip()

    if category == "quota":
        return (
            "Hệ thống đang vượt giới hạn token/quota của dịch vụ AI hoặc bị giới hạn tốc độ. "
            "Vui lòng đợi một lúc rồi thử lại."
        )
    if category == "connection":
        return (
            "Không thể kết nối tới mô hình AI ở thời điểm hiện tại (dịch vụ tạm thời không khả dụng). "
            "Vui lòng thử lại sau."
        )
    if category == "auth":
        return (
            "Không thể xác thực với dịch vụ AI (API key không hợp lệ hoặc không có quyền). "
            "Vui lòng kiểm tra API key Gemini."
        )

    if raw_message:
        return f"Lỗi khi gọi mô hình AI: {raw_message}"
    return "Đã xảy ra lỗi không xác định khi gọi mô hình AI."

def _extract_source_from_context(context: str) -> str | None:
    # context is a JSON string of metadata; try structured parse first.
    if not context:
        return None
    try:
        data = json.loads(context)
        # data is usually a list[dict]
        if isinstance(data, list):
            for item in data:
                if not isinstance(item, dict):
                    continue
                for key in SOURCE_KEYS:
                    val = item.get(key)
                    if isinstance(val, str) and val.strip():
                        return val.strip()
        elif isinstance(data, dict):
            for key in SOURCE_KEYS:
                val = data.get(key)
                if isinstance(val, str) and val.strip():
                    return val.strip()
    except Exception:
        pass

    # Fallback: best-effort regex.
    return extract_source_from_text(context)

def generate_content(prompt, model_name=None, api_key=None):
    local_client = get_gemini_client(api_key)

    last_exception = None

    models_list = _build_models_list(model_name)

    for m in models_list:
        for attempt in range(1, MAX_MODEL_ATTEMPTS + 1):
            try:
                safe_print(f"Trying model: {m} (attempt {attempt}/{MAX_MODEL_ATTEMPTS})...")
                # Add a small delay to avoid hitting rate limits too quickly
                time.sleep(REQUEST_DELAY_SECONDS)
                response = local_client.models.generate_content(
                    model=m,
                    contents=prompt
                )
                return response.text.strip()
            except Exception as e:
                safe_print(f"Error generating content with model {m}: {e}")
                last_exception = e
                is_transient = _is_transient_unavailable_error(e)
                if is_transient and attempt < MAX_MODEL_ATTEMPTS:
                    backoff_seconds = RETRY_BACKOFF_BASE_SECONDS * attempt
                    safe_print(f"Transient error detected. Retrying in {backoff_seconds:.1f}s...")
                    time.sleep(backoff_seconds)
                    continue
                # Move to next model when retry exhausted or non-transient.
                break
    
    # If all models fail, raise a clear, user-friendly message for the UI.
    safe_print("All models failed.")
    raise RuntimeError(_build_user_friendly_model_error(last_exception)) from last_exception

def LLMs_calling(
    query: str,
    model_name: str = None,
    api_key: str = None,
    pinecone_api_key: str = None,
    pinecone_index_name: str = None,
    conversation_history: list[dict] | None = None,
):
    """
    Main RAG function
    """
    safe_print(f"--- Processing Query: {query} ---")
    safe_print("--- RAG Service Version: Fixed Formatting Issue ---")
    if model_name:
        safe_print(f"Using Model: {model_name}")
    if api_key:
        safe_print("Using Custom API Key")
    if conversation_history:
        safe_print(f"Conversation context turns received: {len(conversation_history)}")

    start_time = time.time()
    
    context = None
    requested_sections: list[str] = []
    allowed_headers: list[str] = ["Bệnh", "Định nghĩa", "Nguồn"]

    try:
        memory_answer = _answer_history_meta_query(query, conversation_history)
        if memory_answer is not None:
            safe_print("Answered by deterministic conversation-memory handler.")
            return memory_answer

        # 1. Rewrite Query
        safe_print("Rewriting query...")
        deterministic_rewrite = _rewrite_deictic_disease_query(query, conversation_history)
        if deterministic_rewrite:
            rewritten_query = deterministic_rewrite
            safe_print(f"Deterministic rewrite with history: {rewritten_query}")
        else:
            rewritten_query_prompt = _build_prompt_with_history(
                rewrite_prompt.format(query=query),
                conversation_history,
            )
            rewritten_query = generate_content(rewritten_query_prompt, model_name, api_key)
        safe_print(f"Rewritten Query: {rewritten_query}")

        # 2. Route Query
        safe_print("Routing query...")
        route_query_prompt = _build_prompt_with_history(
            route_prompt.format(query=rewritten_query),
            conversation_history,
        )
        route = generate_content(route_query_prompt, model_name, api_key).lower()
        safe_print(f"Route: {route}")

        # 3. & 4. Process based on category
        if "chest-diseases" in route:
            safe_print("Retrieving context...")
            try:
                context = retrieve_context(
                    rewritten_query,
                    pinecone_api_key=pinecone_api_key,
                    pinecone_index_name=pinecone_index_name,
                )
                
                # Check if context is empty or invalid
                if _is_empty_context(context):
                    safe_print("Warning: Empty context retrieved.")
                    return NO_CONTEXT_FALLBACK_ANSWER
                else:
                    requested_sections = detect_requested_sections(rewritten_query)
                    # If user doesn't specify, default to definition.
                    if not requested_sections:
                        requested_sections = ["Định nghĩa"]
                    template, allowed_headers = build_template_for_sections(requested_sections)
                    final_prompt = _build_prompt_with_history(
                        diseases_prompt.format(context=context, query=rewritten_query, template=template),
                        conversation_history,
                    )
            except Exception as e:
                safe_print(f"Error retrieving context: {e}")
                return NO_CONTEXT_FALLBACK_ANSWER
        elif "general" in route:
            final_prompt = _build_prompt_with_history(
                normal_chatting_prompt.format(query=query),
                conversation_history,
            )
        else:
            # Unknown or other
            final_prompt = _build_prompt_with_history(
                peripheral_prompt.format(query=query),
                conversation_history,
            )

        # Generate Final Answer
        safe_print("Generating final answer...")
        answer = generate_content(final_prompt, model_name, api_key)
        if not answer or not answer.strip():
            if "chest-diseases" in route:
                return NO_CONTEXT_FALLBACK_ANSWER
            answer = "Hiện tại hệ thống chưa có phản hồi phù hợp."

        looks_like_sections = _looks_like_medical_sections(answer)

        if ("chest-diseases" in route) or looks_like_sections:
            context_source = _extract_source_from_context(context) if context else None
            answer = post_process_answer(answer)

            # Always filter to the requested/allowed sections (default is Definition+Source).
            if not requested_sections:
                # Base decision on original user query as a fallback.
                requested_sections = detect_requested_sections(query) or ["Định nghĩa"]
                _, allowed_headers = build_template_for_sections(requested_sections)
            answer = filter_answer_to_sections(answer, allowed_headers)

            # Ensure source is always shown when possible.
            answer_source = extract_source_from_text(answer)
            answer = ensure_source_section(answer, answer_source or context_source)
        
        elapsed = time.time() - start_time
        safe_print(f"--- Finished in {elapsed:.2f}s ---")
        return answer

    except Exception as e:
        _append_error_log(
            "Error in LLMs_calling",
            traceback.format_exc(),
            query=query,
        )

        safe_print(f"Error in LLMs_calling: {e}")
        return f"Xin lỗi, hệ thống đang gặp sự cố: {str(e)}"
