#!/usr/bin/env python3
"""Build Antithesis Logs Explorer search URLs.

Pure URL construction — no browser or DOM needed. The output is a URL you can
hand to `agent-browser open` (or paste into a browser) to land on the Logs
Explorer with the query pre-populated.

Subcommands:
  failure         A simple "assertion.message contains X AND assertion.status
                  matches failing" query.
  not-preceded-by Cascade-elimination query: X failures that are NOT preceded
                  by Y.
  not-followed-by Like above, but for X failures NOT followed by Y.
  custom          Arbitrary query from a JSON spec (stdin or --spec-file).
  decode          Decode a Logs Explorer URL back to the underlying query JSON.

The encoded URL format is `v5v<base64(json)>`, where the JSON shape is
documented in references/query-builder.md. See `--help` on each subcommand for
its specific flags.

Examples:
  build-url.py failure \\
      --session-id abc...-54-5 \\
      --property "node - kill" \\
      --tenant orbitinghail.antithesis.com

  build-url.py not-preceded-by \\
      --session-id abc...-54-5 \\
      --property "downstream check" \\
      --pre-field assertion.message \\
      --pre-value "upstream fault" \\
      --tenant orbitinghail.antithesis.com

  build-url.py decode --url 'https://...antithesis.com/search?search=v5v...'
"""

import argparse
import base64
import json
import sys
from typing import Any
from urllib.parse import parse_qs, urlparse

TEMPORAL_MAP = {
    "preceded_by": {"y": "preceding", "negate": False},
    "not_preceded_by": {"y": "preceding", "negate": True},
    "followed_by": {"y": "following", "negate": False},
    "not_followed_by": {"y": "following", "negate": True},
}


def cond(field: str, operator: str, value: str, case_sensitive: bool = False) -> dict:
    return {"c": bool(case_sensitive), "f": field, "o": operator, "v": value}


def cond_group(conditions: list, join_op: str = "or") -> dict:
    return {"h": conditions, "o": join_op}


def row_group(groups: list, join_op: str = "and") -> dict:
    return {"r": {"h": groups, "o": join_op}}


def build_query(
    *,
    session_id: str,
    conditions: list[dict],
    temporal_type: str | None = None,
    temporal_conditions: list[dict] | None = None,
) -> dict:
    """Build a Logs Explorer query JSON object.

    `conditions` and `temporal_conditions` are each a list of
    {"field": ..., "op": ..., "value": ...} dicts. `temporal_type` is one of
    "preceded_by" / "not_preceded_by" / "followed_by" / "not_followed_by"
    (or None / "none" for no temporal block).
    """
    if not session_id:
        raise ValueError("session_id is required")
    if not conditions:
        raise ValueError(
            "conditions is required and must be a non-empty list of "
            "{field, op, value} dicts. (Did you mean to pass 'conditions' "
            "instead of 'rows'?)"
        )

    def to_group(c: dict) -> dict:
        for key in ("field", "op", "value"):
            if key not in c:
                raise ValueError(f"condition missing required key '{key}': {c!r}")
        return cond_group([cond(c["field"], c["op"], c["value"])])

    main_groups = [to_group(c) for c in conditions]
    query: dict[str, Any] = {
        "q": {
            "n": {**row_group(main_groups), "t": {"g": False, "m": ""}, "y": "none"},
        },
        "s": session_id,
    }

    if temporal_type and temporal_type != "none":
        if not temporal_conditions:
            raise ValueError(f"temporal_type={temporal_type!r} requires temporal_conditions")
        if temporal_type not in TEMPORAL_MAP:
            raise ValueError(
                f"unknown temporal_type {temporal_type!r}; expected one of "
                + ", ".join(sorted(TEMPORAL_MAP))
            )
        mapping = TEMPORAL_MAP[temporal_type]
        temporal_groups = [to_group(c) for c in temporal_conditions]
        query["q"]["p"] = {
            **row_group(temporal_groups),
            "t": {"g": mapping["negate"], "m": ""},
            "y": mapping["y"],
        }

    return query


def encode_query(query: dict) -> str:
    """Encode a query JSON object into the v5v+base64 search param value."""
    raw = json.dumps(query, separators=(",", ":")).encode("utf-8")
    b64 = base64.b64encode(raw).decode("ascii").rstrip("=")
    return "v5v" + b64


def build_search_url(query: dict, tenant: str) -> str:
    """Build a full Logs Explorer URL for the given query and tenant host."""
    if not tenant:
        raise ValueError("tenant is required (e.g. 'orbitinghail.antithesis.com')")
    host = tenant
    if host.startswith("http://") or host.startswith("https://"):
        host = urlparse(host).netloc
    return f"https://{host}/search?search={encode_query(query)}"


def decode_url(url: str) -> dict:
    """Decode a Logs Explorer URL back to its query JSON."""
    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    search = (qs.get("search") or [None])[0]
    if not search:
        raise ValueError(f"no `search` query parameter found in URL: {url!r}")
    if not search.startswith("v5v"):
        raise ValueError(f"search param does not start with 'v5v' (got {search[:4]!r})")
    b64 = search[3:]
    pad = "=" * (-len(b64) % 4)
    return json.loads(base64.b64decode(b64 + pad))


# -----------------------------------------------------------------------------
# CLI
# -----------------------------------------------------------------------------


def cmd_failure(args: argparse.Namespace) -> str:
    query = build_query(
        session_id=args.session_id,
        conditions=[
            {"field": "assertion.message", "op": "contains", "value": args.property},
            {"field": "assertion.status", "op": "matches", "value": "failing"},
        ],
    )
    return build_search_url(query, args.tenant)


def cmd_not_preceded_by(args: argparse.Namespace) -> str:
    query = build_query(
        session_id=args.session_id,
        conditions=[
            {"field": "assertion.message", "op": "contains", "value": args.property},
            {"field": "assertion.status", "op": "matches", "value": "failing"},
        ],
        temporal_type="not_preceded_by",
        temporal_conditions=[
            {"field": args.pre_field, "op": "contains", "value": args.pre_value},
        ],
    )
    return build_search_url(query, args.tenant)


def cmd_not_followed_by(args: argparse.Namespace) -> str:
    query = build_query(
        session_id=args.session_id,
        conditions=[
            {"field": "assertion.message", "op": "contains", "value": args.property},
            {"field": "assertion.status", "op": "matches", "value": "failing"},
        ],
        temporal_type="not_followed_by",
        temporal_conditions=[
            {"field": args.post_field, "op": "contains", "value": args.post_value},
        ],
    )
    return build_search_url(query, args.tenant)


def cmd_custom(args: argparse.Namespace) -> str:
    if args.spec_file:
        with open(args.spec_file) as f:
            spec = json.load(f)
    else:
        spec = json.load(sys.stdin)
    query = build_query(
        session_id=spec.get("sessionId") or spec.get("session_id"),
        conditions=spec.get("conditions") or [],
        temporal_type=spec.get("temporalType") or spec.get("temporal_type"),
        temporal_conditions=(spec.get("temporalConditions") or spec.get("temporal_conditions")),
    )
    tenant = args.tenant or spec.get("tenant")
    return build_search_url(query, tenant)


def cmd_decode(args: argparse.Namespace) -> str:
    decoded = decode_url(args.url)
    return json.dumps(decoded, indent=2)


def cmd_encode(args: argparse.Namespace) -> str:
    """Encode a raw query JSON (shape: {q: {...}, s: ...}) into a search URL.

    Useful when you already have a full query (e.g. captured from the UI's
    own search URL or decoded from another search) and want to re-encode it
    against a different tenant or just rebuild the URL.
    """
    if args.spec_file:
        with open(args.spec_file) as f:
            query = json.load(f)
    else:
        query = json.load(sys.stdin)
    if not isinstance(query, dict) or "q" not in query or "s" not in query:
        raise ValueError("encode expects a raw query JSON with top-level 'q' and 's' keys")
    return build_search_url(query, args.tenant)


def main(argv: list[str] | None = None) -> int:
    # --test is a top-level flag (no subcommand). Handle it before argparse
    # demands a subcommand.
    if argv is None:
        argv = sys.argv[1:]
    if argv == ["--test"]:
        return run_tests()

    parser = argparse.ArgumentParser(
        prog="build-url.py",
        description="Build Antithesis Logs Explorer search URLs (pure, no browser).",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("failure", help="simple failure query for one property")
    p.add_argument("--session-id", required=True)
    p.add_argument("--property", required=True, help="assertion.message value")
    p.add_argument("--tenant", required=True, help="e.g. orbitinghail.antithesis.com")
    p.set_defaults(func=cmd_failure)

    p = sub.add_parser(
        "not-preceded-by",
        help="failures of X that are NOT preceded by event Y",
    )
    p.add_argument("--session-id", required=True)
    p.add_argument("--property", required=True, help="main assertion.message value")
    p.add_argument("--pre-field", required=True, help="e.g. assertion.message")
    p.add_argument("--pre-value", required=True, help="preceding event value")
    p.add_argument("--tenant", required=True)
    p.set_defaults(func=cmd_not_preceded_by)

    p = sub.add_parser(
        "not-followed-by",
        help="failures of X that are NOT followed by event Y",
    )
    p.add_argument("--session-id", required=True)
    p.add_argument("--property", required=True)
    p.add_argument("--post-field", required=True)
    p.add_argument("--post-value", required=True)
    p.add_argument("--tenant", required=True)
    p.set_defaults(func=cmd_not_followed_by)

    p = sub.add_parser(
        "custom",
        help="arbitrary query from a JSON spec (stdin or --spec-file)",
    )
    p.add_argument("--spec-file", help="path to JSON spec; defaults to stdin")
    p.add_argument(
        "--tenant",
        help="override the tenant from the spec",
    )
    p.set_defaults(func=cmd_custom)

    p = sub.add_parser("decode", help="decode a Logs Explorer URL back to JSON")
    p.add_argument("--url", required=True)
    p.set_defaults(func=cmd_decode)

    p = sub.add_parser(
        "encode",
        help="encode a raw query JSON (with q+s keys) into a Logs Explorer URL",
    )
    p.add_argument("--spec-file", help="path to JSON spec; defaults to stdin")
    p.add_argument("--tenant", required=True)
    p.set_defaults(func=cmd_encode)

    args = parser.parse_args(argv)
    try:
        output = args.func(args)
    except ValueError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    print(output)
    return 0


# -----------------------------------------------------------------------------
# Tests
# -----------------------------------------------------------------------------

# A known-good URL captured from the Antithesis platform (orbitinghail tenant,
# 2026-05-21). Used to lock the encoded format against silent drift.
KNOWN_GOOD_URL = (
    "https://orbitinghail.antithesis.com/search?search=v5v"
    "eyJxIjp7Im4iOnsiciI6eyJoIjpbeyJoIjpbeyJjIjpmYWxzZSwiZiI6ImFzc2VydGlvbi5tZX"
    "NzYWdlIiwibyI6ImNvbnRhaW5zIiwidiI6Im5vZGUgLSBraWxsIn1dLCJvIjoib3IifSx7Im"
    "giOlt7ImMiOmZhbHNlLCJmIjoiYXNzZXJ0aW9uLnN0YXR1cyIsIm8iOiJtYXRjaGVzIiwidi"
    "I6ImZhaWxpbmcifV0sIm8iOiJvciJ9XSwibyI6ImFuZCJ9LCJ0Ijp7ImciOmZhbHNlLCJtIj"
    "oiIn0sInkiOiJub25lIn19LCJzIjoiYjMxNTA0NDUzZjgyZWUwNDlhOTJkYjU2MTNhMjc3YT"
    "ctNTQtNSJ9"
)


def run_tests() -> int:
    failures = 0

    def assert_eq(name, got, expected):
        nonlocal failures
        if got != expected:
            print(f"FAIL: {name}")
            print(f"  expected: {expected!r}")
            print(f"  got:      {got!r}")
            failures += 1
        else:
            print(f"  ok: {name}")

    def assert_raises(name, exc_type, fn, *args, **kwargs):
        nonlocal failures
        try:
            fn(*args, **kwargs)
        except exc_type as e:
            print(f"  ok: {name} (raised: {e})")
            return
        except Exception as e:
            print(f"FAIL: {name} (raised {type(e).__name__}, expected {exc_type.__name__})")
            failures += 1
            return
        print(f"FAIL: {name} (no exception raised)")
        failures += 1

    # -- Shape primitives --
    assert_eq(
        "cond default case-insensitive",
        cond("f", "contains", "v"),
        {"c": False, "f": "f", "o": "contains", "v": "v"},
    )
    assert_eq(
        "cond case-sensitive",
        cond("f", "matches", "v", case_sensitive=True),
        {"c": True, "f": "f", "o": "matches", "v": "v"},
    )
    assert_eq(
        "cond_group default join is 'or'",
        cond_group([{"x": 1}]),
        {"h": [{"x": 1}], "o": "or"},
    )
    assert_eq(
        "row_group default join is 'and'",
        row_group([{"x": 1}]),
        {"r": {"h": [{"x": 1}], "o": "and"}},
    )

    # -- build_query (simple) --
    simple = build_query(
        session_id="sid-1",
        conditions=[{"field": "assertion.message", "op": "contains", "value": "P"}],
    )
    assert_eq("simple: session id propagated", simple["s"], "sid-1")
    assert_eq("simple: main type is 'none'", simple["q"]["n"]["y"], "none")
    assert_eq("simple: no temporal block", "p" in simple["q"], False)
    assert_eq(
        "simple: condition shape",
        simple["q"]["n"]["r"]["h"][0]["h"][0],
        {"c": False, "f": "assertion.message", "o": "contains", "v": "P"},
    )

    # -- build_query (each temporal mode encodes y + t.g correctly) --
    expectations = {
        "preceded_by":     ("preceding", False),
        "not_preceded_by": ("preceding", True),
        "followed_by":     ("following", False),
        "not_followed_by": ("following", True),
    }
    for mode, (expected_y, expected_negate) in expectations.items():
        q = build_query(
            session_id="sid-2",
            conditions=[{"field": "a", "op": "contains", "value": "x"}],
            temporal_type=mode,
            temporal_conditions=[{"field": "b", "op": "contains", "value": "y"}],
        )
        assert_eq(f"temporal {mode}: q.p.y", q["q"]["p"]["y"], expected_y)
        assert_eq(f"temporal {mode}: q.p.t.g (negate)", q["q"]["p"]["t"]["g"], expected_negate)
        # The main block stays "none" even when a temporal block is present.
        assert_eq(f"temporal {mode}: q.n.y stays 'none'", q["q"]["n"]["y"], "none")

    # -- Validation errors --
    assert_raises(
        "missing session_id",
        ValueError,
        build_query,
        session_id="",
        conditions=[{"field": "a", "op": "contains", "value": "b"}],
    )
    assert_raises(
        "missing conditions",
        ValueError,
        build_query,
        session_id="s",
        conditions=[],
    )
    assert_raises(
        "condition missing field key",
        ValueError,
        build_query,
        session_id="s",
        conditions=[{"op": "contains", "value": "b"}],
    )
    assert_raises(
        "temporal_type without temporal_conditions",
        ValueError,
        build_query,
        session_id="s",
        conditions=[{"field": "a", "op": "contains", "value": "b"}],
        temporal_type="not_preceded_by",
    )
    assert_raises(
        "unknown temporal_type",
        ValueError,
        build_query,
        session_id="s",
        conditions=[{"field": "a", "op": "contains", "value": "b"}],
        temporal_type="sometime_around",
        temporal_conditions=[{"field": "c", "op": "contains", "value": "d"}],
    )

    # -- encode_query / build_search_url --
    encoded = encode_query(simple)
    assert_eq("encode_query has v5v prefix", encoded.startswith("v5v"), True)
    assert_eq("encode_query has no trailing padding", encoded.endswith("="), False)

    url = build_search_url(simple, "orbitinghail.antithesis.com")
    assert_eq(
        "build_search_url scheme + host",
        url.startswith("https://orbitinghail.antithesis.com/search?search=v5v"),
        True,
    )
    assert_eq(
        "build_search_url strips scheme from tenant",
        build_search_url(simple, "https://orbitinghail.antithesis.com"),
        url,
    )
    assert_raises("missing tenant", ValueError, build_search_url, simple, "")

    # -- decode_url --
    decoded = decode_url(KNOWN_GOOD_URL)
    assert_eq("decode_url: session id", decoded["s"], "b31504453f82ee049a92db5613a277a7-54-5")
    assert_eq(
        "decode_url: first field",
        decoded["q"]["n"]["r"]["h"][0]["h"][0]["f"],
        "assertion.message",
    )
    assert_raises("decode_url: no search param", ValueError, decode_url, "https://x.example.com/")
    assert_raises(
        "decode_url: missing v5v prefix",
        ValueError,
        decode_url,
        "https://x.example.com/search?search=notv5v",
    )

    # -- Round-trip: known-good URL → decode → encode → identical URL --
    roundtrip = build_search_url(decoded, "orbitinghail.antithesis.com")
    assert_eq("known-good URL round-trip stable", roundtrip, KNOWN_GOOD_URL)

    # -- Cross-check: build_query reproduces the known-good JSON exactly --
    rebuilt = build_query(
        session_id="b31504453f82ee049a92db5613a277a7-54-5",
        conditions=[
            {"field": "assertion.message", "op": "contains", "value": "node - kill"},
            {"field": "assertion.status", "op": "matches", "value": "failing"},
        ],
    )
    assert_eq("build_query matches platform output", rebuilt, decoded)

    print()
    if failures:
        print(f"{failures} test(s) failed")
        return 1
    print("all tests passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
