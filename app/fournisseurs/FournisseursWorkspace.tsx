"use client";

import { useEffect, useMemo, useState } from "react";
import AppNavigation from "../components/AppNavigation";
import type { InventoryItem } from "../lib/inventory-types";

type SupplierContact = {
  supplierCode: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  statusKey: "active" | "inactive" | "verify" | "not_supplier" | string;
  statusDetail: string;
  statusNote: string;
  sourceUrl: string;
  verifiedDate: string;
};

type Supplier = {
  name: string;
  codes: string[];
  productCount: number;
  unitsOnHand: number;
  inventoryValue: number;
  contact: SupplierContact | null;
};

type ContactForm = Pick<SupplierContact, "address" | "phone" | "email" | "website" | "statusKey" | "statusDetail" | "statusNote" | "sourceUrl" | "verifiedDate" | "supplierCode">;

const statusLabels: Record<string, string> = {
  active: "Actif",
  inactive: "Inactif",
  verify: "À vérifier",
  not_supplier: "Non fournisseur",
};

function money(value: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(value || 0);
}

function partsLabel(count: number) {
  return count === 1 ? "Voir 1 pièce" : `Voir les ${count.toLocaleString("fr-CA")} pièces`;
}

function contactFormFor(supplier: Supplier): ContactForm {
  const contact = supplier.contact;
  return {
    supplierCode: contact?.supplierCode ?? supplier.codes[0] ?? "",
    address: contact?.address ?? "",
    phone: contact?.phone ?? "",
    email: contact?.email ?? "",
    website: contact?.website ?? "",
    statusKey: contact?.statusKey ?? "verify",
    statusDetail: contact?.statusDetail ?? "",
    statusNote: contact?.statusNote ?? "",
    sourceUrl: contact?.sourceUrl ?? "",
    verifiedDate: contact?.verifiedDate ?? "",
  };
}

function statusLabel(contact: SupplierContact | null) {
  return statusLabels[contact?.statusKey ?? "verify"] ?? "À vérifier";
}

export default function SuppliersWorkspace() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [editingContact, setEditingContact] = useState(false);
  const [contactForm, setContactForm] = useState<ContactForm | null>(null);
  const [savingContact, setSavingContact] = useState(false);
  const [contactError, setContactError] = useState("");

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
    return suppliers.filter((supplier) => `${supplier.name} ${supplier.codes.join(" ")} ${supplier.contact?.phone ?? ""} ${supplier.contact?.address ?? ""}`.toLocaleLowerCase("fr-CA").includes(term));
  }, [search, suppliers]);

  async function openSupplier(supplier: Supplier) {
    setSelected(supplier);
    setItems([]);
    setEditingContact(false);
    setContactError("");
    setLoadingItems(true);
    try {
      const response = await fetch(`/api/suppliers?supplier=${encodeURIComponent(supplier.name)}`);
      if (!response.ok) return;
      const payload = await response.json() as { items?: InventoryItem[]; contact?: SupplierContact | null };
      const updated = { ...supplier, contact: payload.contact ?? supplier.contact };
      setSelected(updated);
      setSuppliers((current) => current.map((entry) => entry.name === supplier.name ? updated : entry));
      if (Array.isArray(payload.items)) setItems(payload.items);
    } finally {
      setLoadingItems(false);
    }
  }

  function startEditingContact() {
    if (!selected) return;
    setContactForm(contactFormFor(selected));
    setContactError("");
    setEditingContact(true);
  }

  async function saveContact() {
    if (!selected || !contactForm) return;
    setSavingContact(true);
    setContactError("");
    try {
      const response = await fetch(`/api/suppliers/${encodeURIComponent(selected.name)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(contactForm),
      });
      const payload = await response.json() as { contact?: SupplierContact; error?: string };
      if (!response.ok || !payload.contact) throw new Error(payload.error ?? "Impossible d’enregistrer les coordonnées.");
      const updated = { ...selected, contact: payload.contact };
      setSelected(updated);
      setSuppliers((current) => current.map((entry) => entry.name === selected.name ? updated : entry));
      setEditingContact(false);
    } catch (error) {
      setContactError(error instanceof Error ? error.message : "Impossible d’enregistrer les coordonnées.");
    } finally {
      setSavingContact(false);
    }
  }

  return <main className="shell">
    <AppNavigation active="suppliers" />
    <section className="supplier-hero">
      <div><p className="eyebrow">Achats</p><h1>Fournisseurs</h1><p>Consultez les fournisseurs récupérés, leurs coordonnées, leur état et les pièces qui leur sont associées.</p></div>
      <a className="secondary supplier-back-link" href="/">Retour à l’inventaire</a>
    </section>

    <section className="supplier-directory" aria-label="Liste des fournisseurs">
      <label className="machine-search supplier-search"><span>Rechercher un fournisseur</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nom, code, téléphone ou adresse" /></label>
      <p className="machine-results">{loading ? "Chargement des fournisseurs…" : `${visibleSuppliers.length} fournisseur${visibleSuppliers.length === 1 ? "" : "s"} affiché${visibleSuppliers.length === 1 ? "" : "s"}.`}</p>
      <div className="supplier-grid">
        {visibleSuppliers.map((supplier) => <article className="supplier-card" key={supplier.name} onClick={() => void openSupplier(supplier)}>
          <div className="supplier-card-heading"><div><p>Fournisseur</p><h2>{supplier.name}</h2></div><button className="machine-expand-button" type="button" aria-label={`Voir les coordonnées et les pièces de ${supplier.name}`} onClick={(event) => { event.stopPropagation(); void openSupplier(supplier); }}>+</button></div>
          <div className="supplier-contact-preview"><span className={`supplier-status ${supplier.contact?.statusKey ?? "verify"}`}>{statusLabel(supplier.contact)}</span>{supplier.contact?.phone ? <span>{supplier.contact.phone}</span> : <span>Coordonnées à compléter</span>}</div>
          <p className="supplier-codes">{supplier.codes.length ? `Code${supplier.codes.length > 1 ? "s" : ""} : ${supplier.codes.join(" · ")}` : "Aucun code fournisseur récupéré"}</p>
          <dl className="supplier-stats"><div><dt>Pièces liées</dt><dd>{supplier.productCount.toLocaleString("fr-CA")}</dd></div><div><dt>Unités en stock</dt><dd>{supplier.unitsOnHand.toLocaleString("fr-CA")}</dd></div><div><dt>Valeur au dernier coût</dt><dd>{money(supplier.inventoryValue)}</dd></div></dl>
          <button className="primary supplier-parts-button" type="button" onClick={(event) => { event.stopPropagation(); void openSupplier(supplier); }}>{partsLabel(supplier.productCount)}</button>
        </article>)}
      </div>
      {!loading && !visibleSuppliers.length && <p className="empty">Aucun fournisseur ne correspond à cette recherche.</p>}
    </section>

    {selected && <div className="modal-backdrop" role="presentation" onMouseDown={() => !savingContact && setSelected(null)}><section className="editor supplier-detail" role="dialog" aria-modal="true" aria-label={`Fournisseur ${selected.name}`} onMouseDown={(event) => event.stopPropagation()}>
      <div className="editor-heading"><div><p className="eyebrow">Fournisseur</p><h2>{editingContact ? "Modifier les coordonnées" : selected.name}</h2></div><button className="close" aria-label="Fermer" disabled={savingContact} onClick={() => setSelected(null)}>×</button></div>

      {editingContact && contactForm ? <>
        <p className="workflow-intro">Mettez à jour les coordonnées ou l’état. Les pièces liées ne seront pas modifiées.</p>
        {contactError && <p className="form-error">{contactError}</p>}
        <div className="form-grid">
          <label className="field"><span>État</span><select value={contactForm.statusKey} onChange={(event) => setContactForm({ ...contactForm, statusKey: event.target.value })}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="field"><span>No. de téléphone</span><input value={contactForm.phone} onChange={(event) => setContactForm({ ...contactForm, phone: event.target.value })} placeholder="Ex. 514-000-0000" /></label>
          <label className="field"><span>Courriel</span><input type="email" value={contactForm.email} onChange={(event) => setContactForm({ ...contactForm, email: event.target.value })} placeholder="Ex. achats@fournisseur.com" /></label>
          <label className="field"><span>Site web</span><input type="url" value={contactForm.website} onChange={(event) => setContactForm({ ...contactForm, website: event.target.value })} placeholder="https://..." /></label>
          <label className="field full"><span>Adresse</span><input value={contactForm.address} onChange={(event) => setContactForm({ ...contactForm, address: event.target.value })} placeholder="Adresse complète" /></label>
          <label className="field full"><span>Note</span><textarea value={contactForm.statusNote} onChange={(event) => setContactForm({ ...contactForm, statusNote: event.target.value })} placeholder="Ex. appeler avant de commander" /></label>
        </div>
        <div className="form-actions"><button className="secondary" disabled={savingContact} onClick={() => setEditingContact(false)}>Annuler</button><button className="primary" disabled={savingContact} onClick={() => void saveContact()}>{savingContact ? "Enregistrement…" : "Enregistrer les coordonnées"}</button></div>
      </> : <>
        <div className="supplier-detail-summary"><span>{selected.codes.length ? `Code${selected.codes.length > 1 ? "s" : ""} : ${selected.codes.join(" · ")}` : "Aucun code fournisseur récupéré"}</span><a className="machine-link" href={`/?search=${encodeURIComponent(selected.name)}`}>Voir dans l’inventaire</a></div>
        <section className="supplier-contact-details" aria-label="Coordonnées du fournisseur">
          <div><span>État</span><strong className={`supplier-status ${selected.contact?.statusKey ?? "verify"}`}>{statusLabel(selected.contact)}</strong></div>
          <div><span>Téléphone</span>{selected.contact?.phone ? <a href={`tel:${selected.contact.phone.replace(/[^+0-9]/g, "")}`}>{selected.contact.phone}</a> : <b>À ajouter</b>}</div>
          <div><span>Courriel</span>{selected.contact?.email ? <a href={`mailto:${selected.contact.email}`}>{selected.contact.email}</a> : <b>À ajouter</b>}</div>
          <div><span>Adresse</span><b>{selected.contact?.address || "À ajouter"}</b></div>
          <div><span>Site web</span>{selected.contact?.website ? <a href={selected.contact.website} target="_blank" rel="noreferrer">Ouvrir le site</a> : <b>À ajouter</b>}</div>
        </section>
        {selected.contact?.statusNote && <p className="supplier-status-note">{selected.contact.statusNote}</p>}
        <div className="supplier-contact-actions"><button className="secondary" type="button" onClick={startEditingContact}>Modifier les coordonnées</button>{selected.contact?.sourceUrl && <a className="machine-link" href={selected.contact.sourceUrl} target="_blank" rel="noreferrer">Source de vérification</a>}{selected.contact?.verifiedDate && <span>Vérifié le {selected.contact.verifiedDate}</span>}</div>
        {loadingItems ? <p className="empty">Chargement des pièces liées…</p> : <div className="supplier-item-list">{items.map((item) => <a className="supplier-item" href={`/?search=${encodeURIComponent(item.legacyReference)}`} key={item.id}><div><strong>{item.legacyReference} · {item.description}</strong><span>{item.location ? `Empla. ${item.location}` : "Emplacement non indiqué"}{item.machineModel ? ` · ${item.machineModel}` : ""}</span></div><div><b>Qte. {item.quantityOnHand}</b><small>{money(item.lastCost)}</small></div></a>)}{!items.length && <p className="empty">Aucune pièce associée à ce fournisseur.</p>}</div>}
      </>}
    </section></div>}
  </main>;
}
