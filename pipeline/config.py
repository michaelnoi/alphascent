"""
Configuration loader for AlphaScent pipeline.

Loads credentials from .env.local file in the project root.
This file can be committed to version control.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

project_root = Path(__file__).parent.parent
env_file = project_root / '.env.local'

if not env_file.exists():
    raise FileNotFoundError(
        f"Configuration file not found: {env_file}\n"
        f"Please copy env.example to .env.local and fill in your credentials."
    )

load_dotenv(env_file)

CLOUDFLARE_ACCOUNT_ID = os.getenv('CLOUDFLARE_ACCOUNT_ID')
D1_DATABASE_ID = os.getenv('D1_DATABASE_ID')
D1_API_TOKEN = os.getenv('CLOUDFLARE_D1_API_TOKEN')

R2_ACCESS_KEY = os.getenv('CLOUDFLARE_R2_ACCESS_KEY')
R2_SECRET_KEY = os.getenv('CLOUDFLARE_R2_SECRET_KEY')
R2_BUCKET_NAME = os.getenv('R2_BUCKET_NAME', 'alphascent-figures')
R2_BUCKET_URL = os.getenv('R2_BUCKET_URL')
R2_ENDPOINT = os.getenv('R2_ENDPOINT')

LOCAL_DB_PATH = os.getenv('LOCAL_DB_PATH', 'pipeline/pipeline.db')
LOCAL_CS_DB_PATH = os.getenv('LOCAL_CS_DB_PATH', 'pipeline/cs.db')

MAX_WORKERS = int(os.getenv('MAX_WORKERS', '2'))
ARXIV_RATE_LIMIT = float(os.getenv('ARXIV_RATE_LIMIT', '3.5'))
ARXIV_MAX_DAILY_REQUESTS = int(os.getenv('ARXIV_MAX_DAILY_REQUESTS', '8000'))

FIGURE_MIN_WIDTH = int(os.getenv('FIGURE_MIN_WIDTH', '400'))
FIGURE_MIN_HEIGHT = int(os.getenv('FIGURE_MIN_HEIGHT', '200'))
FIGURE_FULL_SIZE = int(os.getenv('FIGURE_FULL_SIZE', '800'))
FIGURE_THUMB_SIZE = int(os.getenv('FIGURE_THUMB_SIZE', '200'))

required_vars = {
    'CLOUDFLARE_ACCOUNT_ID': CLOUDFLARE_ACCOUNT_ID,
    'D1_DATABASE_ID': D1_DATABASE_ID,
    'D1_API_TOKEN': D1_API_TOKEN,
    'R2_ACCESS_KEY': R2_ACCESS_KEY,
    'R2_SECRET_KEY': R2_SECRET_KEY,
    'R2_BUCKET_URL': R2_BUCKET_URL,
    'R2_ENDPOINT': R2_ENDPOINT,
}

missing = [k for k, v in required_vars.items() if not v]
if missing:
    raise ValueError(
        f"Missing required environment variables in .env.local: {', '.join(missing)}"
    )
