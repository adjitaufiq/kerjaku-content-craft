import os
import sys
import time
import unittest
from unittest.mock import patch, Mock
from lease import LeaseHeartbeat, LeaseLost, native_lease_check
from media import command, synthesize
from runner import process_native_task


class LeaseTests(unittest.TestCase):
    def test_render_outlives_original_lease_without_duplicate_claim(self):
        deadline = time.monotonic() + .08
        renewals = []
        def renew():
            nonlocal deadline
            if time.monotonic() >= deadline:
                return False
            deadline = time.monotonic() + .08
            renewals.append(deadline)
            return True
        with LeaseHeartbeat(renew, interval=.01) as guard:
            for _ in range(20):
                time.sleep(.01)
                guard.check()
                self.assertLess(time.monotonic(), deadline)
        self.assertGreater(len(renewals), 3)
        self.assertFalse(guard.thread.is_alive())

    def test_stops_after_failure(self):
        guard = LeaseHeartbeat(lambda: True, interval=.01)
        with self.assertRaises(ValueError), guard:
            raise ValueError('render failed')
        self.assertFalse(guard.thread.is_alive())

    def test_cancelled_lease_stops_native_subprocess(self):
        calls = []
        def renew():
            calls.append(True)
            return len(calls) == 1
        with LeaseHeartbeat(renew, interval=.03) as guard:
            start = time.monotonic()
            with self.assertRaises(LeaseLost):
                command([sys.executable, '-c', 'import time; time.sleep(10)'])
            self.assertLess(time.monotonic() - start, 2)
        self.assertFalse(guard.thread.is_alive())

    def test_unknown_connection_fails_closed_before_render(self):
        with self.assertRaises(LeaseLost):
            with LeaseHeartbeat(Mock(side_effect=TimeoutError)):
                self.fail('must not render')

    def test_completion_is_not_replayed_if_acknowledgement_is_lost(self):
        import requests
        actions = []
        def post(*args, **kwargs):
            actions.append(kwargs['json']['action'])
            if actions[-1] == 'complete':
                raise requests.Timeout()
            return Mock(json=lambda: {'renewed': True})
        with patch.dict(os.environ, {'CRAFT_TTS_PROVIDER': 'edge_tts'}), patch('runner.requests.post', side_effect=post), patch('runner.run_native', return_value=[]):
            with self.assertRaises(requests.Timeout):
                process_native_task({'id': 'task'}, '', '', 'worker-a', {})
        self.assertEqual(actions, ['heartbeat', 'complete'])
        self.assertIsNone(native_lease_check.get()())

    def test_lease_loss_never_completes_or_reports_failure_for_reassigned_task(self):
        actions = []
        def post(*args, **kwargs):
            actions.append(kwargs['json']['action'])
            return Mock(json=lambda: {'renewed': True})
        with patch.dict(os.environ, {'CRAFT_TTS_PROVIDER': 'edge_tts'}), patch('runner.requests.post', side_effect=post), patch('runner.run_native', side_effect=LeaseLost):
            with self.assertRaises(LeaseLost):
                process_native_task({'id': 'task'}, '', '', 'worker-a', {})
        self.assertEqual(actions, ['heartbeat'])

    def test_unknown_voice_provider_is_not_silently_replaced(self):
        import tempfile
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {'CRAFT_TTS_PROVIDER': 'unconfigured'}), patch('media.synthesize_neural') as voice:
            with self.assertRaisesRegex(ValueError, 'Unsupported TTS provider'):
                synthesize('Mulai sekarang.', folder)
            voice.assert_not_called()


if __name__ == '__main__':
    unittest.main()