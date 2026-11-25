"""Durable app queue consumer. Credentials live only in worker environment.
No browser is required. Unknown requests are not replayed.
"""
import json
import os
import tempfile
import time
import uuid
from pathlib import Path
from urllib.parse import urlparse
import requests
from media import synthesize, compose, metadata


def safe_download(url, path, allowed_origin):
    target = urlparse(url)
    if target.scheme != "https" or target.netloc != urlparse(allowed_origin).netloc:
        raise ValueError("Media origin not authorized")
    with requests.get(url, timeout=120, stream=True, allow_redirects=False) as response:
        response.raise_for_status()
        size = 0
        with open(path, "wb") as file:
            for chunk in response.iter_content(65536):
                size += len(chunk)
                if size > 100 * 1024 * 1024:
                    raise ValueError("Media download too large")
                file.write(chunk)


def run_native(task, storage_origin):
    with tempfile.TemporaryDirectory(prefix="craft-") as folder:
        folder = Path(folder)
        duration = None
        if task["stage"] == "voice":
            duration = synthesize(task["content"]["production"]["voiceOver"], folder)["duration"]
        elif task["stage"] == "render":
            images = []
            voice = None
            subtitle = None
            for index, asset in enumerate(task["inputs"]):
                file = folder / f"input-{index}{Path(asset['path']).suffix}"
                safe_download(asset["url"], file, storage_origin)
                if asset["kind"] == "image":
                    images.append(file)
                elif asset["kind"] == "voice":
                    voice = file
                elif asset["path"].endswith(".srt"):
                    subtitle = file
            if not voice or not subtitle:
                raise ValueError("Voice and subtitle not available")
            info = compose(images, voice, subtitle, folder / "video.mp4")
            duration = float(info["format"]["duration"])
        else:
            raise ValueError("Unsupported native task")
        assets = []
        for upload in task["uploads"]:
            if urlparse(upload["url"]).netloc != urlparse(storage_origin).netloc:
                raise ValueError("Upload origin mismatch")
            file = folder / upload["filename"]
            with open(file, "rb") as body:
                response = requests.put(upload["url"], data=body, headers={"Content-Type": upload["mime"]}, timeout=180, allow_redirects=False)
            response.raise_for_status()
            assets.append(metadata(file, upload["kind"], upload["mime"], upload["path"], duration if upload["kind"] in ("voice", "video") else None))
        return assets


def main():
    origin = os.environ["CRAFT_APP_ORIGIN"].rstrip("/")
    storage_origin = os.environ["CRAFT_STORAGE_ORIGIN"]
    secret = os.environ["CRAFT_WORKER_SECRET"]
    if urlparse(origin).scheme != "https":
        raise ValueError("Production worker requires HTTPS")
    endpoint = origin + "/api/public/factory/worker"
    worker_id = str(uuid.uuid4())
    headers = {"Authorization": "Bearer " + secret}
    while True:
        try:
            response = requests.post(endpoint, json={"action": "claim", "worker": worker_id}, headers=headers, timeout=1800)
            if response.status_code in (401, 403):
                raise RuntimeError("Worker authorization denied; stop until credentials restored")
            response.raise_for_status()
            result = response.json()
            task = result.get("task")
            if task:
                try:
                    assets = run_native(task, storage_origin)
                except Exception as error:
                    requests.post(endpoint, json={"action": "fail", "worker": worker_id, "taskId": task["id"], "error": type(error).__name__}, headers=headers, timeout=30).raise_for_status()
                    continue
                # If acknowledgement is lost, never regenerate; durable lease is quarantined by the app.
                complete = requests.post(endpoint, json={"action": "complete", "worker": worker_id, "taskId": task["id"], "assets": assets}, headers=headers, timeout=180)
                complete.raise_for_status()
            if result.get("blocked"):
                print(json.dumps({"event": "factory_blocked", "action": "inspect persisted task"}), flush=True)
            if result.get("idle"):
                time.sleep(10)
        except requests.RequestException:
            print(json.dumps({"event": "worker_connection_lost", "action": "do not replay; reconcile lease"}), flush=True)
            time.sleep(30)


if __name__ == "__main__":
    main()