"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import AppNavigation from "../components/AppNavigation";

type LocationItem = { legacyReference: string; description: string; quantityOnHand: number; lastCost: number; machineModel: string };
type LocationSummary = { location: string; partCount: number; unitsOnHand: number; items: LocationItem[] };

function locationParts(location: string) {
  const match = location.match(/^([A-Za-z]+)(\d+)([A-Za-z0-9]*)$/);
  return { sector: match?.[1].toUpperCase() || "AUTRES", row: Number(match?.[2] || 0), slot: match?.[3].toUpperCase() || "" };
}

function sortSectors(left: string, right: string) {
  if (left === "AUTRES") return 1;
  if (right === "AUTRES") return -1;
  return left.localeCompare(right, "fr-CA");
}

export default function LocationMap() {
  const [locations, setLocations] = useState<LocationSummary[]>([]);
  const [sector, setSector] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/locations").then((response) => response.json()).then((payload) => {
      const rows = payload.locations as LocationSummary[];
      setLocations(rows);
      const firstSector = [...new Set(rows.map((row) => locationParts(row.location).sector))].sort(sortSectors)[0] ?? "";
      setSector(firstSector);
    }).finally(() => setLoading(false));
  }, []);

  const sectors = useMemo(() => [...new Set(locations.map((row) => locationParts(row.location).sector))].sort(sortSectors), [locations]);
  const mappedLocations = useMemo(() => locations.filter((row) => locationParts(row.location).sector === sector).filter((row) => !locationSearch.trim() || row.location.toLocaleUpperCase("fr-CA").includes(locationSearch.trim().toLocaleUpperCase("fr-CA"))).sort((left, right) => {
    const a = locationParts(left.location); const b = locationParts(right.location);
    return a.row - b.row || a.slot.localeCompare(b.slot);
  }), [locations, sector, locationSearch]);

  function findLocation(event: FormEvent) {
    event.preventDefault();
    const match = locations.find((row) => row.location.toLocaleUpperCase("fr-CA") === locationSearch.trim().toLocaleUpperCase("fr-CA"));
    if (match) setSector(locationParts(match.location).sector);
  }

  return <main className="shell">
    <AppNavigation active="locations" />
    <section className="location-hero">
      <div><h1>Plan des emplacements</h1></div>
    </section>
    <section className="map-layout">
      <div className="map-panel">
        <form className="location-lookup" onSubmit={findLocation}><label><span>Trouver un emplacement</span><input value={locationSearch} onChange={(event) => setLocationSearch(event.target.value.toUpperCase())} placeholder="Ex. A01B" /></label><button className="primary" type="submit">Rechercher</button></form>
        <div className="location-check-row"><a className="location-check-link" href="/verification-inventaire"><span>Vérifier l’inventaire</span><small>Compter et corriger les pièces</small></a></div>
        <div className="sector-bar"><strong>Secteur</strong><div>{sectors.map((value) => <button key={value} className={value === sector ? "sector active" : "sector"} onClick={() => setSector(value)}>{value}</button>)}</div></div>
        <div className="warehouse-room">
          <div className="room-label">SECTEUR {sector || "—"}</div>
          {loading ? <p>Chargement du plan…</p> : <div className="location-grid">{mappedLocations.map((location) => <a key={location.location} className="location-cell" href={`/?location=${encodeURIComponent(location.location)}`} aria-label={`Voir les pièces de l’emplacement ${location.location}`}><strong>{location.location}</strong>{location.items.slice(0, 1).map((item) => <div className="location-part" key={item.legacyReference}><b>{item.legacyReference}</b><span title={item.description}>{item.description}</span><small>Quantité : {item.quantityOnHand}</small></div>)}{location.partCount > 1 && <em>{location.partCount} pièces dans cet emplacement</em>}<span className="location-open">Voir les pièces →</span></a>)}</div>}
        </div>
      </div>
    </section>
  </main>;
}
