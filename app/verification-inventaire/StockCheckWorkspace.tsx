"use client";

import { useEffect, useMemo, useState } from "react";
import AppNavigation from "../components/AppNavigation";
import type { InventoryItem } from "../lib/inventory-types";

type LocationSummary = { location: string; partCount: number; unitsOnHand: number };

function locationSector(location: string) {
  return location.match(/^([A-Za-z]+)/)?.[1].toUpperCase() || "AUTRES";
}

function sortSectors(left: string, right: string) {
  if (left === "AUTRES") return 1;
  if (right === "AUTRES") return -1;
  return left.localeCompare(right, "fr-CA");
}

export default function StockCheckWorkspace() {
  const [locations, setLocations] = useState<LocationSummary[]>([]);
  const [sector, setSector] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [editingCountIds, setEditingCountIds] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void fetch("/api/locations").then(async (response) => {
      const data = await response.json() as { locations?: LocationSummary[] };
      const rows = data.locations ?? [];
      setLocations(rows);
      setSector([...new Set(rows.map((row) => locationSector(row.location)))].sort(sortSectors)[0] ?? "");
    }).catch(() => setNotice("Impossible de charger les emplacements.")).finally(() => setLoading(false));
  }, []);

  const sectors = useMemo(() => [...new Set(locations.map((row) => locationSector(row.location)))].sort(sortSectors), [locations]);
  const sectorLocations = useMemo(() => locations.filter((row) => locationSector(row.location) === sector).sort((left, right) => left.location.localeCompare(right.location, "fr-CA", { numeric: true })), [locations, sector]);
  const allCounted = items.length > 0 && items.every((item) => counts[item.id] !== undefined && counts[item.id] !== "");
  const differences = items.filter((item) => Number(counts[item.id]) !== item.quantityOnHand);

  async function chooseLocation(location: string) {
    setSelectedLocation(location);
    setItems([]);
    setCounts({});
    setEditingCountIds({});
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch(`/api/locations/${encodeURIComponent(location)}`);
      const data = await response.json() as { items?: InventoryItem[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Impossible de charger cet emplacement.");
      const rows = data.items ?? [];
      setItems(rows);
      setCounts(Object.fromEntries(rows.map((item) => [item.id, ""])));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Impossible de charger cet emplacement.");
    } finally {
      setLoading(false);
    }
  }

  function markAllCorrect() {
    setCounts(Object.fromEntries(items.map((item) => [item.id, String(item.quantityOnHand)])));
    setEditingCountIds({});
  }

  function markCorrect(item: InventoryItem) {
    setCounts((current) => ({ ...current, [item.id]: String(item.quantityOnHand) }));
    setEditingCountIds((current) => ({ ...current, [item.id]: false }));
  }

  function startCorrection(item: InventoryItem) {
    setEditingCountIds((current) => ({ ...current, [item.id]: true }));
  }

  function saveCorrection(item: InventoryItem) {
    if (counts[item.id] === "") return;
    setEditingCountIds((current) => ({ ...current, [item.id]: false }));
  }

  async function confirmCheck() {
    if (!selectedLocation || !allCounted) return;
    const summary = differences.length ? `${differences.length} écart${differences.length > 1 ? "s" : ""} sera${differences.length > 1 ? "ont" : ""} ajusté${differences.length > 1 ? "s" : ""}.` : "Aucun écart : aucune quantité ne sera modifiée.";
    if (!window.confirm(`Confirmer la vérification de ${selectedLocation}?\n\n${summary}\n\nLes fiches ne seront jamais supprimées; une trace de chaque ajustement sera conservée.`)) return;
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/stock-checks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ location: selectedLocation, lines: items.map((item) => ({ inventoryId: item.id, countedQuantity: Number(counts[item.id]) })) }) });
      const data = await response.json() as { adjustments?: number; linesChecked?: number; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Impossible de confirmer la vérification.");
      await chooseLocation(selectedLocation);
      setNotice(`${data.linesChecked ?? items.length} pièce(s) vérifiée(s) à ${selectedLocation}. ${data.adjustments ? `${data.adjustments} ajustement(s) ajouté(s) à l’historique.` : "Aucun ajustement nécessaire."}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Impossible de confirmer la vérification.");
    } finally {
      setSaving(false);
    }
  }

  return <main className="shell">
    <AppNavigation active="locations" />
    <section className="stock-check-hero"><div><p className="eyebrow">Plan des emplacements</p><h1>Vérification d’inventaire</h1><p>Choisissez un emplacement, comptez les pièces, puis enregistrez les corrections. Une quantité à zéro garde toujours la fiche de pièce.</p></div><a className="secondary history-back" href="/emplacements">Retour au plan</a></section>
    {notice && <p className="notice" role="status">{notice}</p>}
    <section className="stock-check-steps"><span className={selectedLocation ? "done" : "active"}>1. Secteur</span><span className={selectedLocation ? "active" : ""}>2. Compter</span><span className={allCounted ? "active" : ""}>3. Enregistrer</span></section>
    <section className="stock-check-layout">
      <aside className="stock-check-locations"><h2>1. Choisir un emplacement</h2><div className="stock-check-sectors">{sectors.map((value) => <button key={value} className={sector === value ? "sector active" : "sector"} onClick={() => { setSector(value); setSelectedLocation(""); setItems([]); setCounts({}); setEditingCountIds({}); }}>{value}</button>)}</div><div className="stock-check-location-list">{sectorLocations.map((location) => <button key={location.location} className={selectedLocation === location.location ? "active" : ""} onClick={() => void chooseLocation(location.location)}><strong>{location.location}</strong><span>{location.partCount} pièce{location.partCount > 1 ? "s" : ""} · {location.unitsOnHand} unités prévues</span></button>)}</div></aside>
      <section className="stock-check-count">
        <div className="stock-check-count-heading"><div><p className="eyebrow">{selectedLocation ? `Emplacement ${selectedLocation}` : "Sélectionnez un emplacement"}</p><h2>{selectedLocation ? "2. Compter les pièces" : "Prêt à commencer"}</h2></div>{items.length > 0 && <button className="secondary" onClick={markAllCorrect}>Tout est OK</button>}</div>
        {loading && <p className="empty">Chargement…</p>}
        {!loading && !selectedLocation && <p className="empty">Commencez avec le premier emplacement de votre secteur.</p>}
        {!loading && selectedLocation && <>
          <p className="stock-check-help">Pour chaque pièce, appuyez sur <b>OK</b> si le nombre est bon. Sinon, appuyez sur <b>Corriger</b>.</p>
          <div className="stock-check-items">{items.map((item) => {
            const entered = counts[item.id];
            const isCorrecting = Boolean(editingCountIds[item.id]);
            const different = entered !== "" && Number(entered) !== item.quantityOnHand;
            const checked = entered !== "" && !isCorrecting;
            return <article className={`stock-check-item ${different ? "different" : ""}`} key={item.id}>
              <div><b className="sku">{item.legacyReference}</b><strong>{item.description}</strong>{item.machineModel && <span className="stock-check-part-info">Machine : {item.machineModel}</span>}{item.supplierName && <span className="stock-check-part-info">Fournisseur : {item.supplierName}</span>}</div>
              <div className="stock-check-action">
                <div className="stock-system-quantity"><span>Qté dans le système</span><strong>{item.quantityOnHand}</strong></div>
                {!isCorrecting ? <div className="stock-check-buttons"><button type="button" className="stock-ok-button" onClick={() => markCorrect(item)}>OK</button><button type="button" className="secondary" onClick={() => startCorrection(item)}>Corriger</button></div> : <div className="stock-check-correction"><label><span>Qté comptée</span><input autoFocus inputMode="decimal" type="number" min="0" value={entered ?? ""} onChange={(event) => setCounts((current) => ({ ...current, [item.id]: event.target.value }))} /></label><button type="button" className="primary" disabled={entered === ""} onClick={() => saveCorrection(item)}>Enregistrer</button></div>}
                {checked && <span className={`stock-check-result ${different ? "corrected" : "ok"}`}>{different ? `Corrigé : ${entered}` : "OK"}</span>}
              </div>
            </article>;
          })}</div>
          {items.length > 0 && <div className="stock-check-review"><div><strong>{allCounted ? differences.length ? `${differences.length} correction${differences.length > 1 ? "s" : ""} à enregistrer` : "Toutes les pièces sont OK" : "Faites OK ou Corriger pour chaque pièce"}</strong><p>{allCounted ? differences.length ? "Les corrections seront appliquées seulement après ce dernier bouton." : "Vous pouvez maintenant enregistrer cette vérification." : ""}</p></div><button className="primary" disabled={!allCounted || saving} onClick={() => void confirmCheck()}>{saving ? "Enregistrement…" : "Enregistrer la vérification"}</button></div>}
        </>}
      </section>
    </section>
  </main>;
}
