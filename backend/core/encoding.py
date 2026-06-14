import io
import os
import sys


def configure_utf8_stdio():
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    os.environ.setdefault("PYTHONUTF8", "1")
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
        sys.stderr.reconfigure(encoding="utf-8", errors="backslashreplace")
    except Exception:
        try:
            if hasattr(sys.stdout, "buffer"):
                sys.stdout = io.TextIOWrapper(
                    sys.stdout.buffer,
                    encoding="utf-8",
                    errors="backslashreplace",
                    line_buffering=True,
                )
            if hasattr(sys.stderr, "buffer"):
                sys.stderr = io.TextIOWrapper(
                    sys.stderr.buffer,
                    encoding="utf-8",
                    errors="backslashreplace",
                    line_buffering=True,
                )
        except Exception:
            pass


def safe_print(*args, **kwargs):
    try:
        print(*args, **kwargs)
    except UnicodeEncodeError:
        try:
            msg = " ".join(str(a) for a in args)
            end = kwargs.get("end", "\n")
            sys.stdout.buffer.write((msg + end).encode("utf-8", errors="backslashreplace"))
        except Exception:
            pass

