import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X, Sun, Moon, ArrowRight, ArrowUpRight, Soup } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { scrollToId } from "./motion";

export function Logo() {
  return (
    <Link to="/" className="lp-logo" aria-label="BachelorMate home">
      <span className="lp-mark"><Soup /></span>
      BachelorMate
    </Link>
  );
}

export function GithubIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden width="18" height="18" {...props}>
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.19-3.08-.12-.3-.52-1.47.11-3.06 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.06.74.8 1.19 1.83 1.19 3.08 0 4.41-2.7 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}


const LINKS = [
  ["features", "Features"],
  ["how", "How it works"],
  ["finance", "Finance"],
  ["about", "About"],
];

export function ThemeToggle() {
  const theme = useTheme();
  const dark = theme.resolved === "dark";
  return (
    <button type="button" className="lp-iconbtn" onClick={() => theme.update({ mode: dark ? "light" : "dark" })} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title={dark ? "Light theme" : "Dark theme"}>
      {dark ? <Sun /> : <Moon />}
    </button>
  );
}

export default function Nav() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <>
      <header className={`lp-nav ${scrolled ? "scrolled" : ""}`}>
        <div className="lp-nav-inner">
          <Logo />
          <nav className="lp-navlinks" aria-label="Main">
            {LINKS.map(([id, label]) => (
              <a key={id} href={`/#${id}`} className="lp-navlink" onClick={(e) => scrollToId(e, id)}>{label}</a>
            ))}
            <Link to="/seats" className="lp-navlink">Find a seat</Link>
          </nav>
          <div className="lp-navright">
            <ThemeToggle />
            {user ? (
              <Link to="/app" className="lp-btn lp-btn-primary lp-btn-sm lp-hide-m">Open app</Link>
            ) : (
              <>
                <Link to="/login" className="lp-navlink lp-hide-m">Log in</Link>
                <Link to="/register" className="lp-btn lp-btn-primary lp-btn-sm lp-hide-m">Get started</Link>
              </>
            )}
            <button type="button" className="lp-iconbtn lp-burger" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}><Menu /></button>
          </div>
        </div>
      </header>

      {open && (
        <div className="lp-drawer" role="dialog" aria-modal="true" aria-label="Menu">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Logo />
            <div style={{ display: "flex", gap: 4 }}>
              <ThemeToggle />
              <button type="button" className="lp-iconbtn" aria-label="Close menu" onClick={() => setOpen(false)} autoFocus><X /></button>
            </div>
          </div>
          <nav aria-label="Mobile">
            {LINKS.map(([id, label]) => (
              <a key={id} href={`/#${id}`} onClick={(e) => { if (!document.getElementById(id)) return; e.preventDefault(); setOpen(false); setTimeout(() => scrollToId(null, id), 50); }}>
                {label} <ArrowUpRight />
              </a>
            ))}
            <Link to="/seats" onClick={() => setOpen(false)}>Find a seat <ArrowUpRight /></Link>
          </nav>
          <div className="lp-drawer-cta">
            {user ? (
              <Link to="/app" className="lp-btn lp-btn-primary">Open app <ArrowRight /></Link>
            ) : (
              <>
                <Link to="/register" className="lp-btn lp-btn-primary">Get started <ArrowRight /></Link>
                <Link to="/login" className="lp-btn lp-btn-ghost">Log in</Link>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
