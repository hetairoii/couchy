import os
from pathlib import Path


def _load_dotenv() -> None:
    env = Path(__file__).resolve().parent.parent / ".env"
    if not env.exists():
        return
    for line in env.read_text().splitlines():
        line = line.split("#", 1)[0].strip()
        if "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


_load_dotenv()


class Settings:
    ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434")
    ollama_model = os.getenv("OLLAMA_MODEL", "gemma3:4b")
    voice_provider = os.getenv("VOICE_PROVIDER", "elevenlabs")
    elevenlabs_key = os.getenv("ELEVENLABS_API_KEY", "")
    telegram_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    telegram_username = os.getenv("TELEGRAM_BOT_USERNAME", "CouchyBot")
    data_dir = Path(os.getenv("DATA_DIR", "./data"))


settings = Settings()
