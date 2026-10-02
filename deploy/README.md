# Deploying Couchy on DigitalOcean

1. **Create a Droplet** — Ubuntu 24.04, **8 GB RAM** (enough for `gemma3:4b` on CPU; use 4 GB with `OLLAMA_MODEL=gemma3:1b`).
   For a faster demo you can use a GPU Droplet with the Gemma 1-Click Model and point `OLLAMA_URL` at it instead of the `ollama` service.
2. **Install Docker**: `curl -fsSL https://get.docker.com | sh`
3. **Clone and configure**
   ```bash
   git clone <your-repo-url> couchy && cd couchy/deploy
   cp .env.example .env     # set DOMAIN (e.g. 203-0-113-10.sslip.io), ELEVENLABS_API_KEY, TELEGRAM_BOT_TOKEN
   ```
4. **Start**: `docker compose up -d --build` (the first start downloads the Gemma model; watch with `docker compose logs -f ollama`).
5. **Check**: `curl https://$DOMAIN/health`
6. **Point the app at it**: build the APK with `EXPO_PUBLIC_API_URL=https://$DOMAIN` (see `mobile/eas.json`, profile `preview`).

Voice fallback: set `VOICE_PROVIDER=piper` to keep every byte on your own server (requires the `piper` binary in the API image).
