from __future__ import annotations
import asyncio
import logging
from typing import Callable, Any

try:
    from playwright.async_api import async_playwright, Browser, BrowserContext, Page, Playwright
except ImportError:
    async_playwright = None
    Browser = None
    BrowserContext = None
    Page = None
    Playwright = None

logger = logging.getLogger(__name__)

_playwright_instance: Playwright | None = None
_browser_instance: Browser | None = None
_lock = asyncio.Lock()


async def get_browser() -> Browser | None:
    """Returns a shared, warm Playwright Chromium browser instance."""
    global _playwright_instance, _browser_instance
    if _browser_instance and _browser_instance.is_connected():
        return _browser_instance

    async with _lock:
        if _browser_instance and _browser_instance.is_connected():
            return _browser_instance
        try:
            if not async_playwright:
                logger.warning("Playwright is not installed.")
                return None
            if not _playwright_instance:
                _playwright_instance = await async_playwright().start()
            _browser_instance = await _playwright_instance.chromium.launch(
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                ]
            )
            return _browser_instance
        except Exception as e:
            logger.exception(f"Failed to launch shared browser: {e}")
            _browser_instance = None
            return None


async def render_html_to_png(
    html_content: str,
    width: int,
    height: int,
    prepare_fn: Callable[[Page], asyncio.Future] | None = None,
) -> bytes:
    """Renders HTML content to PNG bytes using the warm shared browser instance."""
    browser = await get_browser()
    if not browser:
        raise RuntimeError("Playwright browser unavailable.")

    # Create an isolated lightweight page in the warm browser
    page = await browser.new_page(
        viewport={"width": width, "height": height},
        device_scale_factor=1,
    )
    try:
        await page.set_content(html_content, wait_until="load")
        if prepare_fn:
            await prepare_fn(page)
        await page.evaluate("document.fonts && document.fonts.ready")
        screenshot_bytes = await page.screenshot(
            type="png",
            clip={"x": 0, "y": 0, "width": width, "height": height},
        )
        return screenshot_bytes
    finally:
        await page.close()


async def close_browser() -> None:
    """Closes the shared browser instance on shutdown."""
    global _playwright_instance, _browser_instance
    async with _lock:
        if _browser_instance:
            try:
                await _browser_instance.close()
            except Exception:
                pass
            _browser_instance = None
        if _playwright_instance:
            try:
                await _playwright_instance.stop()
            except Exception:
                pass
            _playwright_instance = None
