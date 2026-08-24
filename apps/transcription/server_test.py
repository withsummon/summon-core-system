import unittest
from types import SimpleNamespace

from server import transcribe_file


class FakeModel:
    def transcribe(self, path, **options):
        self.path = path
        self.options = options
        return (
            iter(
                [
                    SimpleNamespace(start=0.0, text=" Selamat pagi. "),
                    SimpleNamespace(start=65.2, text=" Keputusan disetujui. "),
                ]
            ),
            SimpleNamespace(language="id"),
        )


class TranscriptionTest(unittest.TestCase):
    def test_transcription_preserves_timestamps_and_uses_indonesian_prompt(self):
        model = FakeModel()

        result = transcribe_file(model, "/tmp/meeting.m4a")

        self.assertEqual(
            result,
            {
                "text": "[00:00:00] Selamat pagi.\n[00:01:05] Keputusan disetujui.",
                "language": "id",
            },
        )
        self.assertEqual(model.path, "/tmp/meeting.m4a")
        self.assertEqual(model.options["beam_size"], 5)
        self.assertTrue(model.options["vad_filter"])


if __name__ == "__main__":
    unittest.main()
