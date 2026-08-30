import sys
from pathlib import Path

# Ensure backend modules can be discovered by Vercel Serverless runtime
root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.main import app

handler = app
