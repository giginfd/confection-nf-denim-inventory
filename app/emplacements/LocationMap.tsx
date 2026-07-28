"use client";

import { useEffect, useMemo, useState } from "react";
import AppNavigation from "../components/AppNavigation";

type LocationSummary = { location: string; partCount: number; unitsOnHand: number };
type LocationItem = { legacyReference: string; description: string; quantityOnHand: number; lastCost: number; machineModel: string };

function locationParts(location: string) {
  const match = location.match(/^([A-Za-z]+)(\d+)([A-Za-z0-9]*)$/);
  return { sector: match?.[1].toUpperCase() || "AUTRES", row: Number(match?.[2] || 0), slot: match?.[3].toUpperCase() || "" };
}

export default function LocationMap() {
  const [locations, setLocations] = useState<LocationSummary[]>([]);
  const [sector, setSector] = useState("");
  const [selected, setSelected] = useState<LocationSummary | null>(null);
  const [contents, setContents] = useState<LocationItem[]>([]);
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

  const showContents = async (location: LocationSummary) => {
    setSelected(location);
    setContents([]);
    const response = await fetch(`/api/locations/${encodeURIComponent(location.location)}`);
    if (response.ok) setContents((await response.json()).items);
  };

  return <main className="shell">
    <AppNavigation active="locations" />
    <section className="location-hero">
      <div><p className="eyebrow">Stockroom</p><h1>Plan des emplacements</h1><p>Plan logique basé sur les codes d'emplacement. Touchez un emplacement pour voir les pièces qu'il contient.</p></div>
      <span>Rectangle du stockroom · à ajuster au plan physique</span>
    </section>
    <section className="map-layout">
      <div className="map-panel">
        <div className="sector-bar"><strong>Secteur</strong><div>{sectors.map((value) => <button key={value} className={value === sector ? "sector active" : "sector"} onClick={() => { setSector(value); setSelected(null); }}>{value}</button>)}</div></div>
        <div className="warehouse-room">
          <div className="room-label">STOCKROOM · SECTEUR {sector || "—"}</div>
          {loading ? <p>Chargement du plan…</p> : <div className="location-grid">{mappedLocations.map((location) => <button key={location.location} className={selected?.location === location.location ? "location-cell active" : "location-cell"} onClick={() => void showContents(location)}><strong>{location.location}</strong><span>{location.partCount} pièce{location.partCount > 1 ? "s" : ""}</span><small>{location.unitsOnHand} en stock</small></button>)}</div>}
        </div>
      </div>
      <aside className="location-detail">
        {selected ? <><p className="eyebrow">Emplacement</p><h2>{selected.location}</h2><p className="detail-meta">{selected.partCount} fiche{selected.partCount > 1 ? "s" : ""} · {selected.unitsOnHand} unités</p><div className="location-items">{contents.length ? contents.map((item) => <article key={item.legacyReference}><strong>{item.legacyReference} · {item.description}</strong><span>Qte. {item.quantityOnHand}{item.machineModel ? ` · ${item.machineModel}` : ""}</span></article>) : <p>Chargement des pièces…</p>}</div></> : <><p className="eyebrow">Sélection</p><h2>Choisissez un emplacement</h2><p>Le contenu de l'emplacement apparaîtra ici.</p></>}
      </aside>
    </section>
  </main>;
}
