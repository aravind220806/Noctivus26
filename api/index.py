import sys
import os
from pathlib import Path

# Add backend directory to sys.path BEFORE importing app
root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Load .env from backend directory if present (Vercel uses env vars, .env is local only)
env_file = backend_dir / ".env"
if env_file.exists():
    from dotenv import load_dotenv
    load_dotenv(env_file)

from app.main import app

# Vercel requires a module-level `handler` variable for ASGI Python functions
handler = app
