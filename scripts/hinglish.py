import ast
import json
import multiprocessing
import re
import sys

if not hasattr(ast, "Str"):
    ast.Str = ast.Constant

from aksharamukha import transliterate

REPLACEMENTS = [
    ("ā", "aa"), ("Ā", "Aa"),
    ("ī", "i"), ("Ī", "I"),
    ("ū", "oo"), ("Ū", "Oo"),
    ("ṅ", "n"), ("Ṅ", "N"),
    ("ñ", "n"), ("Ñ", "N"),
    ("ṇ", "n"), ("Ṇ", "N"),
    ("ṭ", "t"), ("Ṭ", "T"),
    ("ḍ", "d"), ("Ḍ", "D"),
    ("ś", "sh"), ("Ś", "Sh"),
    ("ṣ", "sh"), ("Ṣ", "Sh"),
    ("ḥ", "h"), ("Ḥ", "H"),
    ("ṛ", "ri"), ("Ṛ", "Ri"),
    ("m̐", "n"),
    ("ṃ", "n"), ("Ṃ", "N"),
    ("ṁ", "n"), ("Ṁ", "N"),
    ("̐", ""),
    ("_", ""),
]

WORD_FIXES = {"ham": "hum", "men": "mein"}


def convert_to_hinglish(text):
    text = text.strip()
    if not text:
        return text

    out = transliterate.process("Devanagari", "IAST", text, pre_options=["RemoveSchwaHindi"])
    for old, new in REPLACEMENTS:
        out = out.replace(old, new)

    def fix_word(m):
        word = m.group(0)
        fixed = WORD_FIXES.get(word.lower())
        if not fixed:
            return word
        return fixed.capitalize() if word[0].isupper() else fixed

    out = re.sub(r"[A-Za-z]+", fix_word, out)
    return out[0].upper() + out[1:] if out else out


def main():
    texts = json.loads(sys.stdin.read())
    print(json.dumps([convert_to_hinglish(t) for t in texts]))


if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()
