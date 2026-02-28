import re


_CANONICAL_HEADERS = (
    "Bệnh",
    "Định nghĩa",
    "Nguyên nhân",
    "Triệu chứng",
    "Biện pháp phòng ngừa",
    "Biện pháp phòng tránh",
    "Nguồn",
)


def _canonicalize_allowed_headers(allowed_headers: list[str] | set[str] | tuple[str, ...] | None) -> set[str]:
    if not allowed_headers:
        return set()
    normalized = set()
    for header in allowed_headers:
        header_stripped = str(header).strip()
        if not header_stripped:
            continue
        normalized.add(header_stripped)
    return normalized


def filter_answer_to_sections(text: str, allowed_headers: list[str] | set[str] | tuple[str, ...]) -> str:
    """Keep only specified sections (plus their bodies) from a formatted answer.

    Assumes input is already reasonably normalized by `post_process_answer`.
    """
    if not text:
        return ""

    allowed = _canonicalize_allowed_headers(allowed_headers)
    if not allowed:
        return text.strip()

    processed = text

    # Treat "Biện pháp phòng tránh" as equivalent to "Biện pháp phòng ngừa".
    if "Biện pháp phòng ngừa" in allowed:
        allowed.add("Biện pháp phòng tránh")
    if "Biện pháp phòng tránh" in allowed:
        allowed.add("Biện pháp phòng ngừa")

    # Capture prompt-style disease header, bold headers, and plain headers.
    header_alt = "|".join(re.escape(h) for h in _CANONICAL_HEADERS)
    header_re = re.compile(
        rf"(?im)^(###\s*Bệnh\s*:\s*.*)$"
        rf"|^\s*\*\*\s*({header_alt})\s*:\s*\*\*\s*(.*)$"
        rf"|^\s*({header_alt})\s*:\s*(.*)$"
    )

    lines = processed.splitlines()
    blocks: list[tuple[str, list[str]]] = []
    current_header: str | None = None
    current_lines: list[str] = []

    def flush():
        nonlocal current_header, current_lines
        if current_header is not None:
            blocks.append((current_header, current_lines))
        current_header = None
        current_lines = []

    for line in lines:
        m = header_re.match(line)
        if m:
            # Start a new block
            flush()

            if m.group(1):
                # "### Bệnh: ..." style
                current_header = "Bệnh"
                current_lines = [m.group(1).rstrip()]
                continue

            # Bold form groups: (2)=header, (3)=trailing
            # Plain form groups: (4)=header, (5)=trailing
            header_name = ((m.group(2) or m.group(4)) or "").strip()
            trailing = ((m.group(3) or m.group(5)) or "").rstrip()
            current_header = header_name
            if trailing:
                current_lines = [f"**{header_name}:** {trailing}".rstrip()]
            else:
                current_lines = [f"**{header_name}:**".rstrip()]
            continue

        if current_header is None:
            # Ignore any preamble outside sections.
            continue
        current_lines.append(line.rstrip())

    flush()

    kept: list[str] = []
    for header, block_lines in blocks:
        if header in allowed:
            # Trim leading/trailing blank lines inside block
            while block_lines and not block_lines[0].strip():
                block_lines.pop(0)
            while block_lines and not block_lines[-1].strip():
                block_lines.pop()
            if block_lines:
                kept.append("\n".join(block_lines).strip())

    return "\n\n".join([k for k in kept if k.strip()]).strip()


def extract_source_from_text(text: str) -> str | None:
    """Best-effort extraction of a source from either answer or context."""
    if not text:
        return None
    # Prefer explicit markdown-style source line.
    m = re.search(r"(?im)^\s*\*\*\s*Nguồn\s*:\s*\*\*\s*(.+?)\s*$", text)
    if m:
        return m.group(1).strip() or None
    m = re.search(r"(?im)^\s*Nguồn\s*:\s*(.+?)\s*$", text)
    if m:
        return m.group(1).strip() or None
    return None


def ensure_source_section(text: str, source: str | None) -> str:
    """Ensure the answer contains a **Nguồn:** section.

    If missing but `source` is provided, append it.
    """
    if not text:
        return ""
    if re.search(r"(?im)^\s*\*\*\s*Nguồn\s*:\s*\*\*", text):
        return text.strip()
    if not source:
        return text.strip()
    return (text.strip() + f"\n\n**Nguồn:** {source.strip()}").strip()


def post_process_answer(text: str) -> str:
    """Post-process LLM output to enforce readable section breaks.

    This is a defensive formatter: even if the model returns everything on one line,
    we insert paragraph breaks before known section headers.
    """
    if not text:
        return ""

    processed = text

    # 1) Clean up common LLM artifacts that break Markdown rendering.
    # Some models emit standalone "**" on its own line, which creates odd formatting.
    processed = re.sub(r"^\s*\*\*\s*$", "", processed, flags=re.MULTILINE)

    # Some models emit standalone numbered markers like "**1." on its own line.
    processed = re.sub(r"^\s*\*\*\s*\d+\s*\.\s*$", "", processed, flags=re.MULTILINE)
    processed = re.sub(r"^\s*\*\*\s*\d+\s*\.\s*$", "", processed, flags=re.MULTILINE)
    # Also handle cases like "**1." without trailing spaces.
    processed = re.sub(r"^\s*\*\*\d+\s*\.\s*$", "", processed, flags=re.MULTILINE)

    # 2) Normalize broken section headers.
    # Examples we handle:
    # - "Định nghĩa:** <text>"   -> "**Định nghĩa:** <text>"
    # - "Bệnh: <text>"          -> "**Bệnh:** <text>"
    # - "[Nguồn]:** <text>"     -> "**Nguồn:** <text>"
    header_names = (
        "Bệnh",
        "Định nghĩa",
        "Nguyên nhân",
        "Triệu chứng",
        "Biện pháp phòng ngừa",
        "Biện pháp phòng tránh",
        "Nguồn",
    )
    header_alt = "|".join(re.escape(h) for h in header_names)

    # Bracketed forms: [Header]:** ...  OR [Header]: ...
    processed = re.sub(
        rf"(?i)\[\s*({header_alt})\s*\]\s*:\s*\*\*\s*",
        r"**\1:** ",
        processed,
    )
    processed = re.sub(
        rf"(?i)\[\s*({header_alt})\s*\]\s*:\s*",
        r"**\1:** ",
        processed,
    )
    processed = re.sub(
        rf"(?im)^\s*\[\s*({header_alt})\s*\]\s*:\s*\*\*\s*",
        r"**\1:** ",
        processed,
    )
    processed = re.sub(
        rf"(?im)^\s*\[\s*({header_alt})\s*\]\s*:\s*",
        r"**\1:** ",
        processed,
    )

    # Plain forms: Header:** ...  OR Header: ...
    processed = re.sub(
        rf"(?im)^\s*({header_alt})\s*:\s*\*\*\s*",
        r"**\1:** ",
        processed,
    )
    processed = re.sub(
        rf"(?im)^\s*({header_alt})\s*:\s*",
        r"**\1:** ",
        processed,
    )

    # Numbered forms at line start: "1. Định nghĩa:" -> "**Định nghĩa:**"
    processed = re.sub(
        rf"(?im)^\s*\d+\s*\.\s*({header_alt})\s*:\s*\*\*\s*",
        r"**\1:** ",
        processed,
    )
    processed = re.sub(
        rf"(?im)^\s*\d+\s*\.\s*({header_alt})\s*:\s*",
        r"**\1:** ",
        processed,
    )

    # If the model outputs something like "Định nghĩa:**" mid-paragraph, normalize that too.
    # IMPORTANT: avoid matching inside an already-bold header "**Định nghĩa:**".
    processed = re.sub(
        rf"(?i)(?<!\*\*)\b({header_alt})\s*:\s*\*\*\s*",
        r"**\1:** ",
        processed,
    )

    # 3) Normalize excessive blank lines.
    processed = re.sub(r"\n{3,}", "\n\n", processed)

    # 4) Insert paragraph breaks before canonical headers only.
    # IMPORTANT: Do NOT include plain "Bệnh:" markers here, because they can match inside
    # already-bolded "**Bệnh:**" and leave stray "**" in the output.
    markers = [
        r"###\s*Bệnh\s*:",
        r"\*\*Bệnh:\*\*",
        r"\*\*Định nghĩa:\*\*",
        r"\*\*Nguyên nhân:\*\*",
        r"\*\*Triệu chứng:\*\*",
        r"\*\*Biện pháp phòng ngừa:\*\*",
        r"\*\*Biện pháp phòng tránh:\*\*",
        r"\*\*Nguồn:\*\*",
    ]

    for marker in markers:
        # Insert paragraph breaks before each marker.
        # We intentionally eat any preceding whitespace so we don't accumulate spaces.
        processed = re.sub(r"(\s*)({marker})".format(marker=marker), r"\n\n\2", processed, flags=re.IGNORECASE)

    # Normalize excessive blank lines.
    processed = re.sub(r"\n{3,}", "\n\n", processed)
    return processed.strip()
