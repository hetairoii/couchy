"""Loads the Gemma prompts from docs/prompts.md ('## NAME' followed by a fenced block)."""
import re
from functools import lru_cache
from pathlib import Path

PROMPTS_FILE = Path(__file__).resolve().parents[3] / "docs" / "prompts.md"


@lru_cache
def load_prompts() -> dict[str, str]:
    text = PROMPTS_FILE.read_text(encoding="utf-8")
    pattern = re.compile(r"^## (\w+)\s+```\n(.*?)\n```", re.S | re.M)
    return {m.group(1): m.group(2) for m in pattern.finditer(text)}


def render(name: str, **values) -> str:
    return load_prompts()[name].format(**values)
