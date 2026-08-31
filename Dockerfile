FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir fastapi "uvicorn[standard]" pydantic

COPY . /app

ENV PORT=8080
EXPOSE 8080

CMD ["python", "server.py"]
