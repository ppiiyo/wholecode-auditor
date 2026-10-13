"""Code loading: GitHub tarball (single request, no API rate limits) or local dir."""
import io
import os
import tarfile
from dataclasses import dataclass, field
from typing import List

import requests

CODE_EXTENSIONS = (
    ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".go", ".rb", ".php",
    ".c", ".h", ".cpp", ".hpp", ".cs", ".rs", ".kt", ".swift", ".sql", ".sh",
)
EXCLUDED_DIRS = {
    "node_modules", ".git", "vendor", "dist", "build", "__pycache__",
    ".venv", "venv", "target", "coverage", ".next", ".idea", ".vscode",
}
MAX_FILE_BYTES = 500_000
MINIFIED_AVG_LINE = 2000  # avg line longer than this => minified bundle


@dataclass
class CodeFile:
    path: str
    content: str


@dataclass
class LoadedRepo:
    name: str
    files: List[CodeFile] = field(default_factory=list)

    @property
    def total_chars(self) -> int:
        return sum(len(f.content) for f in self.files)


def _is_code(path: str) -> bool:
    parts = path.split("/")
    if any(p in EXCLUDED_DIRS for p in parts):
        return False
    return path.lower().endswith(CODE_EXTENSIONS)


def _decode(raw: bytes) -> str:
    if b"\x00" in raw[:8192]:
        return ""
    return raw.decode("utf-8", errors="ignore")


def _is_minified(content: str) -> bool:
    lines = content.count("\n") + 1
    return len(content) > 50_000 and (len(content) / lines) > MINIFIED_AVG_LINE


def _accept(path: str, content: str) -> bool:
    return bool(content) and _is_code(path) and not _is_minified(content)


def load_github(owner: str, repo: str, branch: str = "main", token: str = "") -> LoadedRepo:
    url = f"https://codeload.github.com/{owner}/{repo}/tar.gz/refs/heads/{branch}"
    headers = {"Authorization": f"token {token}"} if token else {}
    resp = requests.get(url, headers=headers, timeout=180)
    if resp.status_code == 404:
        raise ValueError(f"Repo not found or branch missing: {owner}/{repo}@{branch}")
    resp.raise_for_status()

    loaded = LoadedRepo(name=f"{owner}/{repo}")
    with tarfile.open(fileobj=io.BytesIO(resp.content), mode="r:gz") as tf:
        for member in tf.getmembers():
            if not member.isfile() or member.size > MAX_FILE_BYTES:
                continue
            parts = member.path.split("/", 1)
            rel = parts[1] if len(parts) > 1 else member.path
            if not _is_code(rel):
                continue
            fh = tf.extractfile(member)
            if fh is None:
                continue
            content = _decode(fh.read())
            if _accept(rel, content):
                loaded.files.append(CodeFile(path=rel, content=content))
    return loaded


def load_local(root: str) -> LoadedRepo:
    loaded = LoadedRepo(name=os.path.basename(os.path.abspath(root)) or root)
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDED_DIRS]
        for fn in filenames:
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, root).replace(os.sep, "/")
            if not _is_code(rel):
                continue
            try:
                if os.path.getsize(full) > MAX_FILE_BYTES:
                    continue
                with open(full, "rb") as f:
                    content = _decode(f.read())
            except OSError:
                continue
            if _accept(rel, content):
                loaded.files.append(CodeFile(path=rel, content=content))
    return loaded


def to_chunks(loaded: LoadedRepo, max_chars: int) -> List[str]:
    chunks, current, size = [], [], 0
    for f in loaded.files:
        block = f"# FILE: {f.path}\n{f.content}\n\n"
        if len(block) > max_chars:  # single oversized file: hard truncate
            block = block[:max_chars] + "\n# ...[file truncated to context limit]...\n\n"
        if size + len(block) > max_chars and current:
            chunks.append("".join(current))
            current, size = [], 0
        current.append(block)
        size += len(block)
    if current:
        chunks.append("".join(current))
    return chunks
