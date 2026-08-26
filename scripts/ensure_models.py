import json
import multiprocessing
import sys

from huggingface_hub import snapshot_download

# Same repos/files faster_whisper.utils.download_model() would fetch for
# these two sizes -- duplicated here (instead of calling that function
# directly) because it hardcodes progress bars off, and this needs real
# progress to drive the first-launch download UI.
MODELS = {
    "base": "Systran/faster-whisper-base",
    "small": "Systran/faster-whisper-small",
}
ALLOW_PATTERNS = [
    "config.json",
    "preprocessor_config.json",
    "model.bin",
    "tokenizer.json",
    "vocabulary.*",
]


def emit(event):
    print(json.dumps(event), flush=True)


def make_progress_class(model_name):
    from tqdm import tqdm as tqdm_base

    class ProgressTqdm(tqdm_base):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self._report()

        def update(self, n=1):
            super().update(n)
            self._report()

        def _report(self):
            # Only the per-file byte bars carry a numeric total worth
            # reporting; the "Fetching N files" bar's unit is file counts,
            # which would misrepresent progress as a byte percentage.
            if self.unit != "B" or not self.total:
                return
            emit({
                "type": "progress",
                "model": model_name,
                "downloaded": int(self.n),
                "total": int(self.total),
            })

    return ProgressTqdm


def is_cached(model_name):
    try:
        snapshot_download(
            MODELS[model_name], allow_patterns=ALLOW_PATTERNS, local_files_only=True
        )
        return True
    except Exception:
        return False


def download(model_name):
    snapshot_download(
        MODELS[model_name],
        allow_patterns=ALLOW_PATTERNS,
        tqdm_class=make_progress_class(model_name),
    )


def main():
    check_only = "--check" in sys.argv[1:]

    missing = [name for name in MODELS if not is_cached(name)]
    if check_only:
        emit({"type": "check-result", "missing": missing})
        return

    for name in MODELS:
        if name not in missing:
            emit({"type": "model-cached", "model": name})
            continue
        emit({"type": "model-start", "model": name})
        try:
            download(name)
        except Exception as err:
            emit({"type": "model-error", "model": name, "error": str(err)})
            sys.exit(1)
        emit({"type": "model-done", "model": name})

    emit({"type": "all-done"})


if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()
