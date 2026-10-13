from wholecode.auditor import AuditResult, Finding
from wholecode.checks import CHECKS, locate_suspects
from wholecode.cli import build_parser
from wholecode.loaders import CodeFile, LoadedRepo, _is_minified, to_chunks
from wholecode.report import markdown
from wholecode.subq_client import probability


def test_probability_parsing():
    assert probability(0.87) == 0.87
    assert probability({"noul": 0.42}) == 0.42
    assert probability({"true": 0.8, "false": 0.2}) == 0.8
    assert probability(None) == 0.0


def test_chunking_respects_limit():
    files = [CodeFile(path=f"f{i}.py", content="x" * 100_000) for i in range(30)]
    chunks = to_chunks(LoadedRepo(name="t", files=files), 1_200_000)
    assert len(chunks) == 3
    assert all(len(c) <= 1_300_000 for c in chunks)


def test_oversized_single_file_truncated():
    files = [CodeFile(path="big.py", content="x" * 3_000_000)]
    chunks = to_chunks(LoadedRepo(name="t", files=files), 1_200_000)
    assert len(chunks) == 1
    assert len(chunks[0]) <= 1_200_100


def test_minified_detection():
    assert _is_minified("a" * 100_000)
    assert not _is_minified("a\n" * 1_000)


def test_locate_sql_fstring():
    files = [CodeFile(path="api.py",
                      content='cur.execute(f"SELECT * FROM u WHERE id={uid}")\n')]
    hits = locate_suspects(CHECKS[0], files, 5)
    assert hits and hits[0][0] == "api.py" and hits[0][1] == 1


def test_locate_secret():
    files = [CodeFile(path="cfg.py", content='API_KEY = "sk-abc123456789xyz"\n')]
    assert locate_suspects(CHECKS[1], files, 5)


def test_locate_multiline_pattern():
    files = [CodeFile(path="pay.py",
                      content="def pay():\n    if balance > 0:\n        update_balance()\n")]
    hits = locate_suspects(CHECKS[9], files, 5)
    assert hits and hits[0][1] == 3


def test_cli_parser_flags_after_source():
    p = build_parser()
    a = p.parse_args(["audit", "github", "o/r", "-o", "r.md", "--json"])
    assert a.repo == "o/r" and a.output == "r.md" and a.json
    b = p.parse_args(["audit", "local", "./x", "--json"])
    assert b.path == "./x" and b.json


def test_report_contains_findings():
    r = AuditResult(repo="t", files_count=1, total_chars=10, chunks=1)
    r.findings = [Finding(check=CHECKS[0], probability=0.9,
                          locations=[("a.py", 1, "cur.execute(f'...')")])]
    md = markdown(r)
    assert "SQL Injection" in md and "a.py:1" in md and "Production ready: NO" in md
