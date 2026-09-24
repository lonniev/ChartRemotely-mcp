"""Which display a spoken or typed name means.

Names arrive by dictation, so "mini mac", "mac mini" and "mini" may all mean
the display paired as "Mac mini". This is the one place they are matched -
the agents pass what was said through verbatim - and it is deliberately
plain: a few deterministic rules, tried in order, and the first rule that
finds anything decides. No model, no scores, no thresholds to tune.

1. **exact** - the same name ignoring case, spaces, hyphens, underscores and
   dots ("mac-mini" is "Mac Mini");
2. **same words** in any order ("mini mac" is "mac mini");
3. **some of its words** - every word said is a word of the name ("mini"
   finds "mac mini", "office" finds "office wall");
4. **the start of it** ("macm" finds "mac mini");
5. **sounds like** - rules 2 and 3 again, comparing American Soundex codes
   word by word ("mack meeny" finds "mac mini").

Pure and dependency-free: it takes names and returns names. Choosing
between displays that share a name, and owner scoping, stay in the store.
"""

from __future__ import annotations

import re

_SEPARATORS = re.compile(r"[\s\-_.]+")

#: American Soundex digit for each consonant; vowels (and y) are absent.
_SOUNDEX = {
    **dict.fromkeys("bfpv", "1"),
    **dict.fromkeys("cgjkqsxz", "2"),
    **dict.fromkeys("dt", "3"),
    "l": "4",
    **dict.fromkeys("mn", "5"),
    "r": "6",
}


def display_key(name: str) -> str:
    """A display name as it is matched exactly: lower-cased, without spaces, hyphens, underscores or dots."""
    return _SEPARATORS.sub("", name).lower()


def words(name: str) -> frozenset[str]:
    """The lower-cased words of a name, split on spaces, hyphens, underscores and dots."""
    return frozenset(w for w in _SEPARATORS.split(name.lower()) if w)


def soundex(word: str) -> str:
    """The American Soundex code of ``word`` ("Robert" and "Rupert" are both R163).

    Only ASCII letters are coded; digits in the word are appended as they
    are, so "desk2" and "desk3" still differ. A word with no letters is its
    own code.
    """
    letters = [c for c in word.lower() if "a" <= c <= "z"]
    digits = "".join(c for c in word if c.isdigit())
    if not letters:
        return word.lower()
    code = [letters[0].upper()]
    last = _SOUNDEX.get(letters[0], "")
    for c in letters[1:]:
        if c in "hw":            # h and w do not separate letters of one code
            continue
        digit = _SOUNDEX.get(c)
        if digit is None:        # a vowel does
            last = ""
            continue
        if digit != last:
            code.append(digit)
            if len(code) == 4:
                break
        last = digit
    return "".join(code).ljust(4, "0") + digits


def _sounds(ws: frozenset[str]) -> frozenset[str]:
    return frozenset(soundex(w) for w in ws)


def match(query: str, labels: list[str]) -> list[str]:
    """The labels ``query`` means, from the first rule that finds any (see the module doc).

    Order and duplicates are kept as given, so two displays paired under one
    name both come back and the caller can choose between them. Empty when
    nothing matches, or when the query has no letters or digits at all.
    """
    key, said = display_key(query), words(query)
    if not key:
        return []
    heard = _sounds(said)
    rules = (
        lambda label: display_key(label) == key,
        lambda label: words(label) == said,
        lambda label: said <= words(label),
        lambda label: display_key(label).startswith(key),
        lambda label: _sounds(words(label)) == heard,
        lambda label: heard <= _sounds(words(label)),
    )
    for rule in rules:
        found = [label for label in labels if rule(label)]
        if found:
            return found
    return []
