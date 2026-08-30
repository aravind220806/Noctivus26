import sys
from pathlib import Path

# Add backend directory to sys.path BEFORE importing app
root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.main import app

# Vercel ASGI handler
handler = app
