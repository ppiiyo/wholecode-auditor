"""CLI: wholecode audit github owner/repo | wholecode audit local ./path"""
import argparse
import json
import sys

from .auditor import run_audit
from .config import load_settings
from .loaders import load_github, load_local
from .report import markdown


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="wholecode",
        description="Whole-codebase security auditor powered by SubQ Snap")
    sub = parser.add_subparsers(dest="cmd", required=True)
    audit = sub.add_parser("audit", help="Audit a codebase")
    src = audit.add_subparsers(dest="src", required=True)

    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--output", "-o", help="Write markdown report to file")
    common.add_argument("--json", action="store_true", help="Print JSON instead of markdown")

    gh = src.add_parser("github", parents=[common], help="Audit a GitHub repository")
    gh.add_argument("repo", help="owner/repo")
    gh.add_argument("--branch", default="main")

    loc = src.add_parser("local", parents=[common], help="Audit a local directory")
    loc.add_argument("path")
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    settings = load_settings()

    if args.src == "github":
        owner, _, repo = args.repo.partition("/")
        if not repo:
            sys.exit("Repo must be in owner/repo format")
        loaded = load_github(owner, repo, args.branch, settings.github_token)
    else:
        loaded = load_local(args.path)

    print(f"Loaded {len(loaded.files):,} code files "
          f"({loaded.total_chars:,} chars) from {loaded.name}")
    print("Auditing with SubQ Snap …")
    result = run_audit(loaded, settings)

    if args.json:
        out = json.dumps({
            "repo": result.repo,
            "files": result.files_count,
            "chunks": result.chunks,
            "overall_risk": round(result.overall_risk, 3),
            "production_ready": result.production_ready,
            "findings": [
                {"check": f.check.key, "title": f.check.title,
                 "probability": round(f.probability, 3), "level": f.level,
                 "locations": [{"file": p, "line": n, "snippet": s}
                               for p, n, s in f.locations]}
                for f in result.findings],
        }, indent=2)
    else:
        out = markdown(result)

    if args.output:
        with open(args.output, "w") as fh:
            fh.write(out)
        print(f"Report written to {args.output}")
    else:
        print()
        print(out)


if __name__ == "__main__":
    main()
