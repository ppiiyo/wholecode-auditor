"""Security taxonomy (noul questions for SubQ) + regex locators for suspect lines."""
import re
from dataclasses import dataclass
from typing import Dict, List, Tuple


@dataclass(frozen=True)
class Check:
    key: str
    title: str
    instructions: str
    true_crit: str
    false_crit: str
    patterns: Tuple[str, ...] = ()


CHECKS: List[Check] = [
    Check("sql_injection", "SQL Injection",
          "Does the code contain SQL injection vulnerabilities?",
          "SQL built via string concatenation/f-strings/format with external input",
          "All SQL uses parameterized queries or a safe ORM API",
          (r'execute\(\s*f["\']', r'execute\(\s*["\'][^"\']*%s', r'execute\(\s*["\'][^"\']*\+',
           r'query\s*=\s*f["\']', r'\.raw\(\s*f["\']', r'WHERE.{0,40}\+\s*[a-z_]+')),
    Check("hardcoded_secrets", "Hardcoded Secrets",
          "Does the code contain hardcoded secrets?",
          "API keys, passwords, tokens or private keys written literally in source",
          "All secrets come from environment variables or a secret manager",
          (r'(?i)(api[_-]?key|secret|passwd|password|access[_-]?token)\s*=\s*["\'][A-Za-z0-9/+=_\-]{8,}["\']',
           r'-----BEGIN [A-Z ]*PRIVATE KEY-----')),
    Check("xss", "Cross-Site Scripting (XSS)",
          "Does the code contain XSS vulnerabilities?",
          "Unescaped user input rendered into HTML (innerHTML, document.write, raw templates)",
          "All user input is escaped or rendered via safe templating",
          (r'innerHTML\s*=', r'dangerouslySetInnerHTML', r'document\.write\(', r'\|\s*safe\b')),
    Check("path_traversal", "Path Traversal",
          "Does the code contain path traversal vulnerabilities?",
          "File paths built from user input without sanitization",
          "File access uses fixed roots or validated/sanitized paths",
          (r'open\(\s*(request|req)\b', r'os\.path\.join\([^)]*(request|req)\b',
           r'send_file\([^)]*(request|req|args)\b')),
    Check("insecure_deserialization", "Insecure Deserialization / eval",
          "Does the code deserialize untrusted data or use eval/exec?",
          "pickle/marshal/yaml.load/eval/exec applied to external input",
          "Deserialization uses safe loaders (yaml.safe_load) or avoids eval entirely",
          (r'pickle\.loads?\(', r'marshal\.loads?\(', r'yaml\.load\((?![^)]*Loader)',
           r'\beval\(', r'\bexec\(')),
    Check("ssrf", "Server-Side Request Forgery (SSRF)",
          "Does the code contain SSRF vulnerabilities?",
          "Outbound URLs built from user input without allowlist validation",
          "Outbound requests use fixed hosts or a validated allowlist",
          (r'requests\.(get|post|put)\(\s*f["\']', r'urlopen\(\s*f["\']',
           r'requests\.(get|post)\([^)]*\+')),
    Check("weak_crypto", "Weak Cryptography",
          "Does the code use weak or broken cryptography?",
          "MD5/SHA1 for security, DES/RC4, or non-crypto RNG for secrets/tokens",
          "Modern algorithms (SHA-256+, AES-GCM) and secrets module for tokens",
          (r'\bmd5\(', r'\bsha1\(', r'\bDES\b', r'\bRC4\b',
           r'random\.random\(\).{0,40}(token|key|secret)')),
    Check("info_leak", "Sensitive Info Leakage",
          "Does the code leak sensitive information in errors or logs?",
          "Stack traces, debug mode or secrets exposed to clients/logs",
          "Errors are generic to clients; debug off in production",
          (r'debug\s*=\s*True', r'traceback\.print_exc', r'print\([^)]*(password|secret|token)')),
    Check("auth_bypass", "Missing Authentication / Authorization",
          "Are there endpoints or sensitive operations without authentication checks?",
          "Routes or admin operations reachable without auth/permission verification",
          "All sensitive endpoints enforce authentication and authorization",
          (r'@app\.route\([^)]*\)\s*\n\s*def\s+(delete|admin|update)_',)),
    Check("race_conditions", "Race Conditions / TOCTOU",
          "Does the code contain race conditions on shared state or check-then-act flows?",
          "Non-atomic check-then-act on shared resources (balance, inventory, files)",
          "Shared-state mutations use locks, transactions or atomic operations",
          (r'if\s+.{0,40}(exists|balance|count).{0,40}:\s*\n\s*.{0,60}(update|delete|set)',)),
]

_COMPILED: Dict[str, List[re.Pattern]] = {
    c.key: [re.compile(p, re.IGNORECASE) for p in c.patterns] for c in CHECKS
}


def locate_suspects(check: Check, files: List, max_hits: int) -> List[Tuple[str, int, str]]:
    """Regex pre-screen over FULL file content (multi-line patterns supported).
    Returns (file, line, snippet)."""
    hits: List[Tuple[str, int, str]] = []
    seen = set()
    pats = _COMPILED.get(check.key, [])
    if not pats:
        return hits
    for f in files:
        lines = f.content.splitlines()
        for p in pats:
            for m in p.finditer(f.content):
                end_pos = max(m.start(), m.end() - 1)
                lineno = f.content.count("\n", 0, end_pos) + 1
                key = (f.path, lineno)
                if key in seen:
                    continue
                seen.add(key)
                snippet = lines[lineno - 1].strip()[:120] if 0 < lineno <= len(lines) else m.group(0)[:120]
                hits.append((f.path, lineno, snippet))
                if len(hits) >= max_hits:
                    return hits
    return hits
