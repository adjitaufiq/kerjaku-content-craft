import asyncio
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from neural_voice import synthesize_neural


class NeuralContracts(unittest.TestCase):
    def test_word_boundaries_are_actual_provider_events(self):
        class Speech:
            def __init__(self, text, voice, **kwargs):
                self.voice = voice
                if kwargs['boundary'] != 'WordBoundary':
                    raise ValueError('word boundaries required')
            async def stream(self):
                yield {'type': 'audio', 'data': b'fixture audio'}
                yield {'type': 'WordBoundary', 'text': 'Mulai', 'offset': 2_000_000, 'duration': 3_000_000}
                yield {'type': 'WordBoundary', 'text': 'sekarang', 'offset': 7_000_000, 'duration': 4_000_000}
        with tempfile.TemporaryDirectory() as folder, patch('neural_voice.edge_tts.Communicate', Speech):
            words, voice = synthesize_neural('Mulai sekarang.', Path(folder, 'voice.mp3'), 'id', 'female', 165)
            self.assertEqual(voice, 'id-ID-GadisNeural')
            self.assertEqual(words[0]['start'], .2)
            self.assertEqual(words[1]['end'], 1.1)
            self.assertEqual(words[1]['offset'], 6)

    def test_provider_failure_never_falls_back_to_robotic_voice(self):
        with tempfile.TemporaryDirectory() as folder, patch('neural_voice.edge_tts.Communicate', side_effect=RuntimeError('unavailable')):
            with self.assertRaisesRegex(RuntimeError, 'unavailable'):
                synthesize_neural('Mulai sekarang.', Path(folder, 'voice.mp3'), 'id', 'male', 165)

    def test_unknown_word_is_held_not_assigned_fake_timing(self):
        class Speech:
            def __init__(self, *args, **kwargs): pass
            async def stream(self):
                yield {'type': 'audio', 'data': b'audio'}
                yield {'type': 'WordBoundary', 'text': 'different', 'offset': 0, 'duration': 1}
        with tempfile.TemporaryDirectory() as folder, patch('neural_voice.edge_tts.Communicate', Speech):
            with self.assertRaisesRegex(RuntimeError, 'mapped'):
                synthesize_neural('Mulai sekarang.', Path(folder, 'voice.mp3'), 'id', 'female', 165)


if __name__ == '__main__': unittest.main()
