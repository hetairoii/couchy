import pytest

from app.agent.ollama import extract_json


def test_extract_json_from_fenced_text():
    assert extract_json('Sure!\n```json\n{"messages": ["hi"]}\n```') == {"messages": ["hi"]}


def test_extract_json_raises_without_object():
    with pytest.raises(ValueError):
        extract_json("no json here")
