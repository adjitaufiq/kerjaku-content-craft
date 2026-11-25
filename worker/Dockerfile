FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg espeak-ng fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
WORKDIR /worker
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY media.py runner.py word_alignment.py design.py production.py ./
RUN useradd --create-home worker
USER worker
CMD ["python", "-u", "runner.py"]