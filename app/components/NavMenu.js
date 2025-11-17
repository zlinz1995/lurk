"use client";

import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/blog", label: "Blog" },
  { href: "/faq", label: "FAQ" },
  { href: "/rules", label: "Rules" },
  { href: "/report", label: "Report" },
];

export default function NavMenu() {
  const pathname = usePathname();
  const current = links.find((link) => link.href === pathname)?.label || "Menu";

  return (
    <div className="nav-shell">
      <details className="nav-toggle" open>
        <summary>
          <span className="nav-toggle-label">{current}</span>
          <span className="nav-toggle-count">{links.length}</span>
        </summary>

        <nav className="nav-bar">
          {links.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
      </details>
    </div>
  );
}
