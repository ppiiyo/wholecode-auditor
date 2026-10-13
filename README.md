# wholecode-auditor 🛡️

AI security auditor that loads your **entire codebase** into SubQ Snap's
384K-token context window and returns structured vulnerability verdicts —
no RAG, no embeddings, no missed cross-file context.

## Why not GPT-4 / Claude / RAG?

| | wholecode-auditor (SubQ Snap) | GPT-4 Turbo | RAG pipeline |
|---|---|---|---|
| Context | 384K tokens (whole repo) | 128K (¼ repo) | chunks only |
| Cross-file reasoning | ✅ one context | ❌ truncated |  lost between chunks |
| Cost per 100K-line audit | ~$0.015 | ~$0.50+ | embeddings + calls |
| Output | probabilities + locations | free text | free text |

## Install

```bash
git clone https://github.com/YOUR_USER/wholecode-auditor
cd wholecode-auditor
pip install -e .
export SUBQ_API_KEY=sk-...   # from console.subq.ai
```

## Usage

```bash
wholecode audit github octocat/Hello-World
wholecode audit github mycompany/api --branch develop   # needs GITHUB_TOKEN
wholecode audit local ./src
wholecode audit github owner/repo -o report.md
wholecode audit local ./src --json
```

## Checks

🔴 SQL Injection · Hardcoded Secrets · XSS · Path Traversal ·
Insecure Deserialization/eval · SSRF · Weak Crypto · Info Leakage ·
Missing Auth · Race Conditions

Each check = SubQ `noul` probability + regex pre-screened `file:line` locations.

## How it works

1. Load: GitHub tarball (1 request) or local walk; code files only, minified skipped.
2. Chunk: ≤300K tokens per chunk (Snap limit 384K), oversized files truncated.
3. Decide: 10 noul questions per batch, batches parallel (asyncio.gather).
4. Aggregate: max probability across chunks; ≥0.5 triggers location pre-screen.
5. Report: markdown or JSON.

## Development

```bash
pip install -e . pytest
pytest -q
```

## Roadmap

- [ ] GitHub Action (audit every PR)
- [ ] SARIF output for GitHub Code Scanning
- [ ] CWE mapping per finding
- [ ] Diff-mode vs base branch

## License

MIT
