"""TEST ONLY. Execute the unchanged native consumer with local signed-storage fixtures.
No hosted accounts, credentials or production queue is connected here.
"""
import argparse
import json
from pathlib import Path
from urllib.parse import unquote, urlparse
from unittest.mock import patch
from runner import run_native


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("task")
    parser.add_argument("storage")
    parser.add_argument("result")
    args = parser.parse_args()
    root = Path(args.storage).resolve()

    def locate(url):
        path = unquote(urlparse(url).path)
        for prefix in ("/storage/v1/object/sign/", "/storage/v1/object/upload/sign/"):
            if path.startswith(prefix):
                target = (root / path[len(prefix):]).resolve()
                if not target.is_relative_to(root):
                    raise ValueError("Fixture storage path escaped root")
                return target
        raise ValueError("Unexpected storage URL")

    class Response:
        def __init__(self, path):
            self.path = path
        def __enter__(self):
            return self
        def __exit__(self, *args):
            return False
        def raise_for_status(self):
            if not self.path.is_file():
                raise FileNotFoundError(self.path.name)
        def iter_content(self, chunk_size):
            with self.path.open("rb") as file:
                while chunk := file.read(chunk_size):
                    yield chunk

    def get(url, **kwargs):
        return Response(locate(url))

    def put(url, data, **kwargs):
        file = locate(url)
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_bytes(data.read())
        return Response(file)

    with patch("runner.requests.get", get), patch("runner.requests.put", put):
        assets = run_native(json.loads(Path(args.task).read_text()), "https://storage.fixture.invalid")
    Path(args.result).write_text(json.dumps(assets))


if __name__ == "__main__":
    main()