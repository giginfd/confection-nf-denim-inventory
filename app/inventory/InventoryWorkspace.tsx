"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { InventoryChange, InventoryItem, InventorySummary } from "../lib/inventory-types";
import AppNavigation from "../components/AppNavigation";
import { machineCatalog, type MachineCatalogEntry } from "../lib/machine-catalog";

type FormValues = Omit<InventoryItem, "id" | "createdAt" | "updatedAt">;
type Workflow = "receipt" | "issue" | null;
type InventorySortKey = "legacyReference" | "supplierPartNumber" | "description" | "machineModel" | "location" | "quantityOnHand" | "supplierName" | "lastCost";
type SortDirection = "asc" | "desc";

const sortableColumns: Array<{ key: InventorySortKey; label: string }> = [
  { key: "supplierPartNumber", label: "N° PIÈCE / PRODUIT" },
  { key: "description", label: "DESCRIPTION" },
  { key: "location", label: "EMPLACEMENT" },
  { key: "quantityOnHand", label: "QUANTITÉ" },
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
  machineAliases: "",
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
  reason: "Utilisée",
  note: "",
};

const emptyReceiptLine = (): ReceiptLine => ({ legacyReference: "", quantity: 1, location: "", supplierName: "", unitCost: 0 });

function money(value: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(value || 0);
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("fr-CA", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function normalizedMachineLabel(value: string) {
  return value.trim().toLocaleUpperCase("fr-CA").replace(/[^A-Z0-9]/g, "");
}

function associatedMachine(machineLabel: string, catalog: MachineCatalogEntry[]) {
  const normalized = machineLabel.trim().toLocaleUpperCase("fr-CA").replace(/[^A-Z0-9]/g, "");
  if (normalized.length < 4) return undefined;
  const ranked = catalog.map((machine) => {
    const terms = [machine.model, machine.searchTerm, ...(machine.searchTerms ?? []), machine.alternateNames ?? "", machine.originalLabelsPreserved ?? ""]
      .flatMap((value) => value.split(/[|,;\n]/))
      .map(normalizedMachineLabel)
      .filter((value) => value.length >= 4);
    const score = terms.reduce((best, term) => {
      if (term === normalized) return Math.max(best, 1000 + term.length);
      if (normalized.includes(term)) return Math.max(best, 500 + term.length);
      return best;
    }, 0);
    return { machine, score };
  }).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score);
  if (!ranked.length || (ranked[1] && ranked[1].score === ranked[0].score)) return undefined;
  return ranked[0].machine;
}

function machineDetailsLink(machineLabel: string, catalog: MachineCatalogEntry[]) {
  const match = associatedMachine(machineLabel, catalog);
  return match ? `/machines?machine=${encodeURIComponent(match.id)}` : "";
}

function MachineDetailsLink({ machineLabel, catalog }: { machineLabel: string; catalog: MachineCatalogEntry[] }) {
  const machine = associatedMachine(machineLabel, catalog);
  const href = machineDetailsLink(machineLabel, catalog);
  const displayLabel = machine ? `${machine.manufacturer} · ${machine.model}` : machineLabel;
  return href ? <a className="machine-inventory-link" href={href} onClick={(event) => event.stopPropagation()} title={`Ancien libellé : ${machineLabel}`}>{displayLabel}</a> : <>{displayLabel}</>;
}

function MachineModelField({ value, onChange, catalog }: { value: string; onChange: (value: string) => void; catalog: MachineCatalogEntry[] }) {
  const href = machineDetailsLink(value, catalog);
  return <div className="machine-model-field"><Field label="Machine / modèle" value={value} onChange={onChange} />{href && <a className="machine-inventory-link" href={href}>Voir la machine associée</a>}</div>;
}

export default function InventoryWorkspace() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [machineLinks, setMachineLinks] = useState<MachineCatalogEntry[]>(machineCatalog);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [activity, setActivity] = useState<InventoryChange[]>([]);
  const [activityOpen, setActivityOpen] = useState(false);
  const [searchHighlight, setSearchHighlight] = useState(false);
  const [search, setSearch] = useState("");
  const [machineId, setMachineId] = useState("");
  const [machineBrand, setMachineBrand] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
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
  const [movementItem, setMovementItem] = useState<InventoryItem | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const catalogRef = useRef<HTMLElement>(null);

  const machineBrands = useMemo(() => [...new Set(machineLinks.map((machine) => machine.manufacturer))].sort(), [machineLinks]);
  const machineOptions = useMemo(() => [...machineLinks]
    .filter((machine) => !machineBrand || machine.manufacturer === machineBrand)
    .sort((a, b) => `${a.manufacturer} ${a.model}`.localeCompare(`${b.manufacturer} ${b.model}`, "fr-CA", { numeric: true, sensitivity: "base" })), [machineBrand, machineLinks]);
  const selectedMovementItem = useMemo(() => movementItem?.legacyReference === movement.legacyReference ? movementItem : items.find((item) => item.legacyReference === movement.legacyReference) ?? null, [items, movement.legacyReference, movementItem]);
  const issueExceedsAvailable = Boolean(selectedMovementItem && movement.quantity > selectedMovementItem.quantityOnHand);

  const load = async (term = "", requestedSort = sortKey, requestedDirection = sortDirection) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/inventory?search=${encodeURIComponent(term)}&sort=${requestedSort}&direction=${requestedDirection}&machineId=${encodeURIComponent(machineId)}&machineBrand=${encodeURIComponent(machineBrand)}&location=${encodeURIComponent(locationFilter)}`);
      if (!response.ok) throw new Error("Impossible de charger l’inventaire.");
      const payload = await response.json();
      setItems(payload.items);
      setSummary(payload.summary);
      const activityResponse = await fetch("/api/activity");
      if (activityResponse.ok) setActivity((await activityResponse.json()).activity);
      setNotice("");
    } catch {
      setNotice("Impossible de charger l’inventaire. Actualisez la page et réessayez.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    void fetch("/api/machines").then(async (response) => {
      if (!response.ok) return;
      const data = await response.json() as { machines?: MachineCatalogEntry[] };
      if (Array.isArray(data.machines)) setMachineLinks(data.machines);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const requestedSearch = new URLSearchParams(window.location.search).get("search")?.trim();
    const requestedLocation = new URLSearchParams(window.location.search).get("location")?.trim();
    const requestedMachineId = new URLSearchParams(window.location.search).get("machineId")?.trim();
    if (requestedSearch) setSearch(requestedSearch);
    if (requestedLocation) setLocationFilter(requestedLocation);
    if (requestedMachineId) setMachineId(requestedMachineId);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(search), 220);
    return () => window.clearTimeout(timer);
  }, [search, sortKey, sortDirection, machineId, machineBrand, locationFilter]);

  const formTitle = creating ? "Nouvelle fiche produit" : `Modifier ${selected?.legacyReference ?? "la pièce"}`;
  const displayedItems = useMemo(() => items.slice(0, 80), [items]);
  const visibleSortableColumns = sortableColumns;

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
      machineAliases: item.machineAliases,
      costUnit: item.costUnit,
      detailUnit: item.detailUnit,
    });
  };

  const openCreate = () => {
    setCreating(true);
    setSelected(null);
    setForm(emptyForm);
  };

  const openWorkflow = (kind: Exclude<Workflow, null>, item?: InventoryItem) => {
    setWorkflow(kind);
    setMovementItem(item ?? null);
    setMovement(item ? { ...emptyMovement, legacyReference: item.legacyReference } : emptyMovement);
    setReceiptLines(item ? [{ legacyReference: item.legacyReference, quantity: 1, location: item.location, supplierName: item.supplierName, unitCost: item.lastCost }] : [emptyReceiptLine()]);
    setInvoiceDocument(null);
    setInvoiceFile(null);
    setActivityOpen(false);
  };

  const updateField = (key: keyof FormValues, value: string) => {
    const numeric = ["quantityOnHand", "lastCost", "averageCost", "dealerPrice", "salePrice"].includes(key);
    setForm((current) => ({ ...current, [key]: numeric ? Number(value) || 0 : value }));
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.legacyReference.trim() || !form.description.trim()) {
      setNotice("Un numéro de produit et une description sont requis.");
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
      if (!response.ok) throw new Error(payload.error || "Impossible d’enregistrer la pièce.");
      setSelected(null);
      setCreating(false);
      setNotice(creating ? "Nouvelle fiche produit ajoutée." : "Pièce mise à jour. La modification est enregistrée dans l’historique.");
      await load(search);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Impossible d’enregistrer la pièce.");
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

  async function findProduct(reference: string) {
    const value = reference.trim();
    if (!value) return null;
    const fromVisibleItems = items.find((item) => item.legacyReference.toLocaleUpperCase("fr-CA") === value.toLocaleUpperCase("fr-CA"));
    if (fromVisibleItems) return fromVisibleItems;
    try {
      const response = await fetch(`/api/inventory?search=${encodeURIComponent(value)}&sort=legacyReference&direction=asc`);
      if (!response.ok) return null;
      const data = await response.json() as { items?: InventoryItem[] };
      return data.items?.find((item) => item.legacyReference.toLocaleUpperCase("fr-CA") === value.toLocaleUpperCase("fr-CA")) ?? null;
    } catch { return null; }
  }

  async function completeReceiptLine(index: number, reference: string) {
    const product = await findProduct(reference);
    if (!product) return;
    setReceiptLines((current) => current.map((line, lineIndex) => lineIndex === index ? {
      ...line,
      legacyReference: product.legacyReference,
      location: line.location || product.location,
      supplierName: line.supplierName || product.supplierName,
      unitCost: line.unitCost || product.lastCost,
    } : line));
  }

  async function completeIssueProduct(reference: string) {
    const product = await findProduct(reference);
    if (product) {
      setMovementItem(product);
      setMovement((current) => ({ ...current, legacyReference: product.legacyReference }));
    }
  }

  const toggleSort = (nextKey: InventorySortKey) => {
    if (nextKey === sortKey) setSortDirection((current) => current === "asc" ? "desc" : "asc");
    else { setSortKey(nextKey); setSortDirection("asc"); }
  };

  function focusInventorySearch() {
    catalogRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setSearchHighlight(true);
    window.setTimeout(() => searchInput.current?.focus(), 300);
    window.setTimeout(() => setSearchHighlight(false), 2200);
  }

  return (
    <main className="shell inventory-home">
      <AppNavigation active="inventory" />
      <section className="inventory-task-header">
        <div><p className="eyebrow">Confection NF Denim — Stornoway INC.</p></div>
      </section>

      <section className="task-area" aria-label="Actions rapides">
        <h2>Que voulez-vous faire ?</h2>
        <div className="task-buttons"><button className="primary" onClick={focusInventorySearch}>Rechercher une pièce</button><a className="secondary" href="/emplacements">Vérifier un emplacement</a><button className="primary" onClick={() => openWorkflow("receipt")}>Ajouter au stock</button><button className="issue-button" onClick={() => openWorkflow("issue")}>Retirer du stock</button></div>
        <div className="directory-links"><a href="/machines">Liste des machines</a><a href="/fournisseurs">Liste des fournisseurs</a></div>
      </section>

      {notice && <div className="notice" role="status">{notice}</div>}

      <section className="workspace" ref={catalogRef}>
        <div className="inventory-panel">
          <div className="section-heading">
            <div>
              <h2>Catalogue de pièces</h2>
            </div>
          </div>
          <div className="search-row">
            <label className="search-field">
              <span>Rechercher une pièce</span>
              <div className={`search-box ${searchHighlight ? "search-highlight" : ""}`}>
                <input ref={searchInput} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="N° pièce, produit, machine ou emplacement" aria-label="Rechercher dans l'inventaire" />
              </div>
            </label>
            <label className="inventory-filter"><span>Marque de machine</span><select value={machineBrand} onChange={(event) => { setMachineBrand(event.target.value); setMachineId(""); }}><option value="">Toutes les marques</option>{machineBrands.map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
            <label className="inventory-filter"><span>Machine / modèle</span><select value={machineId} onChange={(event) => setMachineId(event.target.value)}><option value="">Toutes les machines</option>{machineOptions.map((machine) => <option value={machine.id} key={machine.id}>{machine.manufacturer} · {machine.model}</option>)}</select></label>
            <span className="results-count">{loading ? "Chargement…" : `${items.length.toLocaleString()} résultats`}</span>
          </div>
          {locationFilter && <div className="active-location-filter"><span>Emplacement sélectionné : <strong>{locationFilter}</strong></span><button type="button" onClick={() => setLocationFilter("")}>Voir tous les emplacements</button></div>}
          <div className="table-wrap">
            <table>
              <thead><tr>{visibleSortableColumns.map((column) => {
                const active = column.key === sortKey;
                const direction = active ? sortDirection === "asc" ? "ascending" : "descending" : "none";
                return <th key={column.key} aria-sort={direction}><button type="button" className={`sort-button ${active ? "active" : ""}`} onClick={() => toggleSort(column.key)}>{column.label}<span aria-hidden="true">{active ? sortDirection === "asc" ? " ↑" : " ↓" : " ↕"}</span></button></th>;
              })}<th aria-label="Mouvement de stock">MOUVEMENT</th><th aria-sort={sortKey === "lastCost" ? sortDirection === "asc" ? "ascending" : "descending" : "none"}><button type="button" className={`sort-button ${sortKey === "lastCost" ? "active" : ""}`} onClick={() => toggleSort("lastCost")}>PRIX COÛTANT<span aria-hidden="true">{sortKey === "lastCost" ? sortDirection === "asc" ? " ↑" : " ↓" : " ↕"}</span></button></th></tr></thead>
              <tbody>
                {displayedItems.map((item) => (
                  <tr key={item.id} onClick={() => openEdit(item)} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && openEdit(item)}>
                    <td className="product-number-cell">
                      <strong className="supplier-part-number">{item.supplierPartNumber || "—"}</strong>
                      <span className="sku internal-product-number">{item.legacyReference}</span>
                    </td>
                    <td className="description-cell"><strong>{item.description}</strong>{item.machineModel && <span className="description-machine"><MachineDetailsLink machineLabel={item.machineModel} catalog={machineLinks} /></span>}</td>
                    <td><span className="location-value">{item.location || <span className="muted">—</span>}</span></td>
                    <td><span className="quantity">{item.quantityOnHand}</span></td>
                    <td><div className="row-movement-buttons"><button type="button" className="row-add" title="Ajouter au stock" aria-label={`Ajouter au stock : ${item.legacyReference}`} onClick={(event) => { event.stopPropagation(); openWorkflow("receipt", item); }}>+</button><button type="button" className="row-remove" title="Retirer du stock" aria-label={`Retirer du stock : ${item.legacyReference}`} onClick={(event) => { event.stopPropagation(); openWorkflow("issue", item); }}>−</button></div></td>
                    <td className="cost-cell">{money(item.lastCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && !items.length && <p className="empty">Aucune pièce ne correspond à cette recherche.</p>}
          </div>
          <div className="mobile-product-list" aria-label="Résultats d’inventaire pour téléphone">
            {!loading && displayedItems.map((item) => <article className="mobile-product-card" key={item.id}>
              <div className="mobile-product-top"><div className="mobile-product-numbers"><b className="supplier-part-number">{item.supplierPartNumber || "—"}</b><span className="sku internal-product-number">{item.legacyReference}</span></div><div className="mobile-product-status"><strong className="quantity">Quantité : {item.quantityOnHand}</strong><span className="mobile-product-meta mobile-location"><b>Emplacement</b> <strong>{item.location || "—"}</strong></span></div></div>
              <strong className="mobile-product-description">{item.description}</strong>
              {item.machineModel && <span className="mobile-product-meta mobile-description-machine"><MachineDetailsLink machineLabel={item.machineModel} catalog={machineLinks} /></span>}
              <div className="mobile-product-actions"><button type="button" className="mobile-product-open" onClick={() => openEdit(item)}>Voir la fiche</button><button type="button" className="row-add" aria-label={`Ajouter au stock : ${item.legacyReference}`} onClick={() => openWorkflow("receipt", item)}>+</button><button type="button" className="row-remove" aria-label={`Retirer du stock : ${item.legacyReference}`} onClick={() => openWorkflow("issue", item)}>−</button></div>
            </article>)}
            {!loading && !items.length && <p className="empty">Aucune pièce ne correspond à cette recherche.</p>}
          </div>
          {items.length > displayedItems.length && <p className="table-foot">Les 80 premiers résultats sont affichés. Précisez votre recherche pour réduire la liste.</p>}
        </div>

        {activityOpen && <aside id="recent-activity" className="activity-panel activity-inline" aria-label="Modifications récentes">
          <div className="activity-drawer-heading"><div><p className="eyebrow">Historique</p><h2>Modifications récentes</h2></div><button className="close" type="button" aria-label="Fermer les modifications récentes" onClick={() => setActivityOpen(false)}>×</button></div>
          <p className="aside-copy">Chaque nouvelle pièce et chaque correction sauvegardée apparaissent ici.</p>
          <div className="activity-list">
            {activity.length ? activity.map((entry) => (
              <article className="activity" key={entry.id}>
                <div className="activity-dot" />
                <div><strong>{entry.changeType}</strong><p>{entry.legacyReference} · {entry.description}</p><small>{entry.note || "Modification enregistrée"} · {shortDate(entry.createdAt)}</small></div>
              </article>
            )) : <p className="empty">Aucune modification pour l'instant. L'inventaire récupéré reste votre point de départ.</p>}
          </div>
          <a className="machine-link activity-history-link" href="/historique">Voir tout l’historique</a>
        </aside>}
      </section>

      <details className="inventory-summary-details">
        <summary>Résumé de l’inventaire</summary>
        <a className="machine-link inventory-history-link" href="/historique">Voir l’historique des modifications</a>
        <section className="metrics compact-metrics" aria-label="Résumé de l’inventaire">
          <Metric label="Pièces" value={summary?.productCount.toLocaleString() ?? "—"} detail="fiches de pièces" />
          <Metric label="Quantité totale" value={summary?.unitsOnHand.toLocaleString() ?? "—"} detail="unités en inventaire" />
          <Metric label="Valeur de l'inventaire" value={summary ? money(summary.inventoryValueAtLastCost) : "—"} detail="au dernier prix coûtant connu" />
          <Metric label="Ruptures de stock" value={summary?.zeroStockCount.toLocaleString() ?? "—"} detail="pièces à vérifier" warning />
          <Metric label="Machines" value={machineLinks.length.toLocaleString()} detail="ouvrir les machines associées" href="/machines" />
          <Metric label="Fournisseurs" value={summary?.supplierCount.toLocaleString() ?? "—"} detail="voir les fournisseurs et leurs pièces" href="/fournisseurs" />
        </section>
      </details>

      {(selected || creating) && (
        <div className="modal-backdrop" role="presentation">
          <section className="editor product-editor" role="dialog" aria-modal="true" aria-label={formTitle}>
            <div className="editor-heading"><div><p className="eyebrow">Fiche produit</p><h2>{formTitle}</h2></div><button className="close" onClick={() => { setSelected(null); setCreating(false); }}>×</button></div>
            <form onSubmit={save}>
              <section className="product-legacy-cue" aria-label="Repères de la pièce">
                <div>
                  <span>{form.supplierPartNumber ? "N° pièce fournisseur" : "N° produit"}</span>
                  <strong>{form.supplierPartNumber || form.legacyReference || "Nouvelle pièce"}</strong>
                  {form.supplierPartNumber && form.legacyReference && <small>N° produit {form.legacyReference}</small>}
                </div>
                <div>
                  <span>Desc / produit</span>
                  <strong>{form.description || "Description à ajouter"}</strong>
                  {form.machineModel && <small>{form.machineModel}</small>}
                </div>
              </section>
              <section className="product-main-section"><h3>Stock et emplacement</h3><div className="product-main-grid">
                {creating && <Field label="N° de produit" value={form.legacyReference} onChange={(value) => updateField("legacyReference", value)} required />}
                <div className="product-field-full"><Field label="Description" value={form.description} onChange={(value) => updateField("description", value)} required /></div>
                <div className="product-location-field"><Field label="Emplacement" value={form.location} onChange={(value) => updateField("location", value)} /></div>
                <Field label="Quantité en inventaire" type="number" value={form.quantityOnHand} onChange={(value) => updateField("quantityOnHand", value)} />
                <Field label="Fournisseur" value={form.supplierName} onChange={(value) => updateField("supplierName", value)} />
                <Field label="Prix coûtant (CAD)" type="number" value={form.lastCost} onChange={(value) => updateField("lastCost", value)} />
                <div className="product-field-full"><MachineModelField value={form.machineModel} onChange={(value) => updateField("machineModel", value)} catalog={machineLinks} /></div>
              </div></section>
              <details className="product-extra-details"><summary>Plus d’informations</summary><div className="form-grid">
                {!creating && <Field label="N° de produit" value={form.legacyReference} onChange={(value) => updateField("legacyReference", value)} required />}
                <Field label="N° de pièce fournisseur" value={form.supplierPartNumber} onChange={(value) => updateField("supplierPartNumber", value)} />
                <Field label="Ancien nom de machine" value={form.machineAliases} onChange={(value) => updateField("machineAliases", value)} />
                <Field label="Code fournisseur" value={form.supplierCategoryCode} onChange={(value) => updateField("supplierCategoryCode", value)} />
                <Field label="Prix de vente (CAD)" type="number" value={form.dealerPrice} onChange={(value) => updateField("dealerPrice", value)} />
                <Field label="Divers (donnée récupérée)" type="number" value={form.averageCost} onChange={(value) => updateField("averageCost", value)} />
                <Field label="Unité de mesure coûtant" value={form.costUnit} onChange={(value) => updateField("costUnit", value)} />
                <Field label="Unité de mesure détail" value={form.detailUnit} onChange={(value) => updateField("detailUnit", value)} />
              </div></details>
              <div className="form-actions"><button type="button" className="secondary" onClick={() => { setSelected(null); setCreating(false); }}>Annuler</button><button className="primary" disabled={saving}>{saving ? "Sauvegarde…" : creating ? "Ajouter la pièce" : "Sauvegarder"}</button></div>
            </form>
          </section>
        </div>
      )}

      {workflow && (
        <div className="modal-backdrop" role="presentation">
          <section className="editor movement-editor" role="dialog" aria-modal="true" aria-label={workflow === "receipt" ? "Ajouter au stock" : "Retirer du stock"}>
            <div className="editor-heading">
              <div><p className="eyebrow">Mouvement d'inventaire</p><h2>{workflow === "receipt" ? "Ajouter au stock" : "Retirer du stock"}</h2></div>
              <button className="close" onClick={() => setWorkflow(null)}>×</button>
            </div>
            <p className="workflow-intro">{workflow === "receipt" ? "Choisissez la pièce, la quantité et l’emplacement." : "Choisissez la pièce et la quantité à retirer."}</p>
            <form onSubmit={saveMovement}>
              {workflow === "receipt" ? <>
                <div className="receipt-lines" aria-label="Lignes à réviser">
                  <div className="receipt-lines-heading"><div><strong>Pièce à ajouter</strong><span>Entrez seulement ce que vous avez reçu.</span></div></div>
                  {receiptLines.map((line, index) => <div className="receipt-line" key={index}>
                    <label className="field"><span>N° de produit</span><input list="product-numbers" value={line.legacyReference} required placeholder="Rechercher ou choisir une pièce" onChange={(event) => updateReceiptLine(index, "legacyReference", event.target.value)} onBlur={(event) => void completeReceiptLine(index, event.target.value)} /></label>
                    <Field label="Quantité" type="number" value={line.quantity} onChange={(value) => updateReceiptLine(index, "quantity", value)} required />
                    <Field label="Emplacement" value={line.location} onChange={(value) => updateReceiptLine(index, "location", value)} required />
                    <details className="receipt-line-options"><summary>Fournisseur ou prix (facultatif)</summary><div><Field label="Fournisseur" value={line.supplierName} onChange={(value) => updateReceiptLine(index, "supplierName", value)} /><Field label="Prix coûtant (CAD)" type="number" value={line.unitCost} onChange={(value) => updateReceiptLine(index, "unitCost", value)} /></div></details>
                    {receiptLines.length > 1 && <button type="button" className="remove-line" onClick={() => setReceiptLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}>Retirer cette pièce</button>}
                  </div>)}
                  <button type="button" className="add-receipt-line" onClick={() => setReceiptLines((current) => [...current, emptyReceiptLine()])}>+ Ajouter une autre pièce</button>
                  <datalist id="product-numbers">{items.map((item) => <option key={item.id} value={item.legacyReference}>{item.description}</option>)}</datalist>
                </div>
                <details className="receipt-options"><summary>Facture PDF, no de facture ou nouvelle pièce</summary><div>
                  <section className="invoice-upload" aria-label="Facture PDF"><div><strong>Facture fournisseur (PDF)</strong><p>Les lignes seront vérifiées avant l’ajout.</p></div><label className="file-choice"><span>{invoiceFile ? invoiceFile.name : "Choisir une facture PDF"}</span><input type="file" accept="application/pdf,.pdf" onChange={(event) => setInvoiceFile(event.target.files?.[0] ?? null)} aria-label="Choisir une facture PDF" /></label><button type="button" className="secondary" disabled={!invoiceFile || uploadingInvoice || Boolean(invoiceDocument)} onClick={uploadInvoice}>{uploadingInvoice ? "Téléversement…" : invoiceDocument ? "PDF téléversé" : "Téléverser"}</button></section>
                  {invoiceDocument && <p className="review-status"><strong>PDF prêt :</strong> {invoiceDocument.fileName}. Vérifiez les lignes avant d’ajouter.</p>}
                  <div className="receipt-options-bottom"><div className="receipt-meta"><Field label="N° de facture (facultatif)" value={movement.invoiceNumber} onChange={(value) => setMovement((current) => ({ ...current, invoiceNumber: value }))} /></div><button type="button" className="secondary" onClick={() => { setWorkflow(null); openCreate(); }}>Créer une nouvelle pièce</button></div>
                </div></details>
              </> : <div className="form-grid">
                <label className="field"><span>N° de produit</span><input list="product-numbers" value={movement.legacyReference} required placeholder="Rechercher ou choisir une pièce" onChange={(event) => setMovement((current) => ({ ...current, legacyReference: event.target.value }))} onBlur={(event) => void completeIssueProduct(event.target.value)} /><datalist id="product-numbers">{items.map((item) => <option key={item.id} value={item.legacyReference}>{item.description}</option>)}</datalist></label>
                <Field label="Quantité à retirer" type="number" value={movement.quantity} onChange={(value) => setMovement((current) => ({ ...current, quantity: Number(value) || 0 }))} required />
                <>
                  <label className="field"><span>Motif</span><select value={movement.reason} onChange={(event) => setMovement((current) => ({ ...current, reason: event.target.value }))}><option>Utilisée</option><option>Brisée</option><option>Ajustement</option></select></label>
                  <Field label="Note (facultatif)" value={movement.note} onChange={(value) => setMovement((current) => ({ ...current, note: value }))} />
                </>
              </div>}
              {workflow === "issue" && <section className="movement-summary"><h3>Vérifier avant de confirmer</h3><p><b>Pièce :</b> {selectedMovementItem ? `${selectedMovementItem.legacyReference} — ${selectedMovementItem.description}` : "Choisissez une pièce"}</p><p><b>Emplacement :</b> {selectedMovementItem?.location || "—"}</p><p><b>Quantité en stock :</b> {selectedMovementItem?.quantityOnHand ?? "—"}</p><p><b>Quantité à retirer :</b> {movement.quantity}</p><p><b>Motif :</b> {movement.reason}</p>{issueExceedsAvailable && <p className="form-error">La quantité demandée dépasse le stock disponible ({selectedMovementItem?.quantityOnHand}).</p>}</section>}
              {workflow === "receipt" && <p className="movement-ready">Vérifiez la quantité et l’emplacement avant d’ajouter.</p>}
              <div className="form-actions"><button type="button" className="secondary" onClick={() => setWorkflow(null)}>Annuler</button><button className={workflow === "issue" ? "issue-button" : "primary"} disabled={saving || (workflow === "issue" && issueExceedsAvailable)}>{saving ? "Sauvegarde…" : workflow === "receipt" ? "Ajouter au stock" : "Confirmer le retrait"}</button></div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function Metric({ label, value, detail, warning = false, href }: { label: string; value: string; detail: string; warning?: boolean; href?: string }) {
  const content = <><p>{label}</p><strong>{value}</strong><span>{detail}</span></>;
  return href ? <a className={`${warning ? "metric warning" : "metric"} metric-link`} href={href}>{content}</a> : <article className={warning ? "metric warning" : "metric"}>{content}</article>;
}

function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <label className="field"><span>{label}</span><input type={type} value={value} step={type === "number" ? "any" : undefined} required={required} onChange={(event) => onChange(event.target.value)} /></label>;
}
