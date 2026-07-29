"use client";

import { useEffect, useMemo, useState } from "react";
import AppNavigation from "../components/AppNavigation";
import { machineCatalog, productionStages, type MachineCatalogEntry, type MachineStage } from "../lib/machine-catalog";

const statusLabel = {
  "confirmé": "Confirmé",
  "à vérifier": "À vérifier sur la plaque",
  "à confirmer": "À confirmer",
} as const;

type MachineForm = {
  manufacturer: string;
  model: string;
  alternateNames: string;
  stage: MachineStage;
  instructionUrl: string;
  partsUrl: string;
};

const blankMachineForm: MachineForm = {
  manufacturer: "",
  model: "",
  alternateNames: "",
  stage: "Assemblage — couture principale",
  instructionUrl: "",
  partsUrl: "",
};

function inventoryLink(machine: MachineCatalogEntry) {
  return `/?machineId=${encodeURIComponent(machine.id)}`;
}

function inventoryButtonLabel(count: number) {
  return count === 1 ? "Voir 1 pièce" : `Voir les ${count.toLocaleString("fr-CA")} pièces`;
}

function visualCaption(machine: MachineCatalogEntry) {
  const visualMatch = machine.image?.visualMatch ?? "";
  if (visualMatch === "Exact series / adjacent-subclass photograph") return "Photo de référence — sous-classe à confirmer.";
  if (visualMatch === "Machine-family photograph — subclass not confirmed") return "Photo indicative — modèle à confirmer.";
  if (visualMatch === "Whole-machine manual illustration") return "Schéma de référence.";
  if (visualMatch === "Exact attachment / machine manual drawing") return "Schéma de référence — accessoire.";
  if (visualMatch === "Photo ajoutée par l’équipe") return "Photo ajoutée par l’équipe.";
  return "Photo de référence du modèle.";
}

function formForMachine(machine: MachineCatalogEntry): MachineForm {
  return {
    manufacturer: machine.manufacturer,
    model: machine.model,
    alternateNames: machine.alternateNames ?? "",
    stage: machine.stage,
    instructionUrl: machine.instructionUrl ?? "",
    partsUrl: machine.partsUrl ?? "",
  };
}

export default function MachinesWorkspace() {
  const [catalog, setCatalog] = useState<MachineCatalogEntry[]>(machineCatalog);
  const [stage, setStage] = useState<MachineStage | "Toutes">("Toutes");
  const [brand, setBrand] = useState("Toutes");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MachineCatalogEntry | null>(null);
  const [editorMode, setEditorMode] = useState<"new" | "edit" | null>(null);
  const [editingMachine, setEditingMachine] = useState<MachineCatalogEntry | null>(null);
  const [form, setForm] = useState<MachineForm>(blankMachineForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [editorError, setEditorError] = useState("");

  async function loadMachines(selectId?: string) {
    const response = await fetch("/api/machines");
    if (!response.ok) return;
    const data = await response.json() as { machines?: MachineCatalogEntry[] };
    if (!Array.isArray(data.machines)) return;
    setCatalog(data.machines);
    const desiredId = selectId ?? new URLSearchParams(window.location.search).get("machine")?.trim();
    if (desiredId) {
      const matchingMachine = data.machines.find((machine) => machine.id === desiredId);
      if (matchingMachine) setSelected(matchingMachine);
    }
  }

  useEffect(() => { void loadMachines(); }, []);

  useEffect(() => {
    const machineId = new URLSearchParams(window.location.search).get("machine")?.trim();
    const machine = catalog.find((entry) => entry.id === machineId);
    if (machine) setSelected(machine);
  }, [catalog]);

  const brands = useMemo(() => [...new Set(catalog.map((machine) => machine.manufacturer))].sort(), [catalog]);
  const machines = useMemo(() => catalog.filter((machine) => {
    const query = search.trim().toLocaleLowerCase("fr-CA");
    return (stage === "Toutes" || machine.stage === stage)
      && (brand === "Toutes" || machine.manufacturer === brand)
      && (!query || `${machine.manufacturer} ${machine.model} ${machine.alternateNames ?? ""} ${machine.note}`.toLocaleLowerCase("fr-CA").includes(query));
  }), [catalog, stage, brand, search]);

  function openNewMachine() {
    setSelected(null);
    setEditingMachine(null);
    setForm(blankMachineForm);
    setImageFile(null);
    setEditorError("");
    setEditorMode("new");
  }

  function openEditMachine(machine: MachineCatalogEntry) {
    setSelected(null);
    setEditingMachine(machine);
    setForm(formForMachine(machine));
    setImageFile(null);
    setEditorError("");
    setEditorMode("edit");
  }

  async function saveMachine() {
    setSaving(true);
    setEditorError("");
    try {
      const url = editorMode === "new" ? "/api/machines" : `/api/machines/${encodeURIComponent(editingMachine?.id ?? "")}`;
      const response = await fetch(url, {
        method: editorMode === "new" ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json() as { error?: string; machine?: MachineCatalogEntry };
      if (!response.ok || !data.machine) throw new Error(data.error ?? "Impossible d’enregistrer la machine.");
      if (imageFile) {
        const imageForm = new FormData();
        imageForm.append("file", imageFile);
        const upload = await fetch(`/api/machines/${encodeURIComponent(data.machine.id)}/image`, { method: "POST", body: imageForm });
        const uploadData = await upload.json() as { error?: string };
        if (!upload.ok) throw new Error(uploadData.error ?? "Impossible de téléverser l’image.");
      }
      await loadMachines(data.machine.id);
      setEditorMode(null);
      setEditingMachine(null);
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : "Impossible d’enregistrer la machine.");
    } finally {
      setSaving(false);
    }
  }

  return <main className="shell">
    <AppNavigation active="machines" />
    <section className="machines-hero">
      <div>
        <p className="eyebrow">Atelier / Equipment</p>
        <h1>Machines et équipements</h1>
      </div>
      <div className="machine-hero-actions"><div className="machine-hero-stats"><strong>{catalog.length}</strong><span>machines et équipements</span></div><button className="primary" onClick={openNewMachine}>Nouvelle machine / équipement</button></div>
    </section>

    <section className="machine-filters" aria-label="Filtres des machines">
      <label className="machine-search"><span>Rechercher</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Marque, modèle, autre nom ou rôle" /></label>
      <div className="filter-section"><strong>Étape de production</strong><div className="filter-chips"><button className={stage === "Toutes" ? "active" : ""} onClick={() => setStage("Toutes")}>Toutes</button>{productionStages.map((value) => <button key={value} className={stage === value ? "active" : ""} onClick={() => setStage(value)}>{value}</button>)}</div></div>
      <div className="filter-section"><strong>Marque</strong><div className="filter-chips"><button className={brand === "Toutes" ? "active" : ""} onClick={() => setBrand("Toutes")}>Toutes</button>{brands.map((value) => <button key={value} className={brand === value ? "active" : ""} onClick={() => setBrand(value)}>{value}</button>)}</div></div>
    </section>

    <p className="machine-results">{machines.length} famille{machines.length === 1 ? "" : "s"} affichée{machines.length === 1 ? "" : "s"}. Les nombres de pièces sont des associations de recherche, pas une confirmation que chaque pièce convient à chaque sous-modèle.</p>

    <div className="machine-card-grid machine-catalog-grid">
      {machines.map((machine) => <article className="machine-card machine-card-open" key={machine.id} onClick={() => setSelected(machine)}>
        {machine.image && <figure className="machine-card-image"><img src={machine.image.publicPath} alt={`Référence visuelle : ${machine.manufacturer} ${machine.model}`} loading="lazy" /></figure>}
        <div className="machine-card-heading"><div><p>{machine.manufacturer}</p><h3>{machine.model}</h3></div><button className="machine-expand-button" type="button" aria-label={`Voir plus de détails sur ${machine.manufacturer} ${machine.model}`} onClick={(event) => { event.stopPropagation(); setSelected(machine); }}>+</button></div>
        <strong>{machine.linkedRecords.toLocaleString("fr-CA")} fiches de pièces liées</strong>
        <div className="machine-card-actions"><a className="primary machine-inventory-button" href={inventoryLink(machine)} onClick={(event) => event.stopPropagation()}>{inventoryButtonLabel(machine.linkedRecords)}</a></div>
      </article>)}
    </div>

    {selected && <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelected(null)}><section className="editor machine-detail" role="dialog" aria-modal="true" aria-label={`Détails de ${selected.manufacturer} ${selected.model}`} onMouseDown={(event) => event.stopPropagation()}><div className="editor-heading"><div><p className="eyebrow">{selected.manufacturer}</p><h2>{selected.model}</h2></div><button className="close" aria-label="Fermer" onClick={() => setSelected(null)}>×</button></div>{selected.image && <figure className="machine-detail-image"><img src={selected.image.publicPath} alt={`Référence visuelle : ${selected.manufacturer} ${selected.model}`} /><figcaption>{visualCaption(selected)}</figcaption></figure>}<p className={`machine-detail-status ${selected.status.replaceAll(" ", "-")}`}>{statusLabel[selected.status]}</p><dl><div><dt>Étape de production</dt><dd>{selected.stage}</dd></div><div><dt>Fiches liées par la recherche</dt><dd>{selected.linkedRecords.toLocaleString("fr-CA")}</dd></div><div><dt>État de la recherche</dt><dd>{selected.note}</dd></div>{selected.alternateNames && <div><dt>Autres noms</dt><dd>{selected.alternateNames}</dd></div>}{selected.originalLabelsPreserved && <div><dt>Libellés d’origine conservés</dt><dd>{selected.originalLabelsPreserved}</dd></div>}</dl><div className="machine-documents">{selected.instructionUrl && <a className="machine-link document-link" href={selected.instructionUrl} target="_blank" rel="noreferrer">Ouvrir le manuel d’instructions</a>}{selected.partsUrl && <a className="machine-link document-link" href={selected.partsUrl} target="_blank" rel="noreferrer">Ouvrir le livre de pièces</a>}</div><div className="machine-detail-actions"><button className="secondary" onClick={() => openEditMachine(selected)}>Modifier cette machine</button><a className="primary machine-detail-link" href={inventoryLink(selected)}>Rechercher les pièces dans l’inventaire</a></div></section></div>}

    {editorMode && <div className="modal-backdrop" role="presentation" onMouseDown={() => !saving && setEditorMode(null)}><section className="editor machine-editor" role="dialog" aria-modal="true" aria-label={editorMode === "new" ? "Nouvelle machine" : "Modifier une machine"} onMouseDown={(event) => event.stopPropagation()}><div className="editor-heading"><div><p className="eyebrow">Machines et équipements</p><h2>{editorMode === "new" ? "Nouvelle machine / équipement" : "Modifier la machine"}</h2></div><button className="close" aria-label="Fermer" disabled={saving} onClick={() => setEditorMode(null)}>×</button></div><p className="workflow-intro">Ajoutez ou corrigez la fiche sans modifier les pièces dans l’inventaire.</p>{editorError && <p className="form-error">{editorError}</p>}<div className="form-grid"><label className="field"><span>Marque *</span><input value={form.manufacturer} onChange={(event) => setForm({ ...form, manufacturer: event.target.value })} placeholder="Ex. Juki" /></label><label className="field"><span>Modèle *</span><input value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} placeholder="Ex. LK-980" /></label><label className="field full"><span>Autres noms / ancien nom</span><input value={form.alternateNames} onChange={(event) => setForm({ ...form, alternateNames: event.target.value })} placeholder="Ex. surnom utilisé dans l’atelier" /></label><label className="field"><span>Étape de production</span><select value={form.stage} onChange={(event) => setForm({ ...form, stage: event.target.value as MachineStage })}>{productionStages.map((value) => <option key={value}>{value}</option>)}</select></label><label className="field"><span>Photo de la machine</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} />{imageFile && <small>{imageFile.name}</small>}</label><label className="field full"><span>Lien du manuel d’instructions</span><input type="url" value={form.instructionUrl} onChange={(event) => setForm({ ...form, instructionUrl: event.target.value })} placeholder="https://..." /></label><label className="field full"><span>Lien du livre de pièces</span><input type="url" value={form.partsUrl} onChange={(event) => setForm({ ...form, partsUrl: event.target.value })} placeholder="https://..." /></label></div><div className="form-actions"><button className="secondary" disabled={saving} onClick={() => setEditorMode(null)}>Annuler</button><button className="primary" disabled={saving} onClick={() => void saveMachine()}>{saving ? "Enregistrement…" : editorMode === "new" ? "Ajouter la machine" : "Enregistrer les modifications"}</button></div></section></div>}
  </main>;
}
