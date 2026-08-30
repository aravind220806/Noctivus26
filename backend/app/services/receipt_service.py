import base64
import html
import os
import re
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path

import qrcode
try:
    from playwright.async_api import async_playwright
except ImportError:
    async_playwright = None

from app.core.config import settings
from app.services.event_service import list_events

RECEIPT_WIDTH = 900
RECEIPT_HEIGHT = 1180


def _asset_data_uri(path: Path) -> str:
    suffix = path.suffix.lower().lstrip(".") or "png"
    media_type = "jpeg" if suffix in {"jpg", "jpeg"} else suffix
    return f"data:image/{media_type};base64,{base64.b64encode(path.read_bytes()).decode('ascii')}"


def qr_data_uri(url: str) -> str:
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=1, box_size=6)
    qr.add_data(url)
    qr.make(fit=True)
    image = qr.make_image(fill_color="#000000", back_color="#ffffff").convert("RGB")
    output = BytesIO()
    image.save(output, format="PNG", optimize=True)
    return f"data:image/png;base64,{base64.b64encode(output.getvalue()).decode('ascii')}"


def render_receipt_html(registration: dict) -> str:
    assets = Path(__file__).resolve().parents[1] / "assets"
    logo_path = assets / "noctivus-emblem.png"
    if not logo_path.exists():
        logo_path = Path(__file__).resolve().parents[3] / "frontend" / "public" / "brand" / "noctivus-emblem.png"
    logo = _asset_data_uri(logo_path) if logo_path.exists() else ""

    participant = registration.get("participant") or {}
    name = html.escape(str(participant.get("name") or "Participant").upper())
    college = html.escape(str(participant.get("college") or "Institution").upper())
    email = html.escape(str(participant.get("email") or "—").lower())
    phone = html.escape(str(participant.get("phone") or "—"))
    food = html.escape(str(participant.get("foodPreference") or "N/A").upper())

    reg_id = html.escape(str(registration.get("registrationId") or "NOC26-XXXXXX"))
    utr = html.escape(str(registration.get("utrNumber") or registration.get("paymentReference") or "—"))
    amount = str(registration.get("expectedAmount") or registration.get("claimedAmount") or "200")
    
    verified_at_dt = registration.get("verifiedAt") or datetime.now(timezone.utc)
    if isinstance(verified_at_dt, str):
        try:
            verified_at_dt = datetime.fromisoformat(verified_at_dt)
        except Exception:
            verified_at_dt = datetime.now(timezone.utc)
    date_str = verified_at_dt.strftime("%d %b %Y, %I:%M %p UTC")

    qr_payload = str(registration.get("registrationId") or reg_id)
    qr_img = qr_data_uri(qr_payload)

    events = registration.get("eventRegistrations") or []
    event_rows = ""
    for ev in events:
        ev_name = html.escape(str(ev.get("eventName") or ev.get("eventId") or "Symposium Event"))
        ev_cat = html.escape(str(ev.get("category") or "Technical"))
        ev_fee = str(ev.get("feeSnapshot") or "—")
        event_rows += f"""
        <tr>
          <td style="padding: 14px 16px; border-bottom: 1px solid #273549; font-weight: 700; color: #fff; font-size: 16px;">
            {ev_name}
            <span style="display: block; font-size: 12px; color: #94a3b8; font-weight: 500; margin-top: 2px;">Category: {ev_cat}</span>
          </td>
          <td style="padding: 14px 16px; border-bottom: 1px solid #273549; text-align: right; font-weight: 700; color: #38bdf8; font-size: 16px;">
            ₹{ev_fee}
          </td>
        </tr>
        """

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
* {{ box-sizing: border-box; }}
body {{
  margin: 0;
  width: {RECEIPT_WIDTH}px;
  height: {RECEIPT_HEIGHT}px;
  background: #080d1a;
  font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #f1f5f9;
  padding: 40px;
  display: flex;
  justify-content: center;
  align-items: center;
}}
.receipt-wrapper {{
  width: 820px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 24px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
  overflow: hidden;
  position: relative;
}}
.header {{
  background: linear-gradient(135deg, #0b1329 0%, #1e293b 100%);
  border-bottom: 2px solid #3b82f6;
  padding: 28px 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}}
.brand {{
  display: flex;
  align-items: center;
  gap: 16px;
}}
.logo {{
  width: 64px;
  height: 64px;
  object-fit: contain;
}}
.brand-text h1 {{
  margin: 0;
  font-size: 28px;
  font-weight: 900;
  color: #fff;
  letter-spacing: 0.5px;
}}
.brand-text h1 span {{
  color: #38bdf8;
}}
.brand-text p {{
  margin: 2px 0 0;
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
  letter-spacing: 4px;
  text-transform: uppercase;
}}
.receipt-tag {{
  background: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.4);
  color: #4ade80;
  padding: 8px 16px;
  border-radius: 12px;
  font-weight: 800;
  font-size: 13px;
  letter-spacing: 1px;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 6px;
}}
.content {{
  padding: 32px 36px;
}}
.status-bar {{
  background: #1e293b;
  border-left: 4px solid #22c55e;
  border-radius: 8px;
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}}
.status-item span {{
  display: block;
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}}
.status-item strong {{
  font-size: 16px;
  color: #fff;
}}
.reg-id {{
  color: #f59e0b !important;
  font-family: monospace;
  font-size: 18px !important;
}}
.grid2 {{
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 24px;
}}
.card-box {{
  background: #131d31;
  border: 1px solid #202d44;
  border-radius: 12px;
  padding: 16px 20px;
}}
.card-box .label {{
  display: block;
  font-size: 11px;
  font-weight: 700;
  color: #38bdf8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}}
.card-box .val {{
  font-size: 16px;
  font-weight: 700;
  color: #f8fafc;
  line-height: 1.3;
}}
.card-box .sub {{
  display: block;
  font-size: 12px;
  color: #94a3b8;
  margin-top: 4px;
}}
.events-table {{
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 24px;
  background: #131d31;
  border: 1px solid #202d44;
  border-radius: 12px;
  overflow: hidden;
}}
.events-table th {{
  background: #1e293b;
  padding: 12px 16px;
  font-size: 12px;
  font-weight: 800;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  text-align: left;
  border-bottom: 1px solid #334155;
}}
.total-row {{
  background: #18233c;
}}
.total-row td {{
  padding: 16px;
  font-size: 18px;
  font-weight: 800;
  color: #fff;
}}
.total-amount {{
  text-align: right;
  color: #4ade80 !important;
  font-size: 22px !important;
}}
.notice-box {{
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 12px;
  padding: 14px 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 24px;
}}
.notice-icon {{
  font-size: 24px;
  color: #60a5fa;
}}
.notice-text {{
  font-size: 13px;
  color: #cbd5e1;
  line-height: 1.45;
}}
.notice-text strong {{
  color: #93c5fd;
}}
.footer {{
  background: #0b1329;
  border-top: 1px solid #1e293b;
  padding: 18px 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}}
.footer-left p {{
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  color: #94a3b8;
}}
.footer-left small {{
  display: block;
  margin-top: 3px;
  font-size: 10px;
  color: #64748b;
}}
.qr-wrap {{
  display: flex;
  align-items: center;
  gap: 12px;
}}
.qr-wrap img {{
  width: 58px;
  height: 58px;
  border-radius: 6px;
  background: #fff;
  padding: 2px;
}}
.qr-text {{
  font-size: 10px;
  color: #94a3b8;
  font-weight: 600;
  line-height: 1.3;
}}
</style>
</head>
<body>
<div class="receipt-wrapper">
  <div class="header">
    <div class="brand">
      {f'<img class="logo" src="{logo}" alt="">' if logo else ''}
      <div class="brand-text">
        <h1>NOCTIVUS <span>'26</span></h1>
        <p>Official Payment Receipt</p>
      </div>
    </div>
    <div class="receipt-tag">
      ✓ PAYMENT VERIFIED
    </div>
  </div>

  <div class="content">
    <div class="status-bar">
      <div class="status-item">
        <span>Registration ID</span>
        <strong class="reg-id">{reg_id}</strong>
      </div>
      <div class="status-item">
        <span>UTR / Transaction</span>
        <strong>{utr}</strong>
      </div>
      <div class="status-item">
        <span>Verification Date</span>
        <strong>{date_str}</strong>
      </div>
    </div>

    <div class="grid2">
      <div class="card-box">
        <span class="label">Participant Name</span>
        <div class="val">{name}</div>
        <span class="sub">{college}</span>
      </div>
      <div class="card-box">
        <span class="label">Contact & Food Info</span>
        <div class="val" style="font-size: 14px;">{email}</div>
        <span class="sub">Food Preference: <strong>{food}</strong></span>
      </div>
    </div>

    <table class="events-table">
      <thead>
        <tr>
          <th>Registered Event(s)</th>
          <th style="text-align: right;">Fee</th>
        </tr>
      </thead>
      <tbody>
        {event_rows}
        <tr class="total-row">
          <td>Total Amount Paid</td>
          <td class="total-amount">₹{amount}</td>
        </tr>
      </tbody>
    </table>

    <div class="notice-box">
      <div class="notice-icon">✈</div>
      <div class="notice-text">
        <strong>Boarding Pass Notice:</strong> Your time batch slot and official Symposium Boarding Pass with entry QR code will be generated and dispatched once event scheduling is finalized.
      </div>
    </div>
  </div>

  <div class="footer">
    <div class="footer-left">
      <p>Velammal Engineering College</p>
      <small>Ambattur-Redhills Road, Surapet, Chennai - 600066</small>
    </div>
    <div class="qr-wrap">
      <div class="qr-text">Scan for live<br>verification</div>
      <img src="{qr_img}" alt="QR">
    </div>
  </div>
</div>
</body>
</html>"""


async def render_receipt_artwork_bytes(registration: dict) -> bytes:
    html_content = render_receipt_html(registration)
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(args=["--no-sandbox"])
        page = await browser.new_page(viewport={"width": RECEIPT_WIDTH, "height": RECEIPT_HEIGHT}, device_scale_factor=1)
        await page.set_content(html_content, wait_until="load")
        await page.evaluate("document.fonts && document.fonts.ready")
        output = await page.screenshot(type="png", clip={"x": 0, "y": 0, "width": RECEIPT_WIDTH, "height": RECEIPT_HEIGHT})
        await browser.close()
        return output


async def generateReceiptImage(member: dict) -> str:
    participant = member.get("participant") or {}
    full_name = str(participant.get("name") or member.get("name") or "Member").strip()
    safe_name = re.sub(r"[^\w\s-]", "", full_name).strip().replace(" ", "_") or "Member"
    filename = f"Noctivus26_Receipt_{safe_name}.png"

    temp_dir = Path("/tmp/receipts")
    temp_dir.mkdir(parents=True, exist_ok=True)
    file_path = str(temp_dir / filename)

    image_bytes = await render_receipt_artwork_bytes(member)
    with open(file_path, "wb") as f:
        f.write(image_bytes)

    return file_path
