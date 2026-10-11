import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { TOP_NAV, SECONDARY_NAV } from "@garden/domain";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "The Garden — public study", template: "%s | The Garden" },
  description: "Understand a proposed self-government framework, examine its historical context, funding risks and research standards.",
  robots: { index: false, follow: false }
};

export default function PublicLayout({children}:{children:ReactNode}) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">Skip to main content</a>
        <div className="preheader">PUBLIC DESIGN PREVIEW · DRAFT LEGISLATION · NOT AN OFFICIAL PROGRAM</div>
        <header className="site-header">
          <div className="topbar wrap">
            <Link href="/" className="logo"><span aria-hidden="true" className="logo-mark">✦</span> The Garden</Link>
            <nav aria-label="Primary" className="main-nav">
              {TOP_NAV.map(item=><Link key={item.href} href={item.href}>{item.label}</Link>)}
              <a className="sign-in" href="#workspace-notice" aria-label="Researcher sign-in not yet available">Researcher access <span aria-hidden="true">↗</span></a>
            </nav>
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="site-footer">
          <div className="wrap footer-inner">
            <div>
              <div className="footer-brand">✦ The Garden</div>
              <p>An independent public study of proposed legislation and incomplete historical research.</p>
              <p>No official enrollment, accounts, donation system or historical source intake is operating.</p>
            </div>
            <nav aria-label="Further information" className="footer-links">
              {SECONDARY_NAV.map(item=><Link key={item.href} href={item.href}>{item.label}</Link>)}
              <a href="https://github.com/neophilism/The-Garden">Development repository</a>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
