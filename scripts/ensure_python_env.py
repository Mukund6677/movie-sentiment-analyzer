#!/usr/bin/env python3
"""Create the project Python environment and preload NLTK's VADER lexicon."""
from pathlib import Path
import subprocess
import sys
import venv

ROOT = Path(__file__).resolve().parents[1]
VENV = ROOT / ".venv"
PYTHON = VENV / ("Scripts" if sys.platform == "win32" else "bin") / ("python.exe" if sys.platform == "win32" else "python")


def run(*args: str) -> None:
    subprocess.run(args, cwd=ROOT, check=True)


def main() -> None:
    if not PYTHON.exists():
        print(f"[python] Creating {VENV}")
        venv.EnvBuilder(with_pip=True, clear=False).create(VENV)

    run(str(PYTHON), "-m", "pip", "install", "--disable-pip-version-check", "-r", "requirements.txt")
    run(
        str(PYTHON),
        "-c",
        "import nltk; nltk.download('vader_lexicon', quiet=True)",
    )
    print(f"[python] Ready: {PYTHON}")


if __name__ == "__main__":
    main()
