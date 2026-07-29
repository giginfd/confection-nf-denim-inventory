"use client";

import { useEffect, useState } from "react";
import AppNavigation from "../components/AppNavigation";

type Movement = {
  id: number;
  inventoryId: number;
  legacyReference: string;
  description: string;
  movementType: string;
  quantityDelta: number;
  quantityBefore: number;
  quantityAfter: number;
  location: string;
  supplierName: string;
  invoiceNumber: string;
  note: string;
  createdAt: string;
  canReverse: boolean;
};

type Change = { id: number; inventoryId: number; legacyReference: string; description: string; changeType: string; note: string; createdAt: string };

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" }).format(new Date(value));
}

function deltaLabel(value: number) {
  return `${value > 0 ? "+" : ""}${value.toLocaleString("fr-CA")}`;
}

export default function InventoryHistory() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [changes, setChanges] = useState<Change[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(0);
  const [loading, setLoading] = useState(true);
  const [reversing, setReversing] = useState<number | null>(null);
  const [notice, setNotice] = useState("");

  async function load(offset = 0, append = false) {
    setLoading(true);
    try {
      const response = await fetch(`/api/history?offset=${offset}`);
      const data = await response.json() as { movements?: Movement[]; changes?: Change[]; nextOffset?: number | null; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Impossible de charger l’historique.");
      const rows = data.movements ?? [];
      setMovements((current) => append ? [...current, ...rows] : rows);
      if (!append) setChanges(data.changes ?? []);
      setNextOffset(data.nextOffset ?? null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Impossible de charger l’historique.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function reverse(movement: Movement) {
    const approved = window.confirm(`Annuler ce mouvement?\n\n${movement.legacyReference} — ${movement.description}\nLa quantité actuelle sera ajustée de ${deltaLabel(-movement.quantityDelta)}. L’annulation sera elle-même ajoutée à l’historique.`);
    if (!approved) return;
    setReversing(movement.id);
    setNotice("");
    try {
      const response = await fetch(`/api/stock-movements/${movement.id}/reverse`, { method: "POST" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Impossible d’annuler ce mouvement.");
      setNotice("Mouvement annulé. L’ancienne action reste visible ci-dessous et l’annulation a été ajoutée.");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Impossible d’annuler ce mouvement.");
    } finally {
      setReversing(null);
    }
  }

  return <main className="shell">
    <AppNavigation active="inventory" />
    <section className="history-hero">
      <div><p className="eyebrow">Inventaire</p><h1>Historique des mouvements</h1><p>Chaque entrée, sortie, correction et écart confirmé est conservé ici. Annuler crée une nouvelle trace : rien n’est effacé.</p></div>
      <a className="secondary history-back" href="/">Retour à l’inventaire</a>
    </section>
    {notice && <p className="notice" role="status">{notice}</p>}
    <section className="history-list" aria-label="Historique des mouvements d’inventaire">
      {movements.map((movement) => <article className="history-row" key={movement.id}>
        <div className={`history-delta ${movement.quantityDelta < 0 ? "negative" : "positive"}`}>{deltaLabel(movement.quantityDelta)}</div>
        <div className="history-details"><div className="history-main"><div><strong>{movement.movementType}</strong><p><b className="sku">{movement.legacyReference}</b> · {movement.description}</p></div><time>{dateLabel(movement.createdAt)}</time></div><p className="history-meta">{movement.quantityBefore} → {movement.quantityAfter}{movement.location ? ` · ${movement.location}` : ""}{movement.note ? ` · ${movement.note}` : ""}</p><a className="machine-inventory-link" href={`/?search=${encodeURIComponent(movement.legacyReference)}`}>Ouvrir la pièce</a></div>
        <div className="history-actions">{movement.canReverse ? <button className="secondary" disabled={reversing === movement.id} onClick={() => void reverse(movement)}>{reversing === movement.id ? "Annulation…" : "Annuler ce mouvement"}</button> : <span>Une action plus récente existe</span>}</div>
      </article>)}
      {!loading && !movements.length && <p className="empty">Aucun mouvement d’inventaire n’a encore été enregistré.</p>}
    </section>
    {!!changes.length && <section className="history-changes"><h2>Autres modifications de fiches</h2><p>Ces changements restent consultables. Pour corriger un champ comme la description, le fournisseur ou l’emplacement, ouvrez simplement la fiche.</p><div>{changes.map((change) => <article key={change.id}><div><strong>{change.changeType}</strong><span><b className="sku">{change.legacyReference}</b> · {change.description}</span><small>{change.note || "Modification sauvegardée"} · {dateLabel(change.createdAt)}</small></div><a className="machine-inventory-link" href={`/?search=${encodeURIComponent(change.legacyReference)}`}>Ouvrir la pièce</a></article>)}</div></section>}
    {loading && <p className="history-loading">Chargement…</p>}
    {!loading && nextOffset !== null && <button className="secondary history-more" onClick={() => void load(nextOffset, true)}>Afficher les mouvements plus anciens</button>}
  </main>;
}
