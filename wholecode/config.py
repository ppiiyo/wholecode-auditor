import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    subq_api_key: str
    github_token: str = ""
    subq_url: str = "https://api.subq.ai/v1/systemone"
    subq_model: str = "subq-snap-preview"
    threshold: float = 0.5
    max_chars_per_chunk: int = 1_200_000  # ~300K tokens, Snap limit 384K
    batch_size: int = 10
    max_locations_per_finding: int = 10


def load_settings() -> Settings:
    key = os.getenv("SUBQ_API_KEY", "")
    if not key:
        raise SystemExit("Set SUBQ_API_KEY in environment or .env")
    return Settings(subq_api_key=key, github_token=os.getenv("GITHUB_TOKEN", ""))
