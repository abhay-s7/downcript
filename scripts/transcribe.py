import json
import multiprocessing
import sys

from faster_whisper import WhisperModel, decode_audio


def main():
    audio_path = sys.argv[1]

    base_model = WhisperModel("base", device="cpu", compute_type="int8")
    audio = decode_audio(audio_path)
    language, _prob, _all_probs = base_model.detect_language(audio=audio)

    # The "base" model unreliably mistranslates Hindi speech to English
    # regardless of task/language settings; "small" transcribes it correctly.
    model = WhisperModel("small", device="cpu", compute_type="int8") if language == "hi" else base_model
    segments, _info = model.transcribe(audio_path, language=language, task="transcribe")

    result = [
        {
            "text": segment.text.strip(),
            "start": segment.start,
            "duration": segment.end - segment.start,
        }
        for segment in segments
    ]

    print(json.dumps(result))


if __name__ == "__main__":
    # Required so a PyInstaller-frozen build of this script can correctly
    # re-exec itself for the worker processes faster-whisper/ctranslate2
    # spawn internally, instead of re-running this file's own argv parsing.
    multiprocessing.freeze_support()
    main()
