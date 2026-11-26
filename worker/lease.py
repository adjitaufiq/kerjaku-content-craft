"""Fail-closed native lease guard. Renewals never replay production requests."""
import threading
import time
from contextvars import ContextVar

native_lease_check = ContextVar("native_lease_check", default=lambda: None)


class LeaseLost(RuntimeError):
    pass


class LeaseHeartbeat:
    def __init__(self, renew, interval=30):
        self.renew = renew
        self.interval = interval
        self.stopped = threading.Event()
        self.lost = threading.Event()
        self.thread = None

    def _renew(self):
        try:
            if not self.renew():
                self.lost.set()
        except Exception:
            # Unknown renewal/connection state is not permission to keep uploading.
            self.lost.set()

    def _run(self):
        while not self.stopped.wait(self.interval):
            self._renew()
            if self.lost.is_set():
                return

    def check(self):
        if self.lost.is_set():
            raise LeaseLost("Lease unavailable; hold output and reconcile, never replay")

    def __enter__(self):
        self._renew()  # Verify ownership/cancellation before starting expensive work.
        self.check()
        self.thread = threading.Thread(target=self._run, name="craft-heartbeat", daemon=True)
        self.thread.start()
        self.token = native_lease_check.set(self.check)
        return self

    def __exit__(self, *args):
        self.stopped.set()
        if self.thread:
            self.thread.join()  # HTTP renew is bounded; no surviving task heartbeat.
        native_lease_check.reset(self.token)