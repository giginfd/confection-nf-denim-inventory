"use client";

import { useEffect, useState } from "react";

export default function AppNavigation({ active }: { active: "inventory" | "locations" | "machines" | "suppliers" }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const label = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "America/Toronto",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);

  return (
    <nav className="top-nav" aria-label="Navigation principale">
      <span className="time-stamp">{label} ET</span>
      <div className="nav-links">
        <a className={`inventory-nav-link ${active === "inventory" ? "active" : ""}`} href="/"><span className="mobile-exit-icon" aria-hidden="true">↩</span><span className="desktop-nav-label">Inventaire</span><span className="mobile-nav-label">Retour à l’inventaire</span></a>
        <a className={active === "locations" ? "active" : ""} href="/emplacements">Emplacements</a>
        <a className={active === "machines" ? "active" : ""} href="/machines">Machines</a>
        <a className={active === "suppliers" ? "active" : ""} href="/fournisseurs">Fournisseurs</a>
      </div>
    </nav>
  );
}
