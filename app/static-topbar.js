import { primaryNavigation } from "./site-config.js";

export function StaticTopbar({ current }) {
  return (
    <header className="topbar">
      <div className="brand-zone">
        <a className="brand" href="/">
          <span className="brand-mark">L</span>
          <span className="brand-name">Lingua</span>
          <span className="brand-product">Reader</span>
        </a>
      </div>
      <nav className="topnav" aria-label="主导航">
        {primaryNavigation.map((item) => (
          <a
            className={`nav-link ${item.secondary ? "nav-link-secondary" : ""} ${current === item.id ? "active" : ""}`}
            href={item.href}
            aria-current={current === item.id ? "page" : undefined}
            key={item.id}
          >
            {item.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
