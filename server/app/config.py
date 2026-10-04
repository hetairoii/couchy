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
    # ollama | google  (google = Gemma served by the Google AI Studio API, free tier, no card)
    llm_provider = os.getenv("LLM_PROVIDER", "ollama")
    google_api_key = os.getenv("GOOGLE_API_KEY", "")
    google_model = os.getenv("GOOGLE_MODEL", "gemma-3-27b-it")
    database_url = os.getenv("DATABASE_URL", "")
    voice_provider = os.getenv("VOICE_PROVIDER", "elevenlabs")
    elevenlabs_key = os.getenv("ELEVENLABS_API_KEY", "")
    elevenlabs_stt_model = os.getenv("ELEVENLABS_STT_MODEL", "scribe_v1")
    telegram_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    telegram_username = os.getenv("TELEGRAM_BOT_USERNAME", "CouchyBot")
    data_dir = Path(os.getenv("DATA_DIR", "./data"))


settings = Settings()
