"use client";

import { useEffect, useMemo, useState } from "react";
import AppNavigation from "../components/AppNavigation";

type LocationItem = { legacyReference: string; description: string; quantityOnHand: number; lastCost: number; machineModel: string };
type LocationSummary = { location: string; partCount: number; unitsOnHand: number; items: LocationItem[] };

function locationParts(location: string) {
  const match = location.match(/^([A-Za-z]+)(\d+)([A-Za-z0-9]*)$/);
  return { sector: match?.[1].toUpperCase() || "AUTRES", row: Number(match?.[2] || 0), slot: match?.[3].toUpperCase() || "" };
}

export default function LocationMap() {
  const [locations, setLocations] = useState<LocationSummary[]>([]);
  const [sector, setSector] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/locations").then((response) => response.json()).then((payload) => {
      const rows = payload.locations as LocationSummary[];
      setLocations(rows);
      const firstSector = [...new Set(rows.map((row) => locationParts(row.location).sector))].sort()[0] ?? "";
      setSector(firstSector);
    }).finally(() => setLoading(false));
  }, []);

  const sectors = useMemo(() => [...new Set(locations.map((row) => locationParts(row.location).sector))].sort(), [locations]);
  const mappedLocations = useMemo(() => locations.filter((row) => locationParts(row.location).sector === sector).sort((left, right) => {
    const a = locationParts(left.location); const b = locationParts(right.location);
    return a.row - b.row || a.slot.localeCompare(b.slot);
  }), [locations, sector]);

  return <main className="shell">
    <AppNavigation active="locations" />
    <section className="location-hero">
      <div><p className="eyebrow">Stockroom</p><h1>Plan des emplacements</h1><p>Plan logique basé sur les codes d'emplacement. Chaque case affiche la pièce rangée à cet endroit.</p></div>
      <span>Rectangle du stockroom · à ajuster au plan physique</span>
    </section>
    <section className="map-layout">
      <div className="map-panel">
        <div className="sector-bar"><strong>Secteur</strong><div>{sectors.map((value) => <button key={value} className={value === sector ? "sector active" : "sector"} onClick={() => setSector(value)}>{value}</button>)}</div></div>
        <div className="warehouse-room">
          <div className="room-label">STOCKROOM · SECTEUR {sector || "—"}</div>
          {loading ? <p>Chargement du plan…</p> : <div className="location-grid">{mappedLocations.map((location) => <article key={location.location} className="location-cell"><strong>{location.location}</strong>{location.items.slice(0, 2).map((item) => <div className="location-part" key={item.legacyReference}><b>{item.legacyReference}</b><span title={item.description}>{item.description}</span><small>Qte. {item.quantityOnHand}</small></div>)}{location.partCount > 2 && <em>+ {location.partCount - 2} autre{location.partCount - 2 > 1 ? "s" : ""} pièce{location.partCount - 2 > 1 ? "s" : ""}</em>}</article>)}</div>}
        </div>
      </div>
    </section>
  </main>;
}
