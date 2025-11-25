"use client";

const navLinks = [
  {
    href: "/",
    label: "Home",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M3 10.5L12 4l9 6.5" />
        <path d="M5 11v9h14v-9" />
        <path d="M10 14h4v6h-4z" />
      </svg>
    ),
  },
  {
    href: "/blog",
    label: "Blog",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4 4h13l3 3v13H4z" />
        <path d="M17 4v3h3" />
        <path d="M7 9h10" />
        <path d="M7 13h10" />
        <path d="M7 17h6" />
      </svg>
    ),
  },
  {
    href: "/report",
    label: "Report",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4 4h10l2 4h4v10H4z" />
        <path d="M10 4v16" />
        <circle cx="16.5" cy="15.5" r="1.5" />
      </svg>
    ),
  },
];

export default function NavMenu() {
  return (
    <nav className="nav-icon-bar" aria-label="Secondary navigation">
      {navLinks.map((link) => (
        <a
          key={link.href}
          href={link.href}
          className="nav-icon-link"
          aria-label={link.label}
          title={link.label}
        >
          {link.icon}
          <span className="sr-only">{link.label}</span>
        </a>
      ))}
    </nav>
  );
}
