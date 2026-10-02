FROM python:3.12-slim
WORKDIR /srv
COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY server/ ./server/
COPY docs/ ./docs/
WORKDIR /srv/server
ENV DATA_DIR=/data
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
