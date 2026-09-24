"""The display-name matcher: which rule decides, and Soundex itself."""

import pytest

from chartremotely_mcp.displays import display_key, match, soundex, words

LABELS = ["Mac Mini", "office wall", "Mac Studio"]


@pytest.mark.parametrize(("word", "code"), [
    ("Robert", "R163"), ("Rupert", "R163"), ("Rubin", "R150"),
    ("Ashcraft", "A261"), ("Ashcroft", "A261"),
    ("Tymczak", "T522"), ("Pfister", "P236"), ("Honeyman", "H555"),
    ("Lee", "L000"), ("mac", "M200"), ("mack", "M200"), ("mini", "M500"), ("meeny", "M500"),
])
def test_soundex_classics(word, code):
    assert soundex(word) == code


def test_soundex_keeps_digits_and_codes_a_bare_number_as_itself():
    assert soundex("desk2") == "D200" + "2" != soundex("desk3")
    assert soundex("2") == "2"


@pytest.mark.parametrize("said", ["Mac mini", "mac-mini", "macmini", "MAC_MINI", "mac.mini", "  Mac  Mini "])
def test_separators_and_case_do_not_count(said):
    assert display_key(said) == "macmini"


def test_words_split_on_the_same_separators():
    assert words("  Office-Wall_2.east ") == {"office", "wall", "2", "east"}


@pytest.mark.parametrize(("said", "found"), [
    ("mac-mini", ["Mac Mini"]),              # 1 exact key
    ("mini mac", ["Mac Mini"]),              # 2 same words, any order
    ("mini", ["Mac Mini"]),                  # 3 some of its words
    ("office", ["office wall"]),             # 3
    ("macm", ["Mac Mini"]),                  # 4 start of the key
    ("officew", ["office wall"]),            # 4
    ("mack meeny", ["Mac Mini"]),            # 5 same sounds
    ("meeny", ["Mac Mini"]),                 # 5 some of its sounds
    ("offis", ["office wall"]),              # 5
])
def test_each_rule_finds_its_display(said, found):
    assert match(said, LABELS) == found


def test_the_first_rule_with_a_hit_decides():
    # "mini" is a whole name AND a word of "Mac Mini": the exact name wins.
    assert match("mini", ["Mac Mini", "mini"]) == ["mini"]
    # Same words beat a subset hit on a longer name.
    assert match("mac mini", ["mac mini wall", "mini mac"]) == ["mini mac"]
    # A word hit beats a prefix hit.
    assert match("mac", ["macbook", "mac mini"]) == ["mac mini"]


def test_several_hits_in_the_deciding_rule_all_come_back():
    assert match("mac", LABELS) == ["Mac Mini", "Mac Studio"]


def test_twins_both_come_back():
    assert match("desk", ["desk", "desk"]) == ["desk", "desk"]


@pytest.mark.parametrize("said", ["kitchen", "", "   ", "-", "mac mini wall"])
def test_nothing_is_guessed(said):
    assert match(said, LABELS) == []
