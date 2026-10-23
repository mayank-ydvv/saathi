import io

from backend.escalation.voice import FALLBACK_KEY, Voice, audio_key

TEXT = "Good morning Kamala, are you okay? Please press the green button."


class FakePolly:
    def __init__(self, fail=False):
        self.calls = []
        self.fail = fail

    def synthesize_speech(self, **kwargs):
        self.calls.append(kwargs)
        if self.fail:
            raise RuntimeError("AccessDenied")
        return {"AudioStream": io.BytesIO(b"ID3fake-mp3")}


def test_polly_called_once_then_cached(store):
    polly = FakePolly()
    voice = Voice(store, polly=polly)
    url = voice.audio_url(TEXT)
    assert url.endswith(audio_key(TEXT)) and voice.audio_url(TEXT) == url
    assert len(polly.calls) == 1
    assert polly.calls[0] == {
        "Text": TEXT,
        "OutputFormat": "mp3",
        "VoiceId": "Kajal",
        "Engine": "neural",
        "LanguageCode": "en-IN",
    }
    assert store.get_blob(audio_key(TEXT)) == (b"ID3fake-mp3", "audio/mpeg")


def test_stored_audio_is_reused_across_processes(store):
    Voice(store, polly=FakePolly()).audio_url(TEXT)
    polly = FakePolly()
    Voice(store, polly=polly).audio_url(TEXT)
    assert polly.calls == []


def test_polly_failure_serves_fallback_clip(store):
    url = Voice(store, polly=FakePolly(fail=True)).audio_url(TEXT)
    assert url.endswith(FALLBACK_KEY)
    data, content_type = store.get_blob(FALLBACK_KEY)
    assert content_type == "audio/mp4" and len(data) > 1000


def test_a_fresh_url_every_time_because_presigned_links_expire(store, monkeypatch):
    """H7: only the blob key is cached; each request gets a newly signed URL."""
    voice = Voice(store, polly=FakePolly())
    voice.ensure(TEXT)  # synthesise and store the clip first
    issued = iter(["https://s3/one?sig=1", "https://s3/one?sig=2"])
    monkeypatch.setattr(store, "blob_url", lambda key: next(issued))
    assert voice.audio_url(TEXT) == "https://s3/one?sig=1"
    assert voice.audio_url(TEXT) == "https://s3/one?sig=2"
