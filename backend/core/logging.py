import logging
import io


async def configure_logging_utf8():
    for log_name in ("", "uvicorn", "uvicorn.access", "uvicorn.error", "fastapi"):
        logger = logging.getLogger(log_name)
        for handler in list(logger.handlers):
            stream = getattr(handler, "stream", None)
            if stream is None:
                continue
            if hasattr(stream, "reconfigure"):
                try:
                    stream.reconfigure(encoding="utf-8", errors="backslashreplace")
                except Exception:
                    pass
            elif hasattr(stream, "buffer"):
                try:
                    handler.stream = io.TextIOWrapper(
                        stream.buffer,
                        encoding="utf-8",
                        errors="backslashreplace",
                        line_buffering=True,
                    )
                except Exception:
                    pass

