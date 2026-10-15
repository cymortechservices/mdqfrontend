import { useEffect, useRef, useState, type ReactNode } from "react";
import { Logo } from "../components/brand/Logo";
import { ButtonLink } from "../components/ui/Button";
import { Icon, WhatsAppIcon } from "../components/ui/Icon";
import { Link, useLocation } from "../lib/router";
import { SITE } from "../lib/config";

const NAV = [
  { label: "How it works", to: "/#how-it-works" },
  { label: "Features", to: "/#features" },
  { label: "Pricing", to: "/#pricing" },
  { label: "FAQ", to: "/#faq" },
  { label: "Guide", to: "/learn" },
];

export function SkipLink() {
  return (
    <a className="skip-link" href="#main-content">
      Skip to main content
    </a>
  );
}

function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname, key } = useLocation();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu whenever the route changes.
  useEffect(() => setOpen(false), [pathname, key]);

  useEffect(() => {
    if (!open) return undefined;
    document.documentElement.classList.add("has-modal");
    panelRef.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
      if (event.key === "Tab" && panelRef.current) {
        const focusable = [toggleRef.current, ...Array.from(panelRef.current.querySelectorAll<HTMLElement>("a,button"))].filter(Boolean) as HTMLElement[];
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("has-modal");
    };
  }, [open]);

  return (
    <header className={`site-header ${scrolled || open ? "is-scrolled" : ""}`}>
      <div className="site-header__inner">
        <Logo />
        <nav className="site-nav" aria-label="Main navigation">
          <ul>
            {NAV.map((item) => (
              <li key={item.to}>
                <Link to={item.to} aria-current={item.to === pathname ? "page" : undefined}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="site-header__actions">
          <ButtonLink to="/login" variant="ghost" size="sm" className="hide-sm">
            Log in
          </ButtonLink>
          <ButtonLink to="/signup" size="sm" className="hide-sm">
            Sign up free
          </ButtonLink>
          <button
            ref={toggleRef}
            type="button"
            className="icon-btn menu-toggle"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            <Icon name={open ? "x" : "menu"} size={22} />
          </button>
        </div>
      </div>
      <div id="mobile-nav" ref={panelRef} className={`mobile-nav ${open ? "is-open" : ""}`} hidden={!open}>
        <nav aria-label="Mobile navigation">
          <ul>
            {NAV.map((item) => (
              <li key={item.to}>
                <Link to={item.to}>
                  {item.label}
                  <Icon name="chevronRight" size={18} />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mobile-nav__cta">
          <ButtonLink to="/login" variant="secondary" block>
            Log in
          </ButtonLink>
          <ButtonLink to="/signup" block iconRight="arrowRight">
            Sign up free
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  const email = SITE.generalEmail();
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <Logo />
          <p>Medical exam practice for student doctors.</p>
          <ul className="site-footer__contact" aria-label="Karimique contact information">
            <li>
              <a href={SITE.whatsappUrl} target="_blank" rel="noreferrer">
                <WhatsAppIcon size={16} /> {SITE.whatsappDisplay}
              </a>
            </li>
            <li>
              <a href={`mailto:${email}`}>
                <Icon name="mail" size={16} /> {email}
              </a>
            </li>
          </ul>
        </div>
        <nav className="site-footer__cols" aria-label="Footer">
          <div>
            <h2>Product</h2>
            <ul>
              <li><Link to="/#how-it-works">How it works</Link></li>
              <li><Link to="/#features">Features</Link></li>
              <li><Link to="/#pricing">Pricing</Link></li>
              <li><Link to="/#faq">FAQ</Link></li>
            </ul>
          </div>
          <div>
            <h2>Account</h2>
            <ul>
              <li><Link to="/">Home</Link></li>
              <li><Link to="/learn">Learn</Link></li>
              <li><Link to="/login">Log in</Link></li>
              <li><Link to="/signup">Sign up</Link></li>
            </ul>
          </div>
          <div>
            <h2>Legal</h2>
            <ul>
              <li><Link to="/terms">Terms of Service</Link></li>
              <li><Link to="/privacy-policy">Privacy Policy</Link></li>
              <li><a href={`mailto:${SITE.supportEmail}`}>Support</a></li>
            </ul>
          </div>
        </nav>
      </div>
      <div className="site-footer__bottom">
        <p>© 2026 {SITE.owner}. All rights reserved.</p>
        <p>MDQ is an educational study aid, not a medical service.</p>
      </div>
    </footer>
  );
}

export function WhatsAppFloat() {
  return (
    <a className="whatsapp-float" href={SITE.whatsappUrl} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp">
      <WhatsAppIcon size={24} />
    </a>
  );
}

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="public-shell">
      <SkipLink />
      <Header />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <Footer />
      <WhatsAppFloat />
    </div>
  );
}
