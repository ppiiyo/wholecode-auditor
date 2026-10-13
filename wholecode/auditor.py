"""Audit pipeline: chunks -> SubQ verdicts -> aggregation + regex locations."""
import asyncio
from dataclasses import dataclass, field
from typing import Dict, List, Tuple

from .checks import CHECKS, Check, locate_suspects
from .config import Settings
from .loaders import LoadedRepo, to_chunks
from .subq_client import SubQClient, noul


@dataclass
class Finding:
    check: Check
    probability: float
    locations: List[Tuple[str, int, str]] = field(default_factory=list)

    @property
    def level(self) -> str:
        if self.probability >= 0.7:
            return "CRITICAL"
        if self.probability >= 0.5:
            return "WARNING"
        return "OK"


@dataclass
class AuditResult:
    repo: str
    files_count: int
    total_chars: int
    chunks: int
    findings: List[Finding] = field(default_factory=list)

    @property
    def overall_risk(self) -> float:
        bad = [f.probability for f in self.findings if f.probability >= 0.5]
        return max(bad, default=0.0)

    @property
    def production_ready(self) -> bool:
        return not any(f.level == "CRITICAL" for f in self.findings)


async def audit_repo(loaded: LoadedRepo, settings: Settings) -> AuditResult:
    chunks = to_chunks(loaded, settings.max_chars_per_chunk)
    if not chunks:
        raise ValueError("No code files found to audit")

    questions = {c.key: noul(c.instructions, c.true_crit, c.false_crit) for c in CHECKS}

    async with SubQClient(settings) as client:
        merged: Dict[str, float] = {}
        for i, chunk in enumerate(chunks, 1):
            print(f"  chunk {i}/{len(chunks)}: {len(chunk):,} chars -> SubQ …")
            res = await client.ask_all(chunk, questions)
            for k, v in res.items():
                merged[k] = max(merged.get(k, 0.0), v)

    result = AuditResult(repo=loaded.name, files_count=len(loaded.files),
                         total_chars=loaded.total_chars, chunks=len(chunks))
    for check in CHECKS:
        prob = merged.get(check.key, 0.0)
        locations = (locate_suspects(check, loaded.files, settings.max_locations_per_finding)
                     if prob >= settings.threshold else [])
        result.findings.append(Finding(check=check, probability=prob, locations=locations))
    result.findings.sort(key=lambda f: f.probability, reverse=True)
    return result


def run_audit(loaded: LoadedRepo, settings: Settings) -> AuditResult:
    return asyncio.run(audit_repo(loaded, settings))
