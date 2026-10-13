"""SubQ Snap client: noul-only schema, batches, retry, probability parsing."""
import asyncio
import json
import logging
from typing import Any, Dict, Optional

import aiohttp

from .config import Settings

log = logging.getLogger("wholecode")


class SubQError(Exception):
    pass


def noul(instr: str, true_c: str, false_c: str) -> Dict[str, Any]:
    return {"type": "noul", "instructions": instr,
            "criteria": {"true": true_c, "false": false_c}}


def probability(node: Any) -> float:
    if isinstance(node, (int, float)):
        return float(node)
    if isinstance(node, dict):
        for k in ("noul", "yes", "probability", "p_yes", "score"):
            v = node.get(k)
            if isinstance(v, (int, float)):
                return float(v)
        t, f = node.get("true"), node.get("false")
        if isinstance(t, (int, float)) and isinstance(f, (int, float)) and (t + f) > 0:
            return t / (t + f)
    return 0.0


class SubQClient:
    def __init__(self, settings: Settings):
        self._s = settings
        self._session: Optional[aiohttp.ClientSession] = None

    async def __aenter__(self):
        self._session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=90),
            headers={"Authorization": f"Bearer {self._s.subq_api_key}"})
        return self

    async def __aexit__(self, *exc):
        if self._session and not self._session.closed:
            await self._session.close()

    async def _post(self, state: str, questions: Dict[str, Any]) -> Dict[str, Any]:
        payload = {"model": self._s.subq_model, "state": state, "questions": questions}
        last: Optional[Exception] = None
        for attempt in range(3):
            try:
                async with self._session.post(self._s.subq_url, json=payload) as resp:
                    if resp.status == 401:
                        raise SubQError("Invalid SubQ API key (401)")
                    if resp.status == 402:
                        raise SubQError("SubQ credits exhausted (402)")
                    if resp.status == 429:
                        if attempt == 2:
                            raise SubQError("SubQ rate limit (429) after retries")
                        await asyncio.sleep(5 * (attempt + 1))
                        continue
                    body = await resp.text()
                    if resp.status in (400, 422):
                        raise SubQError(f"SubQ rejected payload ({resp.status}): {body[:300]}")
                    if resp.status >= 500:
                        raise IOError(f"SubQ server error {resp.status}")
                    return json.loads(body)
            except SubQError:
                raise
            except Exception as e:
                last = e
                await asyncio.sleep(2 ** attempt)
        raise SubQError(f"SubQ unreachable after retries: {last}")

    async def ask_all(self, state: str, questions: Dict[str, Any]) -> Dict[str, float]:
        keys = list(questions)
        batches = [keys[i:i + self._s.batch_size]
                   for i in range(0, len(keys), self._s.batch_size)]
        results = await asyncio.gather(
            *[self._post(state, {k: questions[k] for k in b}) for b in batches],
            return_exceptions=True)
        out: Dict[str, float] = {}
        for batch, r in zip(batches, results):
            if isinstance(r, Exception):
                raise SubQError(str(r))
            answers = r.get("answers") or {}
            missing = [k for k in batch if k not in answers]
            if missing:
                log.warning("subq_missing_answers missing=%s", missing)
            for k in batch:
                out[k] = max(out.get(k, 0.0), probability(answers.get(k)))
        return out
