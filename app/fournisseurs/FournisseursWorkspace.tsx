"use client";

import { useEffect, useMemo, useState } from "react";
import AppNavigation from "../components/AppNavigation";
import type { InventoryItem } from "../lib/inventory-types";

type Supplier = {
  name: string;
  codes: string[];
  productCount: number;
  unitsOnHand: number;
  inventoryValue: number;
};

function money(value: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(value || 0);
}

function partsLabel(count: number) {
  return count === 1 ? "Voir 1 pièce" : `Voir les ${count.toLocaleString("fr-CA")} pièces`;
}

export default function SuppliersWorkspace() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    void fetch("/api/suppliers").then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json() as { suppliers?: Supplier[] };
      if (Array.isArray(payload.suppliers)) setSuppliers(payload.suppliers);
    }).finally(() => setLoading(false));
  }, []);

  const visibleSuppliers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("fr-CA");
    if (!term) return suppliers;
    return suppliers.filter((supplier) => `${supplier.name} ${supplier.codes.join(" ")}`.toLocaleLowerCase("fr-CA").includes(term));
  }, [search, suppliers]);

  async function openSupplier(supplier: Supplier) {
    setSelected(supplier);
    setItems([]);
    setLoadingItems(true);
    try {
      const response = await fetch(`/api/suppliers?supplier=${encodeURIComponent(supplier.name)}`);
      if (!response.ok) return;
      const payload = await response.json() as { items?: InventoryItem[] };
      if (Array.isArray(payload.items)) setItems(payload.items);
    } finally {
      setLoadingItems(false);
    }
  }

  return <main className="shell">
    <AppNavigation active="suppliers" />
    <section className="supplier-hero">
      <div><p className="eyebrow">Achats / Suppliers</p><h1>Fournisseurs</h1><p>Consultez les fournisseurs récupérés, leurs codes connus et les pièces qui leur sont associées.</p></div>
      <a className="secondary supplier-back-link" href="/">Retour à l’inventaire</a>
    </section>

    <section className="supplier-directory" aria-label="Liste des fournisseurs">
      <label className="machine-search supplier-search"><span>Rechercher un fournisseur</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nom ou code fournisseur" /></label>
      <p className="machine-results">{loading ? "Chargement des fournisseurs…" : `${visibleSuppliers.length} fournisseur${visibleSuppliers.length === 1 ? "" : "s"} affiché${visibleSuppliers.length === 1 ? "" : "s"}.`}</p>
      <div className="supplier-grid">
        {visibleSuppliers.map((supplier) => <article className="supplier-card" key={supplier.name} onClick={() => void openSupplier(supplier)}>
          <div className="supplier-card-heading"><div><p>Fournisseur</p><h2>{supplier.name}</h2></div><button className="machine-expand-button" type="button" aria-label={`Voir les pièces de ${supplier.name}`} onClick={(event) => { event.stopPropagation(); void openSupplier(supplier); }}>+</button></div>
          <p className="supplier-codes">{supplier.codes.length ? `Code${supplier.codes.length > 1 ? "s" : ""} : ${supplier.codes.join(" · ")}` : "Aucun code fournisseur récupéré"}</p>
          <dl className="supplier-stats"><div><dt>Pièces liées</dt><dd>{supplier.productCount.toLocaleString("fr-CA")}</dd></div><div><dt>Unités en stock</dt><dd>{supplier.unitsOnHand.toLocaleString("fr-CA")}</dd></div><div><dt>Valeur au dernier coût</dt><dd>{money(supplier.inventoryValue)}</dd></div></dl>
          <button className="primary supplier-parts-button" type="button" onClick={(event) => { event.stopPropagation(); void openSupplier(supplier); }}>{partsLabel(supplier.productCount)}</button>
        </article>)}
      </div>
      {!loading && !visibleSuppliers.length && <p className="empty">Aucun fournisseur ne correspond à cette recherche.</p>}
    </section>

    {selected && <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelected(null)}><section className="editor supplier-detail" role="dialog" aria-modal="true" aria-label={`Pièces de ${selected.name}`} onMouseDown={(event) => event.stopPropagation()}>
      <div className="editor-heading"><div><p className="eyebrow">Fournisseur</p><h2>{selected.name}</h2></div><button className="close" aria-label="Fermer" onClick={() => setSelected(null)}>×</button></div>
      <div className="supplier-detail-summary"><span>{selected.codes.length ? `Code${selected.codes.length > 1 ? "s" : ""} : ${selected.codes.join(" · ")}` : "Aucun code fournisseur récupéré"}</span><a className="machine-link" href={`/?search=${encodeURIComponent(selected.name)}`}>Voir dans l’inventaire</a></div>
      {loadingItems ? <p className="empty">Chargement des pièces liées…</p> : <div className="supplier-item-list">{items.map((item) => <a className="supplier-item" href={`/?search=${encodeURIComponent(item.legacyReference)}`} key={item.id}><div><strong>{item.legacyReference} · {item.description}</strong><span>{item.location ? `Empla. ${item.location}` : "Emplacement non indiqué"}{item.machineModel ? ` · ${item.machineModel}` : ""}</span></div><div><b>Qte. {item.quantityOnHand}</b><small>{money(item.lastCost)}</small></div></a>)}{!items.length && <p className="empty">Aucune pièce associée à ce fournisseur.</p>}</div>}
    </section></div>}
  </main>;
}
