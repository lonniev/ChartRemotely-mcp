"""ChartRemotely — Tollbooth DPYC Operator MCP."""

# Read from installed package metadata, so pyproject is the one declaration.
# A hand-typed constant here said 0.4.2 while 0.4.4 was released and served.
from importlib.metadata import PackageNotFoundError
from importlib.metadata import version as _pkg_version

try:
    __version__ = _pkg_version("chartremotely-mcp")
except PackageNotFoundError:  # running from a source tree without an install
    __version__ = "0.0.0+unknown"
