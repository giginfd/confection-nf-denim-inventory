"use client";

import { useEffect, useState } from "react";

export default function AppNavigation({ active }: { active: "inventory" | "locations" | "pricing" }) {
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
        <a className={active === "inventory" ? "active" : ""} href="/">Inventaire</a>
        <a className={active === "locations" ? "active" : ""} href="/emplacements">Plan des emplacements</a>
        <a className={active === "pricing" ? "active" : ""} href="/prix-disponibilite">Prix & disponibilité</a>
      </div>
    </nav>
  );
}
