import uvicorn

from app.core.config import settings


if __name__ == "__main__":
    is_development = settings.node_env == "development"
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=is_development,
        workers=1 if is_development else settings.web_concurrency,
    )
