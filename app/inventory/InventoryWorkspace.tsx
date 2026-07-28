"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { InventoryChange, InventoryItem, InventorySummary } from "../lib/inventory-types";
import AppNavigation from "../components/AppNavigation";

type FormValues = Omit<InventoryItem, "id" | "createdAt" | "updatedAt">;
type Workflow = "receipt" | "issue" | null;
type InventorySortKey = "legacyReference" | "supplierPartNumber" | "description" | "machineModel" | "location" | "quantityOnHand" | "supplierName" | "lastCost";
type SortDirection = "asc" | "desc";

const sortableColumns: Array<{ key: InventorySortKey; label: string }> = [
  { key: "legacyReference", label: "NO. PRODUIT" },
  { key: "supplierPartNumber", label: "NO. PIÈCE FOURNISSEUR" },
  { key: "description", label: "DESCRIPTION" },
  { key: "machineModel", label: "MACHINE / MODÈLE" },
  { key: "location", label: "EMPLA." },
  { key: "quantityOnHand", label: "QTE" },
  { key: "supplierName", label: "FOURNISSEUR" },
  { key: "lastCost", label: "DERNIER COÛT" },
];

type MovementValues = {
  legacyReference: string;
  quantity: number;
  location: string;
  supplierName: string;
  invoiceNumber: string;
  unitCost: number;
  reason: string;
  note: string;
};

type ReceiptLine = {
  legacyReference: string;
  quantity: number;
  location: string;
  supplierName: string;
  unitCost: number;
};

type InvoiceDocument = { id: string; fileName: string; sizeBytes: number };

const emptyForm: FormValues = {
  legacyReference: "",
  supplierPartNumber: "",
  supplierCategoryCode: "",
  supplierName: "",
  description: "",
  quantityOnHand: 0,
  lastCost: 0,
  averageCost: 0,
  dealerPrice: 0,
  salePrice: 0,
  location: "",
  machineModel: "",
  costUnit: "EA",
  detailUnit: "EA",
};

const emptyMovement: MovementValues = {
  legacyReference: "",
  quantity: 1,
  location: "",
  supplierName: "",
  invoiceNumber: "",
  unitCost: 0,
  reason: "Utilisée / Used",
  note: "",
};

const emptyReceiptLine = (): ReceiptLine => ({ legacyReference: "", quantity: 1, location: "", supplierName: "", unitCost: 0 });

function money(value: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(value || 0);
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export default function InventoryWorkspace() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [activity, setActivity] = useState<InventoryChange[]>([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<InventorySortKey>("description");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [workflow, setWorkflow] = useState<Workflow>(null);
  const [movement, setMovement] = useState<MovementValues>(emptyMovement);
  const [receiptLines, setReceiptLines] = useState<ReceiptLine[]>([emptyReceiptLine()]);
  const [invoiceDocument, setInvoiceDocument] = useState<InvoiceDocument | null>(null);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);

  const load = async (term = "", requestedSort = sortKey, requestedDirection = sortDirection) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/inventory?search=${encodeURIComponent(term)}&sort=${requestedSort}&direction=${requestedDirection}`);
      if (!response.ok) throw new Error("Could not load inventory");
      const payload = await response.json();
      setItems(payload.items);
      setSummary(payload.summary);
      const activityResponse = await fetch("/api/activity");
      if (activityResponse.ok) setActivity((await activityResponse.json()).activity);
      setNotice("");
    } catch {
      setNotice("The inventory could not load. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(search), 220);
    return () => window.clearTimeout(timer);
  }, [search, sortKey, sortDirection]);

  const formTitle = creating ? "Nouvelle fiche produit / New product record" : `Modifier / Edit ${selected?.legacyReference ?? "part"}`;
  const displayedItems = useMemo(() => items.slice(0, 80), [items]);
  const visibleSortableColumns = useMemo(() => summary?.supplierPartNumberCount ? sortableColumns : sortableColumns.filter((column) => column.key !== "supplierPartNumber"), [summary?.supplierPartNumberCount]);

  const openEdit = (item: InventoryItem) => {
    setCreating(false);
    setSelected(item);
    setForm({
      legacyReference: item.legacyReference,
      supplierPartNumber: item.supplierPartNumber,
      supplierCategoryCode: item.supplierCategoryCode,
      supplierName: item.supplierName,
      description: item.description,
      quantityOnHand: item.quantityOnHand,
      lastCost: item.lastCost,
      averageCost: item.averageCost,
      dealerPrice: item.dealerPrice,
      salePrice: item.salePrice,
      location: item.location,
      machineModel: item.machineModel,
      costUnit: item.costUnit,
      detailUnit: item.detailUnit,
    });
  };

  const openCreate = () => {
    setCreating(true);
    setSelected(null);
    setForm(emptyForm);
  };

  const openWorkflow = (kind: Exclude<Workflow, null>) => {
    setWorkflow(kind);
    setMovement(emptyMovement);
    setReceiptLines([emptyReceiptLine()]);
    setInvoiceDocument(null);
    setInvoiceFile(null);
  };

  const updateField = (key: keyof FormValues, value: string) => {
    const numeric = ["quantityOnHand", "lastCost", "averageCost", "dealerPrice", "salePrice"].includes(key);
    setForm((current) => ({ ...current, [key]: numeric ? Number(value) || 0 : value }));
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.legacyReference.trim() || !form.description.trim()) {
      setNotice("Une référence et une description sont requises / A reference and description are required.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(creating ? "/api/inventory" : `/api/inventory/${selected?.id}`, {
        method: creating ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not save the part");
      setSelected(null);
      setCreating(false);
      setNotice(creating ? "Nouvelle fiche produit ajoutée." : "Pièce mise à jour / Part updated. La modification est enregistrée ci-dessous.");
      await load(search);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save the part.");
    } finally {
      setSaving(false);
    }
  };

  const saveMovement = async (event: FormEvent) => {
    event.preventDefault();
    if (!workflow) return;
    setSaving(true);
    try {
      const response = await fetch(workflow === "receipt" ? "/api/receipts/batch" : "/api/issues", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(workflow === "receipt" ? { lines: receiptLines, invoiceNumber: movement.invoiceNumber, documentId: invoiceDocument?.id } : movement),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Impossible de modifier l'inventaire.");
      setWorkflow(null);
      setNotice(workflow === "receipt" ? `${payload.linesConfirmed ?? 1} ligne(s) ajoutée(s) à l'inventaire.` : "Sortie enregistrée dans l'inventaire.");
      await load(search);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Impossible de modifier l'inventaire.");
    } finally {
      setSaving(false);
    }
  };

  const uploadInvoice = async () => {
    if (!invoiceFile) {
      setNotice("Choisissez une facture PDF avant de la téléverser.");
      return;
    }
    setUploadingInvoice(true);
    try {
      const formData = new FormData();
      formData.append("file", invoiceFile);
      const response = await fetch("/api/invoice-documents", { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Impossible de téléverser la facture.");
      setInvoiceDocument(payload.document);
      setNotice("Facture PDF téléversée. Révisez les lignes ci-dessous : le stock ne changera qu'après confirmation.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Impossible de téléverser la facture.");
    } finally {
      setUploadingInvoice(false);
    }
  };

  const updateReceiptLine = (index: number, key: keyof ReceiptLine, value: string) => {
    setReceiptLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: ["quantity", "unitCost"].includes(key) ? Number(value) || 0 : value } : line));
  };

  const toggleSort = (nextKey: InventorySortKey) => {
    if (nextKey === sortKey) setSortDirection((current) => current === "asc" ? "desc" : "asc");
    else { setSortKey(nextKey); setSortDirection("asc"); }
  };

  return (
    <main className="shell">
      <AppNavigation active="inventory" />
      <section className="hero">
        <div>
          <p className="eyebrow">Inventaire des pièces / Parts inventory</p>
          <h1>Confection NF Denim - Stornway INC.</h1>
          <p className="hero-copy">La liste de pièces récupérée est votre point de départ. Recherchez, corrigez et conservez un historique clair de chaque ajustement.</p>
        </div>
        <div className="hero-note"><span className="pulse" />Inventaire récupéré · 2021</div>
      </section>

      {notice && <div className="notice" role="status">{notice}</div>}

      <section className="metrics" aria-label="Inventory summary">
        <Metric label="No produit / Product no." value={summary?.productCount.toLocaleString() ?? "—"} detail="fiches de pièces actuelles" />
        <Metric label="Qte. en inventaire" value={summary?.unitsOnHand.toLocaleString() ?? "—"} detail="unités dans toutes les pièces" />
        <Metric label="Valeur de l'inventaire" value={summary ? money(summary.inventoryValueAtLastCost) : "—"} detail="au dernier prix coûtant connu" />
        <Metric label="À zéro / Zero stock" value={summary?.zeroStockCount.toLocaleString() ?? "—"} detail="pièces à vérifier" warning />
        <Metric label="Fournisseurs / Suppliers" value={summary?.supplierCount.toLocaleString() ?? "—"} detail="catégories dans l'inventaire" />
      </section>

      <section className="workspace">
        <div className="inventory-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Inventaire / Inventory</p>
              <h2>Catalogue de pièces</h2>
            </div>
            <div className="action-group">
              <button className="primary" onClick={() => openWorkflow("receipt")}>Entrée d'inventaire</button>
              <button className="issue-button" onClick={() => openWorkflow("issue")}>Sortie d'inventaire</button>
              <button className="secondary" onClick={openCreate}>Nouvelle fiche produit</button>
            </div>
          </div>
          <div className="search-row">
            <label className="search-box">
              <span>⌕</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher par no. produit, no. pièce fournisseur, description, machine ou emplacement" aria-label="Rechercher dans l'inventaire" />
            </label>
            <span className="results-count">{loading ? "Chargement…" : `${items.length.toLocaleString()} résultats`}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr>{visibleSortableColumns.map((column) => {
                const active = column.key === sortKey;
                const direction = active ? sortDirection === "asc" ? "ascending" : "descending" : "none";
                return <th key={column.key} aria-sort={direction}><button type="button" className={`sort-button ${active ? "active" : ""}`} onClick={() => toggleSort(column.key)}>{column.label}<span aria-hidden="true">{active ? sortDirection === "asc" ? " ↑" : " ↓" : " ↕"}</span></button></th>;
              })}</tr></thead>
              <tbody>
                {displayedItems.map((item) => (
                  <tr key={item.id} onClick={() => openEdit(item)} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && openEdit(item)}>
                    <td className="sku">{item.legacyReference}</td>
                    {summary?.supplierPartNumberCount ? <td className="sku">{item.supplierPartNumber || <span className="muted">—</span>}</td> : null}
                    <td><strong>{item.description}</strong></td>
                    <td>{item.machineModel || <span className="muted">—</span>}</td>
                    <td>{item.location || <span className="muted">—</span>}</td>
                    <td><span className={item.quantityOnHand === 0 ? "quantity zero" : "quantity"}>{item.quantityOnHand}</span></td>
                    <td>{item.supplierName || <span className="muted">—</span>}</td>
                    <td>{money(item.lastCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && !items.length && <p className="empty">Aucune pièce ne correspond à cette recherche.</p>}
          </div>
          {items.length > displayedItems.length && <p className="table-foot">Les 80 premiers résultats sont affichés. Précisez votre recherche pour réduire la liste.</p>}
        </div>

        <aside className="activity-panel">
          <p className="eyebrow">Historique / Activity</p>
          <h2>Modifications récentes</h2>
          <p className="aside-copy">Chaque nouvelle pièce et chaque correction sauvegardée apparaissent ici.</p>
          <div className="activity-list">
            {activity.length ? activity.map((entry) => (
              <article className="activity" key={entry.id}>
                <div className="activity-dot" />
                <div><strong>{entry.changeType}</strong><p>{entry.legacyReference} · {entry.description}</p><small>{entry.note || "Saved in the inventory workspace"} · {shortDate(entry.createdAt)}</small></div>
              </article>
            )) : <p className="empty">Aucune modification pour l'instant. L'inventaire récupéré reste votre point de départ.</p>}
          </div>
        </aside>
      </section>

      {(selected || creating) && (
        <div className="modal-backdrop" role="presentation">
          <section className="editor" role="dialog" aria-modal="true" aria-label={formTitle}>
            <div className="editor-heading"><div><p className="eyebrow">Inventory record</p><h2>{formTitle}</h2></div><button className="close" onClick={() => { setSelected(null); setCreating(false); }}>×</button></div>
            <form onSubmit={save}>
              <div className="form-grid">
                <Field label="No produit / Product no." value={form.legacyReference} onChange={(value) => updateField("legacyReference", value)} required />
                <Field label="No. pièce fournisseur / Supplier part no." value={form.supplierPartNumber} onChange={(value) => updateField("supplierPartNumber", value)} />
                <Field label="Desc/Produit" value={form.description} onChange={(value) => updateField("description", value)} required />
                <Field label="Qte. en inventaire" type="number" value={form.quantityOnHand} onChange={(value) => updateField("quantityOnHand", value)} />
                <Field label="Emplacement / Location" value={form.location} onChange={(value) => updateField("location", value)} />
                <Field label="Fournisseur / Supplier" value={form.supplierName} onChange={(value) => updateField("supplierName", value)} />
                <Field label="Code fournisseur / Supplier code" value={form.supplierCategoryCode} onChange={(value) => updateField("supplierCategoryCode", value)} />
                <Field label="Modèle de machine / Machine model" value={form.machineModel} onChange={(value) => updateField("machineModel", value)} />
                <Field label="Prix coûtant (CAD)" type="number" value={form.lastCost} onChange={(value) => updateField("lastCost", value)} />
                <Field label="Divers (hérité)" type="number" value={form.averageCost} onChange={(value) => updateField("averageCost", value)} />
                <Field label="Prix de vente (CAD)" type="number" value={form.dealerPrice} onChange={(value) => updateField("dealerPrice", value)} />
                <Field label="Unité mesure coûtant" value={form.costUnit} onChange={(value) => updateField("costUnit", value)} />
                <Field label="Unité mesure détail" value={form.detailUnit} onChange={(value) => updateField("detailUnit", value)} />
              </div>
              <div className="form-actions"><button type="button" className="secondary" onClick={() => { setSelected(null); setCreating(false); }}>Annuler / Cancel</button><button className="primary" disabled={saving}>{saving ? "Sauvegarde…" : creating ? "Ajouter la pièce" : "Sauvegarder"}</button></div>
            </form>
          </section>
        </div>
      )}

      {workflow && (
        <div className="modal-backdrop" role="presentation">
          <section className="editor movement-editor" role="dialog" aria-modal="true" aria-label={workflow === "receipt" ? "Entrée d'inventaire" : "Sortie d'inventaire"}>
            <div className="editor-heading">
              <div><p className="eyebrow">Mouvement d'inventaire</p><h2>{workflow === "receipt" ? "Entrée d'inventaire" : "Sortie d'inventaire"}</h2></div>
              <button className="close" onClick={() => setWorkflow(null)}>×</button>
            </div>
            <p className="workflow-intro">{workflow === "receipt" ? "Téléversez une facture PDF ou ajoutez les lignes manuellement. Vérifiez les quantités, coûts et emplacements : rien ne change en inventaire avant votre confirmation." : "Enregistrez toute pièce qui sort de l'inventaire. La quantité ne peut pas descendre sous zéro."}</p>
            <form onSubmit={saveMovement}>
              {workflow === "receipt" ? <>
                <section className="invoice-upload" aria-label="Facture PDF">
                  <div><strong>Facture fournisseur (PDF)</strong><p>Téléversement sécurisé, suivi d'une révision manuelle.</p></div>
                  <input type="file" accept="application/pdf,.pdf" onChange={(event) => setInvoiceFile(event.target.files?.[0] ?? null)} aria-label="Choisir une facture PDF" />
                  <button type="button" className="secondary" disabled={!invoiceFile || uploadingInvoice || Boolean(invoiceDocument)} onClick={uploadInvoice}>{uploadingInvoice ? "Téléversement…" : invoiceDocument ? "PDF téléversé" : "Téléverser le PDF"}</button>
                </section>
                {invoiceDocument && <p className="review-status"><strong>PDF prêt à réviser :</strong> {invoiceDocument.fileName}. Ajoutez ou corrigez les lignes avant de confirmer.</p>}
                <div className="receipt-meta"><Field label="No facture" value={movement.invoiceNumber} onChange={(value) => setMovement((current) => ({ ...current, invoiceNumber: value }))} /></div>
                <div className="receipt-lines" aria-label="Lignes à réviser">
                  <div className="receipt-lines-heading"><div><strong>Révision des lignes</strong><span>Chaque ligne requiert un emplacement.</span></div><button type="button" className="secondary" onClick={() => setReceiptLines((current) => [...current, emptyReceiptLine()])}>+ Ajouter une ligne</button></div>
                  {receiptLines.map((line, index) => <div className="receipt-line" key={index}>
                    <label className="field"><span>No produit</span><input list="product-numbers" value={line.legacyReference} required placeholder="Ex. 2344" onChange={(event) => updateReceiptLine(index, "legacyReference", event.target.value)} /></label>
                    <Field label="Qte. reçue" type="number" value={line.quantity} onChange={(value) => updateReceiptLine(index, "quantity", value)} required />
                    <Field label="Emplacement" value={line.location} onChange={(value) => updateReceiptLine(index, "location", value)} required />
                    <Field label="Fournisseur" value={line.supplierName} onChange={(value) => updateReceiptLine(index, "supplierName", value)} />
                    <Field label="Prix coûtant unitaire (CAD)" type="number" value={line.unitCost} onChange={(value) => updateReceiptLine(index, "unitCost", value)} />
                    <button type="button" className="remove-line" disabled={receiptLines.length === 1} onClick={() => setReceiptLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}>Retirer</button>
                  </div>)}
                  <datalist id="product-numbers">{items.map((item) => <option key={item.id} value={item.legacyReference}>{item.description}</option>)}</datalist>
                </div>
              </> : <div className="form-grid">
                <label className="field"><span>No produit</span><input list="product-numbers" value={movement.legacyReference} required placeholder="Ex. 2344" onChange={(event) => setMovement((current) => ({ ...current, legacyReference: event.target.value }))} /><datalist id="product-numbers">{items.map((item) => <option key={item.id} value={item.legacyReference}>{item.description}</option>)}</datalist></label>
                <Field label="Qte. sortie" type="number" value={movement.quantity} onChange={(value) => setMovement((current) => ({ ...current, quantity: Number(value) || 0 }))} required />
                <>
                  <label className="field"><span>Raison</span><select value={movement.reason} onChange={(event) => setMovement((current) => ({ ...current, reason: event.target.value }))}><option>Utilisée / Used</option><option>Casse / Broken</option><option>Ajustement / Adjustment</option></select></label>
                  <Field label="Note (facultatif)" value={movement.note} onChange={(value) => setMovement((current) => ({ ...current, note: value }))} />
                </>
              </div>}
              <div className="form-actions"><button type="button" className="secondary" onClick={() => setWorkflow(null)}>Annuler</button><button className={workflow === "issue" ? "issue-button" : "primary"} disabled={saving}>{saving ? "Sauvegarde…" : workflow === "receipt" ? "Confirmer l'entrée en inventaire" : "Confirmer la sortie"}</button></div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function Metric({ label, value, detail, warning = false }: { label: string; value: string; detail: string; warning?: boolean }) {
  return <article className={warning ? "metric warning" : "metric"}><p>{label}</p><strong>{value}</strong><span>{detail}</span></article>;
}

function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <label className="field"><span>{label}</span><input type={type} value={value} step={type === "number" ? "any" : undefined} required={required} onChange={(event) => onChange(event.target.value)} /></label>;
}
