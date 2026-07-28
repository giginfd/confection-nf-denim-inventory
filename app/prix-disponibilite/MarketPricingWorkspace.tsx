"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import AppNavigation from "../components/AppNavigation";
import type { InventoryItem } from "../lib/inventory-types";

type MarketOffer = {
  id: number;
  inventoryId: number;
  legacyReference: string;
  sourceName: string;
  listingUrl: string;
  price: number;
  currency: string;
  availability: string;
  matchStatus: string;
  note: string;
  checkedAt: string;
};

type OfferForm = Pick<MarketOffer, "sourceName" | "listingUrl" | "price" | "currency" | "availability" | "matchStatus" | "note">;
type LiveCandidate = { sourceName: string; listingUrl: string; title: string; sku: string; price: number; currency: string; currencyNeedsVerification: boolean; availability: string; matchStatus: string };

const sources = [
  ["Central Sewing", "centralsewing.com"], ["RB Digital", "rbdigital.ca"], ["Excelle Machine à Coudre", "excellemachineacoudre.com"], ["Sewing Perfection", "sewingperfection.com"], ["Grainger Canada", "grainger.ca"], ["Strapco", "strapco.ca"], ["Wainbee", "wainbee.com"], ["Bobbin USA", "bobbinusa.com"], ["Jacksew", "parts.jacksew.com"], ["Sewing Parts Online", "sewingpartsonline.com"], ["eBay", "ebay.com"], ["Amazon", "amazon.com"], ["Walmart", "walmart.com"],
] as const;

const emptyOffer: OfferForm = { sourceName: "Jacksew", listingUrl: "", price: 0, currency: "CAD", availability: "in_stock", matchStatus: "exact", note: "" };

function money(value: number, currency: string) {
  try { return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(value); } catch { return `${value.toFixed(2)} ${currency}`; }
}

function date(value: string) {
  return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" }).format(new Date(value));
}

function searchUrl(domain: string, item: InventoryItem) {
  const query = `site:${domain} "${item.legacyReference}" "${item.description}"`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

export default function MarketPricingWorkspace() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [offers, setOffers] = useState<MarketOffer[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<OfferForm>(emptyOffer);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingJacksew, setCheckingJacksew] = useState(false);
  const [liveCandidates, setLiveCandidates] = useState<LiveCandidate[]>([]);
  const [liveLookupMessage, setLiveLookupMessage] = useState("");
  const [notice, setNotice] = useState("");

  const load = async (term = "") => {
    setLoading(true);
    try {
      const [inventoryResponse, offersResponse] = await Promise.all([
        fetch(`/api/inventory?search=${encodeURIComponent(term)}`),
        fetch("/api/market-offers"),
      ]);
      if (!inventoryResponse.ok || !offersResponse.ok) throw new Error("Unable to load pricing research.");
      setItems((await inventoryResponse.json()).items);
      setOffers((await offersResponse.json()).offers);
      setNotice("");
    } catch {
      setNotice("Unable to load the pricing research. Please try again.");
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(search), 260);
    return () => window.clearTimeout(timer);
  }, [search]);

  const latestOfferByItem = useMemo(() => {
    const map = new Map<number, MarketOffer>();
    for (const offer of offers) if (!map.has(offer.inventoryId)) map.set(offer.inventoryId, offer);
    return map;
  }, [offers]);

  const openResearch = (item: InventoryItem) => {
    setSelected(item);
    setForm(emptyOffer);
    setLiveCandidates([]);
    setLiveLookupMessage("");
  };

  const checkJacksew = async () => {
    if (!selected) return;
    setCheckingJacksew(true);
    setLiveCandidates([]);
    setLiveLookupMessage("");
    try {
      const response = await fetch(`/api/market-lookup/jacksew/${selected.id}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to check Jacksew.");
      setLiveCandidates(payload.candidates ?? []);
      setLiveLookupMessage(payload.candidates?.length ? "Review a candidate before using it. Nothing has been saved." : "No priced Jacksew candidates were found for this reference.");
    } catch (error) {
      setLiveLookupMessage(error instanceof Error ? error.message : "Unable to check Jacksew.");
    } finally { setCheckingJacksew(false); }
  };

  const useCandidate = (candidate: LiveCandidate) => {
    setForm({ sourceName: candidate.sourceName, listingUrl: candidate.listingUrl, price: candidate.price, currency: candidate.currency, availability: candidate.availability, matchStatus: candidate.matchStatus, note: `${candidate.title}${candidate.sku ? ` · SKU ${candidate.sku}` : ""}${candidate.currencyNeedsVerification ? " · Verify the displayed currency before saving." : ""}` });
  };

  const saveOffer = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      const response = await fetch("/api/market-offers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, inventoryId: selected.id }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to save the listing.");
      setSelected(null);
      setNotice("Confirmed market listing saved. Your internal cost was not changed.");
      await load(search);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save the listing.");
    } finally { setSaving(false); }
  };

  return <main className="shell">
    <AppNavigation active="pricing" />
    <section className="pricing-hero">
      <div><p className="eyebrow">Supplier research</p><h1>Prix & disponibilité</h1><p>Compare your last cost with confirmed supplier and marketplace listings. Every saved price keeps its original currency and a link to the source.</p></div>
      <span>Never assume a match, a currency, or availability.</span>
    </section>
    {notice && <div className="notice" role="status">{notice}</div>}
    <section className="research-rules" aria-label="Pricing research rules">
      <strong>How to use this page</strong><span>1. Search a part. 2. Open a supplier search. 3. Verify the exact part. 4. Save the confirmed price, currency, availability, and link.</span>
    </section>
    <section className="pricing-panel">
      <div className="section-heading"><div><p className="eyebrow">Catalogue</p><h2>Recherche de prix</h2></div><span className="results-count">{loading ? "Loading…" : `${items.length.toLocaleString()} parts`}</span></div>
      <div className="search-row"><label className="search-box"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product no., description, supplier, location, or machine" aria-label="Search parts for pricing" /></label></div>
      <div className="table-wrap"><table><thead><tr><th>No produit</th><th>Description</th><th>Prix coûtant</th><th>Dernière offre marché</th><th>Disponibilité</th><th></th></tr></thead><tbody>{items.slice(0, 100).map((item) => {
        const offer = latestOfferByItem.get(item.id);
        return <tr key={item.id}><td className="sku">{item.legacyReference}</td><td><strong>{item.description}</strong><small>{item.machineModel || "Machine model not recorded"}</small></td><td>{money(item.lastCost, "CAD")}</td><td>{offer ? <><a className="offer-link" href={offer.listingUrl} target="_blank" rel="noreferrer">{money(offer.price, offer.currency)} · {offer.sourceName}</a><small>{matchLabel(offer.matchStatus)} · checked {date(offer.checkedAt)}</small></> : <span className="muted">Not researched</span>}</td><td>{offer ? <span className={`availability ${offer.availability}`}>{availabilityLabel(offer.availability)}</span> : <span className="muted">—</span>}</td><td><button className="secondary research-button" onClick={() => openResearch(item)}>Research</button></td></tr>;
      })}</tbody></table></div>
      {items.length > 100 && <p className="table-foot">Showing the first 100 matches. Refine the search to narrow the list.</p>}
    </section>

    {selected && <div className="modal-backdrop" role="presentation"><section className="editor market-editor" role="dialog" aria-modal="true" aria-label="Research market price"><div className="editor-heading"><div><p className="eyebrow">Market research</p><h2>{selected.legacyReference} · {selected.description}</h2></div><button className="close" onClick={() => setSelected(null)}>×</button></div><p className="workflow-intro">Search a source below, verify the exact part and currency on its product page, then save the listing. A saved offer never replaces your Prix coûtant.</p>
      <div className="source-grid">{sources.map(([name, domain]) => <a key={domain} className="source-card" href={searchUrl(domain, selected)} target="_blank" rel="noreferrer"><strong>{name}</strong><span>Search this source ↗</span></a>)}</div>
      <section className="live-lookup"><div><strong>Live Jacksew check</strong><span>Searches the public Jacksew catalogue now. Results are suggestions only and are never saved automatically.</span></div><button type="button" className="primary" disabled={checkingJacksew} onClick={checkJacksew}>{checkingJacksew ? "Checking Jacksew…" : "Check Jacksew now"}</button></section>
      {liveLookupMessage && <p className="live-message">{liveLookupMessage}</p>}
      {liveCandidates.length > 0 && <div className="candidate-list">{liveCandidates.map((candidate) => <article className="candidate" key={candidate.listingUrl}><div><strong>{candidate.title}</strong><span>{candidate.sku ? `SKU ${candidate.sku} · ` : ""}{money(candidate.price, candidate.currency)} · {availabilityLabel(candidate.availability)} · {matchLabel(candidate.matchStatus)}</span></div><button type="button" className="secondary" onClick={() => useCandidate(candidate)}>Use this result</button></article>)}</div>}
      <form onSubmit={saveOffer}><div className="form-grid"><label className="field"><span>Source</span><select value={form.sourceName} onChange={(event) => setForm((current) => ({ ...current, sourceName: event.target.value }))}>{sources.map(([name]) => <option key={name}>{name}</option>)}</select></label><label className="field"><span>Price shown on source</span><input required type="number" min="0" step="any" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: Number(event.target.value) || 0 }))} /></label><label className="field"><span>Currency shown on source</span><select value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))}><option>CAD</option><option>USD</option><option>EUR</option><option>Other</option></select></label><label className="field"><span>Availability</span><select value={form.availability} onChange={(event) => setForm((current) => ({ ...current, availability: event.target.value }))}><option value="in_stock">In stock</option><option value="limited">Limited / low stock</option><option value="out_of_stock">Out of stock</option><option value="unknown">Not shown</option></select></label><label className="field"><span>Match status</span><select value={form.matchStatus} onChange={(event) => setForm((current) => ({ ...current, matchStatus: event.target.value }))}><option value="exact">Exact part-number match</option><option value="possible">Possible match — verify</option><option value="used">Used / surplus</option></select></label><label className="field"><span>Exact product-page link</span><input required type="url" placeholder="https://…" value={form.listingUrl} onChange={(event) => setForm((current) => ({ ...current, listingUrl: event.target.value }))} /></label><label className="field full"><span>Note (optional)</span><input value={form.note} placeholder="Package quantity, shipping note, compatible machine…" onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} /></label></div><div className="form-actions"><button type="button" className="secondary" onClick={() => setSelected(null)}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Saving…" : "Save confirmed listing"}</button></div></form>
    </section></div>}
  </main>;
}

function availabilityLabel(value: string) {
  return ({ in_stock: "In stock", limited: "Limited", out_of_stock: "Out of stock", unknown: "Not shown" } as Record<string, string>)[value] ?? value;
}

function matchLabel(value: string) {
  return ({ exact: "Exact match", possible: "Possible match", used: "Used / surplus" } as Record<string, string>)[value] ?? value;
}
