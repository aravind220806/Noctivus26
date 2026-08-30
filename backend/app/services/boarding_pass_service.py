import base64
import hashlib
import html
import re
import secrets
from io import BytesIO
from pathlib import Path

import qrcode
from playwright.async_api import async_playwright

from app.core.config import settings


PASS_WIDTH = 1800
PASS_HEIGHT = 580
DESTINATION_COLLEGE = "Velammal Engineering College"
DESTINATION_CITY = "Chennai, Tamil Nadu"


def create_pass_token() -> tuple[str, str]:
    token = secrets.token_urlsafe(18)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    return token, token_hash


def verification_url(token: str) -> str:
    origin = (settings.frontend_origins[0] if settings.frontend_origins else "https://noctivus26.com").rstrip("/")
    return f"{origin}/p/{token}"


def _asset_data_uri(path: Path) -> str:
    suffix = path.suffix.lower().lstrip(".") or "png"
    media_type = "jpeg" if suffix in {"jpg", "jpeg"} else suffix
    return f"data:image/{media_type};base64,{base64.b64encode(path.read_bytes()).decode('ascii')}"


def qr_data_uri(url: str) -> str:
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=1, box_size=8)
    qr.add_data(url)
    qr.make(fit=True)
    image = qr.make_image(fill_color="#000000", back_color="#ffffff").convert("RGB")
    output = BytesIO()
    image.save(output, format="PNG", optimize=True)
    return f"data:image/png;base64,{base64.b64encode(output.getvalue()).decode('ascii')}"


def _format_time_display(time_str: str) -> str:
    clean = str(time_str or "").strip()
    if not clean or clean == "—":
        return "—"
    if "AM" in clean.upper() or "PM" in clean.upper():
        return clean
    try:
        parts = clean.split(":")
        hours = int(parts[0])
        mins = int(parts[1]) if len(parts) > 1 else 0
        ampm = "PM" if hours >= 12 else "AM"
        h12 = hours % 12
        if h12 == 0:
            h12 = 12
        return f"{h12:02d}:{mins:02d} {ampm}"
    except Exception:
        return clean


def pass_values(registration: dict, pass_data: dict) -> dict[str, str]:
    participant = registration.get("participant") or {}
    events = registration.get("eventRegistrations") or []
    assigned_slots = registration.get("assigned_slots") or pass_data.get("assigned_slots") or []

    event_1_name = ""
    time_1 = ""
    event_2_name = "—"
    time_2 = "—"

    # Resolve from pass_data if explicitly provided
    if pass_data.get("event1"):
        event_1_name = str(pass_data["event1"])
    if pass_data.get("time1"):
        time_1 = _format_time_display(pass_data["time1"])
    if pass_data.get("event2"):
        event_2_name = str(pass_data["event2"])
    if pass_data.get("time2"):
        time_2 = _format_time_display(pass_data["time2"])

    # Fallback to events list
    if not event_1_name and events:
        event_1_name = str(events[0].get("eventName") or events[0].get("eventId") or "Noctivus '26")
        time_1 = _format_time_display(events[0].get("time") or "09:00 AM")
        if len(events) > 1:
            event_2_name = str(events[1].get("eventName") or events[1].get("eventId") or "—")
            time_2 = _format_time_display(events[1].get("time") or "01:00 PM")

    if not event_1_name:
        event_1_name = str(pass_data.get("eventName") or "Noctivus '26")
        time_1 = _format_time_display(pass_data.get("time") or "09:00 AM")

    return {
        "PASSENGER_NAME": str(participant.get("name") or "").upper(),
        "EVENT_1": event_1_name.upper(),
        "EVENT_DATE": str(pass_data.get("date") or (events[0].get("date") if events else None) or "26 SEP 2026").upper(),
        "TIME_1": time_1.upper(),
        "EVENT_GATE": str(pass_data.get("gate") or (events[0].get("gate") if events else None) or "VEC Gate 1").upper(),
        "VENUE": str(pass_data.get("venue") or (events[0].get("venue") if events else None) or "Main Auditorium").upper(),
        "TERMINAL": str(pass_data.get("terminal") or (events[0].get("terminal") if events else None) or "MAIN HALL").upper(),
        "EVENT_2": event_2_name.upper(),
        "TIME_2": time_2.upper(),
        "FOOD_PREFERENCE": str(participant.get("foodPreference") or "N/A").upper(),
        "EMAIL_ID": str(participant.get("email") or "").lower(),
        "FROM_COLLEGE": str(participant.get("college") or "").upper(),
        "TO_COLLEGE": DESTINATION_COLLEGE.upper(),
        "TO_CITY": DESTINATION_CITY.upper(),
        "UNIQUE_ID": str(registration.get("registrationId") or "").upper(),
    }


def render_boarding_pass_html(registration: dict, pass_data: dict, token: str) -> str:
    assets = Path(__file__).resolve().parents[1] / "assets"
    logo = _asset_data_uri(assets / "noctivus-emblem.png") if (assets / "noctivus-emblem.png").exists() else _asset_data_uri(Path(__file__).resolve().parents[3] / "frontend" / "public" / "brand" / "noctivus-emblem.png")
    values = {key: html.escape(value) for key, value in pass_values(registration, pass_data).items()}
    qr_payload = str(registration.get("registrationId") or values.get("UNIQUE_ID") or token)
    qr = qr_data_uri(qr_payload)
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
* {{ box-sizing: border-box; }}
body {{ margin: 0; width: {PASS_WIDTH}px; height: {PASS_HEIGHT}px; background: #fff; font-family: Inter, Arial, sans-serif; color: #111827; }}
.ticket {{ width: {PASS_WIDTH}px; height: {PASS_HEIGHT}px; display: grid; grid-template-columns: 73% 27%; overflow: hidden; border: 1px solid #D7DEE8; border-radius: 34px; background: #fff; box-shadow: 0 10px 28px rgba(6,24,43,.15); }}
.main {{ min-width: 0; position: relative; display: grid; grid-template-rows: 116px 92px 82px 76px 164px 50px; background: linear-gradient(180deg,#fff 0%,#f7fbff 100%); }}
.stub {{ min-width: 0; border-left: 2px dashed #9AA6B8; display: grid; grid-template-rows: 56px minmax(0,1fr) 64px; background: #fff; position: relative; }}
.stub:before,.stub:after {{ content: ""; position: absolute; left: -18px; width: 34px; height: 34px; border-radius: 50%; background: #fff; border: 1px solid #D7DEE8; }}
.stub:before {{ top: -17px; }} .stub:after {{ bottom: -17px; }}
.header,.stub-head,.stub-foot {{ background: linear-gradient(135deg,#06182B,#0A2540); color: #fff; }}
.header {{ display: grid; grid-template-columns: 150px minmax(0,1fr) 320px; align-items: center; padding: 15px 46px 14px 74px; gap: 18px; }}
.logo {{ width: 86px; height: 86px; object-fit: contain; }}
.brand {{ min-width: 0; }}
.brand h1 {{ margin: 0; font: 800 72px/0.88 "Roboto Condensed",Arial,sans-serif; letter-spacing: 0; white-space: nowrap; }} .brand h1 span {{ color:#356AE6; }}
.brand p {{ margin: 9px 0 0; color: #fff; font: 700 16px/1 Inter,Arial,sans-serif; letter-spacing: 10px; white-space: nowrap; }}
.pass-title {{ justify-self: end; display: flex; align-items: center; gap: 16px; font: 800 28px/1 "Roboto Condensed"; letter-spacing: 1px; white-space: nowrap; }}
.plane {{ font-size: 38px; color: #dbe8ff; transform: rotate(8deg); }}
.row {{ min-width: 0; display: grid; align-items: start; column-gap: 0; padding: 17px 46px 0 108px; overflow: hidden; }}
.row1,.row2 {{ padding-right: 276px; }}
.row1 {{ grid-template-columns: 37% 43% 20%; border-bottom: 1px solid #D7DEE8; }}
.row2 {{ grid-template-columns: 18% 18% 38% 26%; border-bottom: 1px solid #D7DEE8; }}
.row2 .field {{ padding-left: 16px; padding-right: 16px; }}
.row3 {{ grid-template-columns: 28% 18% 22% 32%; border-bottom: 1px solid #D7DEE8; }}
.field {{ min-width: 0; min-height: 42px; padding: 0 16px; border-left: 1px solid #AAB6C8; }}
.field:first-child {{ border-left: 0; padding-left: 0; }}
.label {{ display:block; color:#194FD1; font:800 12px/1 Inter; letter-spacing:.45px; text-transform:uppercase; margin-bottom:8px; }}
.value {{ display:block; font-family:"Roboto Condensed",Arial,sans-serif; font-weight:700; color:#111827; line-height:1.15; max-width:100%; overflow-wrap:anywhere; word-break:normal; hyphens:auto; overflow:hidden; }}
.two-line-field {{ display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }}
.main-value {{ font-size: 26px; }} .small-value {{ font-size: 21px; }} .email-value {{ font-size: 18px; }}
.qr-cell {{ position:absolute; right:46px; top:134px; padding:0; }} .qr-cell img {{ width: 178px; height: 178px; border: 3px solid #111827; border-radius: 10px; padding: 8px; background:#fff; }}
.route-wrap {{ padding: 16px 46px 0 78px; }}
.route-box {{ min-height: 140px; height:140px; display:grid; grid-template-columns:40% 20% 40%; align-items:center; background:#EAF2FF; border-radius:12px; padding: 16px 28px; overflow:hidden; }}
.route-label {{ color:#194FD1; font:800 13px/1 Inter; letter-spacing:.5px; text-transform:uppercase; margin-bottom:9px; }}
.college-line {{ font:700 24px/1.15 "Roboto Condensed"; }} .hint {{ display:block; margin-top:7px; font:700 14px/1 Inter; color:#667085; }}
.route-center {{ position:relative; display:grid; place-items:center; color:#194FD1; font-size:26px; overflow:visible; z-index:2; }} .dotted {{ width:100%; border-top:3px dotted #194FD1; position:relative; }} .dotted span {{ position:absolute; left:50%; top:-17px; transform:translateX(-50%); background:#EAF2FF; padding:0 10px; line-height:1; z-index:3; }}
.to-block {{ justify-self:end; width:100%; padding-right: 4px; }} .to-block .college-line {{ font-size:25px; }}
.footer {{ display:flex; align-items:center; justify-content:center; gap:24px; color:#111827; font:700 12px/1 Inter; white-space:nowrap; overflow:hidden; }}
.footer span {{ letter-spacing:8px; }}
.footer b {{ color:#194FD1; letter-spacing:0; }}
.stub-head {{ display:grid; place-items:center; font:800 26px/1 "Roboto Condensed"; letter-spacing:1px; }}
.stub-body {{ padding: 10px 24px 0 26px; display:grid; grid-template-rows:auto auto auto auto auto minmax(50px,auto) auto; gap:4px; min-width:0; overflow:hidden; }}
.stub-field {{ min-width:0; min-height:34px; border-bottom:1px solid #D7DEE8; padding-bottom:4px; }}
.stub-field .label {{ font-size:10px; margin-bottom:4px; }}
.stub-field .value {{ font-size:19px; line-height:1.08; }} .stub-grid2 {{ display:grid; grid-template-columns:1fr 1fr; gap:8px; }}
.stub-grid2 .stub-field {{ border-left:1px solid #AAB6C8; padding-left:10px; }} .stub-grid2 .stub-field:first-child {{ border-left:0; padding-left:0; }}
.stub-college {{ min-height:56px; }} .stub-college .value {{ font-size:14px; -webkit-line-clamp:3; }}
.stub-to {{ min-height:48px; }} .stub-to .value {{ font-size:15px; -webkit-line-clamp:2; }}
.stub-foot {{ display:grid; grid-template-columns:58px 1px minmax(0,1fr); align-items:center; gap:14px; padding:7px 22px; overflow:hidden; }} .stub-foot img {{ width:50px; height:50px; object-fit:contain; }} .stub-foot i {{ height:38px; background:#D7DEE8; }} .stub-foot strong {{ display:block; font:800 25px/1 "Roboto Condensed"; white-space:nowrap; }} .stub-foot span {{ color:#356AE6; }} .stub-foot small {{ display:block; margin-top:4px; font:700 8px/1 Inter; letter-spacing:3px; white-space:nowrap; }}
</style>
</head>
<body>
<div class="ticket">
  <main class="main">
    <header class="header"><img class="logo" src="{logo}" alt=""><div class="brand"><h1>NOCTIVUS <span>'26</span></h1><p>COLLEGE SYMPOSIUM</p></div><div class="pass-title">BOARDING PASS <span class="plane">✈</span></div></header>
    <section class="row row1"><div class="field"><span class="label">Passenger Name</span><span class="value main-value two-line-field" data-autofit data-max-font="27" data-min-font="13" data-max-lines="2">{values['PASSENGER_NAME']}</span></div><div class="field"><span class="label">Event 1</span><span class="value main-value two-line-field" data-autofit data-max-font="27" data-min-font="13" data-max-lines="2">{values['EVENT_1']}</span></div><div class="field"><span class="label">Date</span><span class="value main-value">{values['EVENT_DATE']}</span></div><div class="qr-cell"><img src="{qr}" alt=""></div></section>
    <section class="row row2"><div class="field"><span class="label">Time 1</span><span class="value small-value">{values['TIME_1']}</span></div><div class="field"><span class="label">Gate</span><span class="value small-value two-line-field" data-autofit data-max-font="21" data-min-font="13" data-max-lines="2">{values['EVENT_GATE']}</span></div><div class="field"><span class="label">Venue</span><span class="value small-value two-line-field" data-autofit data-max-font="21" data-min-font="13" data-max-lines="2">{values['VENUE']}</span></div><div class="field"><span class="label">Terminal</span><span class="value small-value two-line-field" data-autofit data-max-font="21" data-min-font="13" data-max-lines="2">{values['TERMINAL']}</span></div></section>
    <section class="row row3"><div class="field"><span class="label">Event 2</span><span class="value small-value two-line-field" data-autofit data-max-font="21" data-min-font="13" data-max-lines="2">{values['EVENT_2']}</span></div><div class="field"><span class="label">Time 2</span><span class="value small-value">{values['TIME_2']}</span></div><div class="field"><span class="label">Food Preference</span><span class="value email-value two-line-field" data-autofit data-max-font="18" data-min-font="11" data-max-lines="2">{values['FOOD_PREFERENCE']}</span></div><div class="field"><span class="label">Email ID</span><span class="value email-value two-line-field" data-autofit data-max-font="18" data-min-font="11" data-max-lines="2">{values['EMAIL_ID']}</span></div></section>
    <section class="route-wrap"><div class="route-box"><div><div class="route-label">From College</div><div class="value college-line two-line-field" data-autofit data-max-font="24" data-min-font="13" data-max-lines="2">{values['FROM_COLLEGE']}</div><span class="hint">(USER COLLEGE)</span></div><div class="route-center"><div class="dotted"><span>✈</span></div></div><div class="to-block"><div class="route-label">To</div><div class="value college-line two-line-field" data-autofit data-max-font="25" data-min-font="14" data-max-lines="2">{values['TO_COLLEGE']}</div><span class="hint">{values['TO_CITY']}</span></div></div></section>
    <div class="footer"><span>IGNITE</span><b>•</b><span>INNOVATE</span><b>•</b><span>INSPIRE</span></div>
  </main>
  <aside class="stub"><div class="stub-head">BOARDING PASS</div><div class="stub-body">
    <div class="stub-field"><span class="label">Passenger Name</span><span class="value two-line-field" data-autofit data-max-font="21" data-min-font="12" data-max-lines="2">{values['PASSENGER_NAME']}</span></div>
    <div class="stub-field"><span class="label">Event 1</span><span class="value two-line-field" data-autofit data-max-font="21" data-min-font="12" data-max-lines="2">{values['EVENT_1']}</span></div>
    <div class="stub-grid2"><div class="stub-field"><span class="label">Date</span><span class="value">{values['EVENT_DATE']}</span></div><div class="stub-field"><span class="label">Time 1</span><span class="value">{values['TIME_1']}</span></div></div>
    <div class="stub-grid2"><div class="stub-field"><span class="label">Event 2</span><span class="value two-line-field" data-autofit data-max-font="17" data-min-font="10" data-max-lines="2">{values['EVENT_2']}</span></div><div class="stub-field"><span class="label">Time 2</span><span class="value">{values['TIME_2']}</span></div></div>
    <div class="stub-grid2"><div class="stub-field"><span class="label">Gate</span><span class="value two-line-field" data-autofit data-max-font="20" data-min-font="11" data-max-lines="2">{values['EVENT_GATE']}</span></div><div class="stub-field"><span class="label">Terminal</span><span class="value two-line-field" data-autofit data-max-font="20" data-min-font="11" data-max-lines="2">{values['TERMINAL']}</span></div></div>
    <div class="stub-field stub-college"><span class="label">From College</span><span class="value two-line-field" data-autofit data-max-font="16" data-min-font="10" data-max-lines="3">{values['FROM_COLLEGE']}</span></div>
    <div class="stub-field stub-to"><span class="label">To</span><span class="value two-line-field" data-autofit data-max-font="17" data-min-font="11" data-max-lines="2">{values['TO_COLLEGE']}<br>{values['TO_CITY']}</span></div>
  </div><div class="stub-foot"><img src="{logo}" alt=""><i></i><div><strong>NOCTIVUS <span>'26</span></strong><small>COLLEGE SYMPOSIUM</small></div></div></aside>
</div>
<script>
function autoFitText(element, options = {{}}) {{
  const maxFontSize = Number(options.maxFontSize || element.dataset.maxFont || 24);
  const minFontSize = Number(options.minFontSize || element.dataset.minFont || 13);
  const maxLines = Number(options.maxLines || element.dataset.maxLines || 2);
  element.style.fontSize = `${{maxFontSize}}px`;
  element.style.lineHeight = "1.15";
  const maxHeight = Math.ceil(maxFontSize * 1.15 * maxLines) + 2;
  let size = maxFontSize;
  while ((element.scrollWidth > element.clientWidth || element.scrollHeight > maxHeight) && size > minFontSize) {{
    size -= 1;
    element.style.fontSize = `${{size}}px`;
  }}
  element.style.minHeight = `${{Math.ceil(size * 1.15)}}px`;
  element.style.overflow = "hidden";
}}
async function fitAllText() {{
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  document.querySelectorAll("[data-autofit]").forEach((el) => autoFitText(el));
}}
</script>
</body>
</html>"""


async def render_pass_artwork_bytes(registration: dict, pass_data: dict, token: str | None = None) -> bytes:
    token = token or create_pass_token()[0]
    html_content = render_boarding_pass_html(registration, pass_data, token)
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(args=["--no-sandbox"])
        page = await browser.new_page(viewport={"width": PASS_WIDTH, "height": PASS_HEIGHT}, device_scale_factor=1)
        await page.set_content(html_content, wait_until="load")
        await page.evaluate("fitAllText()")
        await page.evaluate("document.fonts && document.fonts.ready")
        output = await page.screenshot(type="png", clip={"x": 0, "y": 0, "width": PASS_WIDTH, "height": PASS_HEIGHT})
        await browser.close()
        return output


async def validate_boarding_pass_layout(registration: dict, pass_data: dict) -> list[dict]:
    token = create_pass_token()[0]
    html_content = render_boarding_pass_html(registration, pass_data, token)
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(args=["--no-sandbox"])
        page = await browser.new_page(viewport={"width": PASS_WIDTH, "height": PASS_HEIGHT}, device_scale_factor=1)
        await page.set_content(html_content, wait_until="load")
        await page.evaluate("fitAllText()")
        await page.evaluate("document.fonts && document.fonts.ready")
        issues = await page.evaluate(
            """() => {
                const results = [];
                document.querySelectorAll('.field, .stub-field').forEach((el) => {
                    const label = el.querySelector('.label')?.textContent || '';
                    const value = el.querySelector('.value');
                    if (!value) return;
                    const isOverflowing = value.scrollWidth > value.clientWidth || value.scrollHeight > (value.clientHeight + 4);
                    if (isOverflowing) {
                        results.push({ field: label, text: value.textContent });
                    }
                });
                return results;
            }"""
        )
        await browser.close()
        return issues
