import React, { useState } from 'react';
import { TickDivider } from '../ui/TickDivider/TickDivider';
import { site } from '../../data/site.js';
import './FooterSection.css';

export function FooterSection() {
  const [showBusRouteModal, setShowBusRouteModal] = useState(false);

  const linkedinUrl = site?.social?.LinkedIn || 'https://linkedin.com';
  const instagramUrl = site?.social?.Instagram || 'https://instagram.com';
  const xUrl = site?.social?.X || 'https://x.com';

  const busRoutes = [
    { routeNo: 'Route 1', from: 'Central / Broadway', via: 'Vyasarpadi, MKB Nagar, Madhavaram, Red Hills Road' },
    { routeNo: 'Route 2', from: 'Tambaram', via: 'Chromepet, Guindy, Koyambedu, Ambattur OT, Surapet' },
    { routeNo: 'Route 3', from: 'Avadi', via: 'Pattabiram, Thirumullaivoyal, Ambattur OT, Surapet' },
    { routeNo: 'Route 4', from: 'Koyambedu (CMBT)', via: 'Thirumangalam, Mogappair, Ambattur Estate, Surapet' },
    { routeNo: 'Route 5', from: 'Tiruvallur', via: 'Tiruninravur, Avadi, Ambattur, Surapet' },
  ];

  return (
    <footer className="footer-section" id="footer">
      <div className="footer-container">

        {/* TOP ROW: Brand Header */}
        <div className="footer-brand-row">
          <div className="footer-brand-title">
            <span className="brand-word">NOCTIVUS</span>
            <span className="brand-year">'26</span>
          </div>
          <p className="footer-brand-tagline">
            NATIONAL LEVEL TECHNICAL SYMPOSIUM &bull; VELAMMAL ENGINEERING COLLEGE
          </p>
        </div>

        <TickDivider />

        {/* MAIN HUD GRID: Info Panels (Left) & Compact Google Map (Right) */}
        <div className="footer-hud-main">

          {/* LEFT SIDE: 3 Info Blocks */}
          <div className="footer-info-columns">

            {/* Venue */}
            <div className="footer-info-block">
              <div className="footer-info-heading">
                <svg className="footer-info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>VENUE</span>
              </div>
              <div className="footer-info-body">
                <p>Velammal Engineering College</p>
                <p>Ambattur–Red Hills Road,</p>
                <p>Surapet, Chennai,</p>
                <p>Tamil Nadu 600066</p>
              </div>
            </div>

            {/* Contact */}
            <div className="footer-info-block">
              <div className="footer-info-heading">
                <svg className="footer-info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <span>CONTACT</span>
              </div>
              <div className="footer-info-body">
                <p>
                  <a href="mailto:noctivus2026@gmail.com" className="footer-text-link">
                    noctivus2026@gmail.com
                  </a>
                </p>
                <p>
                  <a href="tel:+919884017375" className="footer-text-link">
                    +91 98840 17375
                  </a>
                </p>
              </div>
            </div>

            {/* Bus Route */}
            <div className="footer-info-block">
              <div className="footer-info-heading">
                <svg className="footer-info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="15" rx="2" />
                  <path d="M3 9h18" />
                  <circle cx="7" cy="15" r="1" />
                  <circle cx="17" cy="15" r="1" />
                  <path d="M5 18v2" />
                  <path d="M19 18v2" />
                </svg>
                <span>BUS ROUTE</span>
              </div>
              <div className="footer-info-body">
                <button
                  type="button"
                  className="footer-bus-btn"
                  onClick={() => setShowBusRouteModal(true)}
                >
                  <span>View Bus Route</span>
                  <svg className="footer-ext-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </button>
              </div>
            </div>

          </div>

          {/* RIGHT SIDE: Compact Google Map */}
          <div className="footer-map-side">
            <div className="footer-compact-map">
              <iframe
                title="Velammal Engineering College Location Map"
                src="https://maps.google.com/maps?q=Velammal+Engineering+College%2C+Surapet%2C+Chennai&t=&z=15&ie=UTF8&iwloc=&output=embed"
                className="footer-map-iframe"
                loading="lazy"
                allowFullScreen
              />
              <a
                href="https://www.google.com/maps/dir/?api=1&destination=Velammal+Engineering+College%2C+Surapet%2C+Chennai+600066"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-map-link"
                aria-label="Open directions in Google Maps"
              >
                Maps ↗
              </a>
            </div>
          </div>

        </div>

        {/* CENTER BOTTOM: Social Media Action Buttons */}
        <div className="footer-social-center-wrap">
          <div className="footer-social-actions">
            {/* LinkedIn */}
            <a
              href={linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="footer-social-btn"
            >
              <svg className="footer-social-icon" viewBox="0 0 24 24">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
              </svg>
            </a>

            {/* Instagram */}
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="footer-social-btn"
            >
              <svg className="footer-social-icon" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </a>

            {/* X */}
            <a
              href={xUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X"
              className="footer-social-btn"
            >
              <svg className="footer-social-icon footer-x-icon" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
        </div>

        {/* Footer Bottom Copyright Bar */}
        <div className="footer-hud-bottom">
          <p className="footer-hud-copyright">
            &copy; 2026 Noctivus ’26. Department of CSE (Cyber Security), Velammal Engineering College. All rights reserved.
          </p>

          <a href="#home" className="footer-hud-back-to-top">
            Back to top <span className="footer-hud-arrow">↑</span>
          </a>
        </div>

      </div>

      {/* Bus Route Modal */}
      {showBusRouteModal && (
        <div className="bus-modal-backdrop" onClick={() => setShowBusRouteModal(false)}>
          <div className="bus-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="bus-modal-header">
              <h3>CAMPUS BUS ROUTES</h3>
              <button
                type="button"
                className="bus-modal-close"
                onClick={() => setShowBusRouteModal(false)}
                aria-label="Close Bus Routes Modal"
              >
                &times;
              </button>
            </div>
            <p className="bus-modal-desc">
              College buses will operate on symposium day (26 Sept 2026) across key routes in Chennai.
            </p>
            <div className="bus-routes-table-wrap">
              <table className="bus-routes-table">
                <thead>
                  <tr>
                    <th>ROUTE</th>
                    <th>STARTING POINT</th>
                    <th>VIA KEY STOPS</th>
                  </tr>
                </thead>
                <tbody>
                  {busRoutes.map((r, i) => (
                    <tr key={i}>
                      <td className="bus-route-no">{r.routeNo}</td>
                      <td className="bus-route-from">{r.from}</td>
                      <td className="bus-route-via">{r.via}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bus-modal-footer">
              <a
                href="/bus-routes.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="bus-download-btn"
              >
                Download Official Bus Schedule (PDF) ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
