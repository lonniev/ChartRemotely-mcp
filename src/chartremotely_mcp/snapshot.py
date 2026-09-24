"""Check a snapshot an agent sent back before handing it to anyone.

The reply comes from software on a patron's machine, over a wire the
operator does not control, so it is treated like any other untrusted input:
it must be exactly the shape the agent promises - a base64 JPEG data URL of
bounded size - or it is refused. Nothing here logs the payload.
"""

from __future__ import annotations

import base64
import binascii

PREFIX = "data:image/jpeg;base64,"
#: About 2 MB of JPEG once decoded. The agent sends a 1600px JPEG at
#: quality 70, which is a few hundred kilobytes; anything near this is wrong.
MAX_REPLY_CHARS = 2_800_000
_JPEG_SOI = b"\xff\xd8"


def parse(reply: str) -> bytes:
    """The JPEG bytes inside an agent's reply.

    Raises ValueError with a message fit to show the caller. An ``ERR``
    reply is the agent explaining itself (thinkorswim not on screen, no
    Screen Recording permission), so its words are passed through.
    """
    if reply.startswith("ERR"):
        raise ValueError(reply[3:].strip() or "the display could not take a snapshot")
    if len(reply) > MAX_REPLY_CHARS:
        raise ValueError("the display sent a snapshot that is too large")
    if not reply.startswith(PREFIX):
        raise ValueError("the display sent something that is not a snapshot")
    try:
        jpeg = base64.b64decode(reply[len(PREFIX):], validate=True)
    except (binascii.Error, ValueError):
        raise ValueError("the display sent a damaged snapshot") from None
    if not jpeg.startswith(_JPEG_SOI):
        raise ValueError("the display sent something that is not a JPEG")
    return jpeg
