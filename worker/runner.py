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
from media import synthesize, metadata, probe
from design import design_bundle
from production import render_storyboard, original_bgm
from PIL import Image
from lease import LeaseHeartbeat, LeaseLost, native_lease_check


def validate_native_file(file, upload, content, voice_duration=None):
    """Validate decoded native outputs before uploading; server separately reads checksums back."""
    if not file.is_file() or file.stat().st_size == 0:
        raise ValueError("Native output missing")
    if upload["kind"] == "image":
        with Image.open(file) as image:
            image.load()
            if image.size != (1080, 1350):
                raise ValueError("Poster/carousel dimensions invalid")
        return None
    if upload["kind"] in ("voice", "video"):
        info = probe(file)
        streams = {stream["codec_type"]: stream for stream in info["streams"]}
        duration = float(info["format"]["duration"])
        if upload["kind"] == "voice" and streams.get("audio", {}).get("codec_name") != "mp3":
            raise ValueError("Voice output is not MP3")
        if upload["kind"] == "video":
            video = streams.get("video", {})
            if (video.get("codec_name"), video.get("width"), video.get("height"), video.get("r_frame_rate")) != ("h264", 1080, 1920, "30/1") or streams.get("audio", {}).get("codec_name") != "aac":
                raise ValueError("Video output violates production format")
            if voice_duration is None or abs(duration - voice_duration) > 1:
                raise ValueError("Video and voice duration mismatch")
        return duration
    if file.name == "alignment.json":
        alignment = json.loads(file.read_text())
        words = alignment["words"]
        if not words or any(word["end"] <= word["start"] for word in words):
            raise ValueError("Word alignment invalid")
        if " ".join(content["production"]["voiceOver"].split()) != " ".join(scene["narration"] for scene in json.loads(content["production"]["scenes"])):
            raise ValueError("Narration contract mismatch")
    if file.suffix in (".ass", ".srt", ".vtt") and not file.read_text().strip():
        raise ValueError("Subtitle empty")
    return None


def safe_download(url, path, allowed_origin):
    native_lease_check.get()()
    target = urlparse(url)
    if target.scheme != "https" or target.netloc != urlparse(allowed_origin).netloc:
        raise ValueError("Media origin not authorized")
    with requests.get(url, timeout=120, stream=True, allow_redirects=False) as response:
        response.raise_for_status()
        size = 0
        with open(path, "wb") as file:
            for chunk in response.iter_content(65536):
                native_lease_check.get()()
                size += len(chunk)
                if size > 100 * 1024 * 1024:
                    raise ValueError("Media download too large")
                file.write(chunk)


def run_native(task, storage_origin):
    native_lease_check.get()()
    with tempfile.TemporaryDirectory(prefix="craft-") as folder:
        folder = Path(folder)
        duration = None
        if task["stage"] == "voice":
            settings = task["config"]["voice"]
            duration = synthesize(task["content"]["production"]["voiceOver"], folder, persona=settings["persona"], speed=settings["speed"], voice=task["content"]["production"].get("automation", {}).get("voice"))["duration"]
        elif task["stage"] in ("design", "render"):
            images = []
            voice = None
            subtitle = None
            alignment = None
            for index, asset in enumerate(task["inputs"]):
                file = folder / f"input-{index}{Path(asset['path']).suffix}"
                safe_download(asset["url"], file, storage_origin)
                if file.stat().st_size != asset["bytes"] or metadata(file, asset["kind"], asset["mime"], asset["path"])["checksum"] != asset["checksum"]:
                    raise ValueError("Input media checksum mismatch")
                if asset["kind"] == "image" and Path(asset["path"]).name.startswith("scene-"):
                    images.append(file)
                elif asset["kind"] == "voice":
                    voice = file
                elif asset["path"].endswith(".ass"):
                    subtitle = file
                elif asset["path"].endswith("alignment.json"):
                    alignment = file
            if task["stage"] == "design":
                design_bundle(task["content"], images, folder, task["formats"], task["config"]["slides"])
            elif not voice or not subtitle or not alignment:
                raise ValueError("Voice and subtitle not available")
            else:
                duration = float(probe(voice)["format"]["duration"])
                original_bgm(folder / "bgm.wav", duration, task["content"]["production"].get("automation", {}).get("bgm", "lofi"))
                info = render_storyboard(task["content"], images, voice, subtitle, alignment, folder / "video.mp4", folder / "bgm.wav")
                duration = float(info["format"]["duration"])
        else:
            raise ValueError("Unsupported native task")
        assets = []
        for upload in task["uploads"]:
            native_lease_check.get()()
            if urlparse(upload["url"]).scheme != "https" or urlparse(upload["url"]).netloc != urlparse(storage_origin).netloc:
                raise ValueError("Upload origin mismatch")
            if Path(upload["filename"]).name != upload["filename"]:
                raise ValueError("Unsafe upload filename")
            file = folder / upload["filename"]
            measured = validate_native_file(file, upload, task["content"], duration)
            with open(file, "rb") as body:
                response = requests.put(upload["url"], data=body, headers={"Content-Type": upload["mime"]}, timeout=180, allow_redirects=False)
            response.raise_for_status()
            assets.append(metadata(file, upload["kind"], upload["mime"], upload["path"], measured))
        return assets


def process_native_task(task, storage_origin, endpoint, worker_id, headers):
    if os.environ.get("CRAFT_TTS_PROVIDER", "edge_tts") != "edge_tts":
        raise ValueError("Hosted worker requires neural speech; test adapters are local-only")
    def renew():
        response = requests.post(endpoint, json={"action": "heartbeat", "worker": worker_id,
                                 "taskId": task["id"]}, headers=headers, timeout=15)
        response.raise_for_status()
        return response.json().get("renewed") is True

    with LeaseHeartbeat(renew) as heartbeat:
        try:
            assets = run_native(task, storage_origin)
            heartbeat.check()
        except LeaseLost:
            raise
        except Exception as error:
            heartbeat.check()
            # Persist a known local failure once; never retry a failed acknowledgement.
            requests.post(endpoint, json={"action": "fail", "worker": worker_id,
                          "taskId": task["id"], "error": type(error).__name__},
                          headers=headers, timeout=30).raise_for_status()
            return
        # Keep heartbeat alive during checksum readback/ack; stop on every exit path.
        requests.post(endpoint, json={"action": "complete", "worker": worker_id,
                      "taskId": task["id"], "assets": assets},
                      headers=headers, timeout=180).raise_for_status()


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
                process_native_task(task, storage_origin, endpoint, worker_id, headers)
            if result.get("blocked"):
                print(json.dumps({"event": "factory_blocked", "action": "inspect persisted task"}), flush=True)
            if result.get("idle"):
                time.sleep(10)
        except (requests.RequestException, LeaseLost):
            print(json.dumps({"event": "worker_connection_lost", "action": "do not replay; reconcile lease"}), flush=True)
            time.sleep(30)


if __name__ == "__main__":
    main()