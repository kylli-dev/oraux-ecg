"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useToast, useConfirm } from "../Toast";
import {
  Plus,
  Trash2,
  RefreshCw,
  Download,
  Upload,
  UserPlus,
  Link2,
  CheckCircle2,
  Shield,
  Key,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Eraser,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  Btn,
  ErrorMsg,
  EtablissementItem,
  Field,
  Input,
  RED,
  Spinner,
  del,
  get,
  patch,
  post,
  put,
  useFiltre,
} from "./commun";

type MessageType = {
  code: string;
  sujet: string;
  corps_html: string;
};

type AdminAccount = {
  id: number;
  username: string;
  actif: boolean;
  role: "admin" | "super_admin";
  email?: string | null;
};

// Champ mot de passe avec un œil pour afficher / masquer la saisie
function PasswordInput(props: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className="w-full pl-3 pr-9 py-2 rounded-lg border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 bg-white"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 px-2.5 grid place-items-center text-gray-800 hover:text-black"
        title={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

// ── Éditeur WYSIWYG (messages-type) ─────────────────────────────────────────────
// Bouton de la barre d'outils — composant à part (pas défini dans RichTextEditor) : un
// composant recréé à chaque rendu perdrait son identité React à chaque frappe.
function ToolbarBtn({
  command, arg, icon: Icon, title, onExec, className = "",
}: { command: string; arg?: string; icon: typeof Bold; title: string; onExec: (command: string, arg?: string) => void; className?: string }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()} // garde la sélection de texte active dans l'éditeur
      onClick={() => onExec(command, arg)}
      title={title}
      className={`p-1.5 rounded hover:bg-black/5 text-gray-800 hover:text-black transition ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

// Remplace l'édition du HTML brut par un contentEditable + barre d'outils classique
// (gras/italique/souligné/listes/lien) — l'admin voit le rendu mis en forme, pas les
// balises. `value` ne réinjecte le HTML dans le DOM que quand il change depuis
// L'EXTÉRIEUR (changement de message sélectionné) — jamais pendant la frappe, sinon le
// curseur sauterait à chaque caractère saisi.
function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const lastValue = useRef(value);

  useEffect(() => {
    if (ref.current && value !== lastValue.current) {
      ref.current.innerHTML = value;
      lastValue.current = value;
    }
  }, [value]);

  const emit = () => {
    if (!ref.current) return;
    const html = ref.current.innerHTML;
    lastValue.current = html;
    onChange(html);
  };

  const exec = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  };

  const insertLink = () => {
    const url = window.prompt("URL du lien :", "https://");
    if (url) exec("createLink", url);
  };

  return (
    <div className="rounded-lg border border-black/10 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-black/10">
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-black/10 bg-gray-50">
        <ToolbarBtn command="bold" icon={Bold} title="Gras" onExec={exec} />
        <ToolbarBtn command="italic" icon={Italic} title="Italique" onExec={exec} />
        <ToolbarBtn command="underline" icon={Underline} title="Souligné" onExec={exec} />
        <div className="w-px h-4 bg-black/10 mx-1" />
        <ToolbarBtn command="insertUnorderedList" icon={List} title="Liste à puces" onExec={exec} />
        <ToolbarBtn command="insertOrderedList" icon={ListOrdered} title="Liste numérotée" onExec={exec} />
        <div className="w-px h-4 bg-black/10 mx-1" />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={insertLink}
          title="Insérer un lien"
          className="p-1.5 rounded hover:bg-black/5 text-gray-800 hover:text-black transition"
        >
          <Link2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("removeFormat")}
          title="Effacer la mise en forme"
          className="p-1.5 rounded hover:bg-black/5 text-gray-800 hover:text-black transition ml-auto"
        >
          <Eraser className="h-3.5 w-3.5" />
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        className="w-full min-h-[220px] max-h-[420px] overflow-y-auto px-3 py-2.5 text-sm leading-relaxed focus:outline-none [&_a]:text-blue-600 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
      />
    </div>
  );
}

// ── ParametragesSection ────────────────────────────────────────────────────────
const MESSAGE_LABELS: Record<string, string> = {
  ADMISSIBILITE:     "Admissibilité (identifiants de connexion)",
  CONVOCATION:       "Convocation aux oraux",
  RAPPEL:            "Rappel (J-2 et J-1)",
  DESINSCRIPTION:    "Confirmation de désinscription",
  LISTE_ATTENTE:     "Enregistrement liste d'attente",
  PLACE_LIBEREE:     "Place libérée (liste d'attente, envoi manuel)",
  PUBLICATION_NOTES: "Publication des notes",
  CONSIGNES_ACCUEIL: "Consignes importantes (page d'accueil candidat)",
  CONTACTS_SURVEILLANT: "Contacts utiles (espace surveillant)",
};

// Codes qui ne sont pas des emails (pas de "Sujet") — juste du contenu affiché tel quel
// sur une page du portail candidat ou de l'espace surveillant.
const MESSAGE_NON_EMAIL_CODES = new Set(["CONSIGNES_ACCUEIL", "CONTACTS_SURVEILLANT"]);

// ── ReferentielSection : générique Matières / Salles ──────────────────────────
type ReferentielItem = { id: number; intitule: string; active: boolean };

function ReferentielSection({
  entite,
  label,
  labelPlural,
}: {
  entite: "matieres" | "salles";
  label: string;
  labelPlural: string;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<ReferentielItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newIntitule, setNewIntitule] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await get<ReferentielItem[]>(`parametrages/${entite}/`));
    } finally {
      setLoading(false);
    }
  }, [entite]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newIntitule.trim()) return;
    setCreating(true);
    setError("");
    try {
      await post(`parametrages/${entite}/`, { intitule: newIntitule.trim(), active: true });
      setNewIntitule("");
      toast.success(`${label} ajouté(e)`);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (item: ReferentielItem) => {
    try {
      const updated = await patch<ReferentielItem>(
        `parametrages/${entite}/${item.id}`,
        { active: !item.active }
      );
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (item: ReferentielItem) => {
    if (!await confirm(`Supprimer « ${item.intitule} » ?`, { confirmLabel: "Supprimer", danger: true })) return;
    try {
      await del(`parametrages/${entite}/${item.id}`);
      toast.success(`${label} supprimé(e)`);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const actives = items.filter((i) => i.active);
  const inactives = items.filter((i) => !i.active);

  return (
    <div className="max-w-xl">
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        {/* Formulaire d'ajout */}
        <div className="p-5 border-b border-black/5">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Nouvelle {label.toLowerCase()}
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newIntitule}
              onChange={(e) => setNewIntitule(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder={`Intitulé de la ${label.toLowerCase()}…`}
              className="flex-1 rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
            />
            <Btn
              label={creating ? "…" : "Ajouter"}
              icon={Plus}
              onClick={handleCreate}
              disabled={creating || !newIntitule.trim()}
              small
            />
          </div>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </div>

        {/* Liste */}
        {loading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-700">
            Aucune {labelPlural} enregistrée
          </div>
        ) : (
          <div className="divide-y divide-black/5">
            {actives.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex-1 text-sm font-medium text-gray-900">{item.intitule}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                  Actif
                </span>
                <button
                  onClick={() => toggleActive(item)}
                  className="text-xs text-gray-700 hover:text-amber-600 transition px-2 py-1 rounded border border-black/10 hover:border-amber-300"
                >
                  Désactiver
                </button>
                <button
                  onClick={() => handleDelete(item)}
                  className="text-gray-700 hover:text-red-500 transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {inactives.length > 0 && (
              <>
                <div className="px-5 py-2 bg-black/[0.02]">
                  <span className="text-[10px] font-semibold text-gray-700 uppercase tracking-wide">
                    Inactives ({inactives.length})
                  </span>
                </div>
                {inactives.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 px-5 py-3 opacity-50">
                    <span className="flex-1 text-sm text-gray-800 line-through">{item.intitule}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-black/10 font-medium">
                      Inactif
                    </span>
                    <button
                      onClick={() => toggleActive(item)}
                      className="text-xs text-gray-700 hover:text-emerald-600 transition px-2 py-1 rounded border border-black/10 hover:border-emerald-300"
                    >
                      Activer
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      className="text-gray-700 hover:text-red-500 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EtablissementsSection() {
  const toast = useToast();
  const confirm = useConfirm();
  const [etablissements, setEtablissements] = useState<EtablissementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setEtablissements(await get<EtablissementItem[]>("parametrages/etablissements/")); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = etablissements.filter((e) => {
    const q = search.toLowerCase();
    return e.nom.toLowerCase().includes(q) || e.code_uai.toLowerCase().includes(q) || (e.ville ?? "").toLowerCase().includes(q);
  });

  async function handleImport(file: File) {
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/backend/excel/etablissements/import", { method: "POST", body: fd, cache: "no-store" });
      const text = await r.text();
      let data: { created: number; updated: number; errors: string[] };
      try { data = JSON.parse(text); } catch { throw new Error(text || `Erreur ${r.status}`); }
      if (!r.ok) throw new Error((data as any).detail ?? `Erreur ${r.status}`);
      toast.success(`Import OK : ${data.created} créés, ${data.updated} mis à jour${data.errors.length ? ` — ${data.errors.length} erreur(s)` : ""}`);
      await load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Erreur import"); }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function handleDelete(id: number, nom: string) {
    if (!await confirm(`Supprimer "${nom}" ?`, { confirmLabel: "Supprimer", danger: true })) return;
    try { await del(`parametrages/etablissements/${id}`); toast.success("Établissement supprimé"); await load(); }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Erreur"); }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2">
          <a
            href="/api/backend/excel/etablissements/template"
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-black/10 hover:bg-black/5 transition"
          >
            <Download className="h-3.5 w-3.5" /> Modèle Excel
          </a>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" /> {importing ? "Import…" : "Importer Excel"}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); }} />
        </div>
        <input
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 w-56"
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 border-b bg-gray-50 grid grid-cols-12 gap-2 text-xs font-semibold text-gray-700 uppercase tracking-wide">
          <span className="col-span-2">Code UAI</span>
          <span className="col-span-5">Établissement</span>
          <span className="col-span-2">Ville</span>
          <span className="col-span-2">Dép.</span>
          <span className="col-span-1" />
        </div>
        {loading ? (
          <div className="p-6 flex justify-center"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-gray-700 text-center">
            {etablissements.length === 0 ? "Aucun établissement. Importez un fichier Excel." : "Aucun résultat."}
          </p>
        ) : (
          <div className="divide-y max-h-[60vh] overflow-y-auto">
            {filtered.map((e) => (
              <div key={e.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 text-sm items-center hover:bg-gray-50">
                <span className="col-span-2 font-mono text-xs text-gray-800">{e.code_uai}</span>
                <span className="col-span-5 font-medium">{e.nom}</span>
                <span className="col-span-2 text-gray-800 text-xs">{e.ville ?? "—"}</span>
                <span className="col-span-2 text-gray-800 text-xs">{e.departement ?? "—"}</span>
                <button
                  onClick={() => handleDelete(e.id, e.nom)}
                  className="col-span-1 text-gray-700 hover:text-red-500 transition flex justify-end"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-gray-700">{etablissements.length} établissement(s) enregistré(s)</p>
    </div>
  );
}

export function ParametragesSection() {
  const [tab, setTab] = useFiltre<"matieres" | "salles" | "etablissements" | "messages" | "mdp" | "comptes">("parametrages:onglet", "matieres");
  const toastAdmins = useToast();
  const confirmAdmins = useConfirm();
  const [adminAccounts, setAdminAccounts] = useState<AdminAccount[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [newAdminUsername, setNewAdminUsername] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  // Édition de l'adresse email d'un compte (nécessaire au « mot de passe oublié »)
  const [emailFor, setEmailFor] = useState<number | null>(null);
  const [emailValue, setEmailValue] = useState("");
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [adminErr, setAdminErr] = useState("");
  const [resetPwFor, setResetPwFor] = useState<number | null>(null);
  const [resetPwValue, setResetPwValue] = useState("");
  const [newAdminSuperAdmin, setNewAdminSuperAdmin] = useState(false);
  const [myRole, setMyRole] = useState<"admin" | "super_admin" | null>(null);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [selected, setSelected] = useState<MessageType | null>(null);
  const [sujet, setSujet] = useState("");
  const [corps, setCorps] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(true);

  // Reset mdp
  const [candidatEmail, setCandidatEmail] = useState("");
  const [resetResult, setResetResult] = useState<{ login: string; new_password: string } | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetErr, setResetErr] = useState("");

  const loadMessages = useCallback(async () => {
    setLoadingMsg(true);
    try {
      const data = await get<MessageType[]>("parametrages/message-types/");
      setMessages(data);
      if (data.length > 0 && !selected) {
        setSelected(data[0]);
        setSujet(data[0].sujet);
        setCorps(data[0].corps_html);
      }
    } catch { /* ignore */ }
    finally { setLoadingMsg(false); }
  }, [selected]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  const selectMessage = (mt: MessageType) => {
    setSelected(mt);
    setSujet(mt.sujet);
    setCorps(mt.corps_html);
    setSaveOk(false);
  };

  const saveMessage = async () => {
    if (!selected) return;
    setSaving(true);
    setSaveOk(false);
    try {
      const updated = await put<MessageType>(
        `parametrages/message-types/${selected.code}`,
        { sujet, corps_html: corps }
      );
      setMessages((prev) => prev.map((m) => m.code === updated.code ? updated : m));
      setSelected(updated);
      setSaveOk(true);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const doResetPassword = async () => {
    if (!candidatEmail.trim()) return;
    setResetting(true);
    setResetErr("");
    setResetResult(null);
    try {
      const res = await post<{ login: string; new_password: string }>(
        `parametrages/candidats/reset-password-by-email`,
        { email: candidatEmail.trim() }
      );
      setResetResult(res);
    } catch (e: unknown) {
      setResetErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setResetting(false);
    }
  };

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setMyRole(data?.role === "super_admin" ? "super_admin" : "admin"))
      .catch(() => setMyRole("admin"));
  }, []);

  const isSuperAdmin = myRole === "super_admin";

  const loadAdmins = useCallback(async () => {
    setLoadingAdmins(true);
    try {
      const data = await get<AdminAccount[]>("comptes/");
      setAdminAccounts(data);
    } catch { /* ignore */ }
    finally { setLoadingAdmins(false); }
  }, []);

  useEffect(() => { if (tab === "comptes" && isSuperAdmin) loadAdmins(); }, [tab, isSuperAdmin, loadAdmins]);

  const createAdmin = async () => {
    if (!newAdminUsername.trim() || newAdminPassword.length < 8) return;
    setCreatingAdmin(true);
    setAdminErr("");
    try {
      await post<AdminAccount>("comptes/", {
        username: newAdminUsername.trim(),
        password: newAdminPassword,
        role: newAdminSuperAdmin ? "super_admin" : "admin",
        email: newAdminEmail.trim() || null,
      });
      setNewAdminUsername("");
      setNewAdminPassword("");
      setNewAdminEmail("");
      setNewAdminSuperAdmin(false);
      toastAdmins.success("Compte admin créé");
      loadAdmins();
    } catch (e: unknown) {
      setAdminErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setCreatingAdmin(false);
    }
  };

  const toggleAdminActif = async (a: AdminAccount) => {
    try {
      await patch<AdminAccount>(`comptes/${a.id}`, { actif: !a.actif });
      loadAdmins();
    } catch (e: unknown) {
      toastAdmins.error(e instanceof Error ? e.message : "Erreur");
    }
  };

  const toggleAdminRole = async (a: AdminAccount) => {
    try {
      await patch<AdminAccount>(`comptes/${a.id}`, { role: a.role === "super_admin" ? "admin" : "super_admin" });
      loadAdmins();
    } catch (e: unknown) {
      toastAdmins.error(e instanceof Error ? e.message : "Erreur");
    }
  };

  const submitResetPassword = async (a: AdminAccount) => {
    if (resetPwValue.length < 8) return;
    try {
      await patch<AdminAccount>(`comptes/${a.id}`, { password: resetPwValue });
      toastAdmins.success("Mot de passe réinitialisé");
      setResetPwFor(null);
      setResetPwValue("");
    } catch (e: unknown) {
      toastAdmins.error(e instanceof Error ? e.message : "Erreur");
    }
  };

  const submitEmail = async (a: AdminAccount) => {
    const v = emailValue.trim();
    if (v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) {
      toastAdmins.error("Adresse email invalide");
      return;
    }
    try {
      await patch<AdminAccount>(`comptes/${a.id}`, { email: v });
      toastAdmins.success(v ? "Adresse email enregistrée" : "Adresse email retirée");
      setEmailFor(null);
      setEmailValue("");
      loadAdmins();
    } catch (e: unknown) {
      toastAdmins.error(e instanceof Error ? e.message : "Erreur");
    }
  };

  const deleteAdmin = async (a: AdminAccount) => {
    if (!await confirmAdmins(`Supprimer le compte « ${a.username} » ?`, { confirmLabel: "Supprimer", danger: true })) return;
    try {
      await del(`comptes/${a.id}`);
      toastAdmins.success("Compte supprimé");
      loadAdmins();
    } catch (e: unknown) {
      toastAdmins.error(e instanceof Error ? e.message : "Erreur");
    }
  };

  const tabs = [
    { key: "matieres" as const, label: "Matières" },
    { key: "salles" as const, label: "Salles" },
    { key: "etablissements" as const, label: "Établissements" },
    { key: "messages" as const, label: "Messages-type" },
    { key: "mdp" as const, label: "Mots de passe" },
    ...(isSuperAdmin ? [{ key: "comptes" as const, label: "Administrateur" }] : []),
  ];

  // Si un compte non super-admin se retrouve sur l'onglet (ex. via un ancien lien), on le renvoie ailleurs.
  useEffect(() => {
    if (tab === "comptes" && myRole !== null && !isSuperAdmin) setTab("matieres");
  }, [tab, myRole, isSuperAdmin, setTab]);

  const doExportParametrages = () => {
    const a = document.createElement("a");
    a.href = "/api/backend/excel/parametrages/export";
    a.download = "parametrages.xlsx";
    a.click();
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">Paramétrages</h1>
          <p className="text-sm text-gray-700">Configuration des messages automatiques et gestion des accès.</p>
        </div>
        <Btn label="Exporter Excel" icon={Download} variant="ghost" onClick={doExportParametrages} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t.key ? "bg-white shadow-sm text-gray-900" : "text-gray-700 hover:text-black"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Matières ── */}
      {tab === "matieres" && <ReferentielSection entite="matieres" label="Matière" labelPlural="matières" />}

      {/* ── Salles ── */}
      {tab === "salles" && <ReferentielSection entite="salles" label="Salle" labelPlural="salles" />}

      {/* ── Établissements ── */}
      {tab === "etablissements" && <EtablissementsSection />}

      {/* ── Messages-type ── */}
      {tab === "messages" && (
        <div className="flex gap-5 items-start">
          {/* Liste */}
          <div className="w-64 shrink-0 bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
            {loadingMsg ? (
              <div className="p-4 flex justify-center"><Spinner /></div>
            ) : (
              messages.map((mt, i) => (
                <button
                  key={mt.code}
                  onClick={() => selectMessage(mt)}
                  className={`w-full text-left px-4 py-3 text-sm transition ${
                    i > 0 ? "border-t border-gray-100" : ""
                  } ${selected?.code === mt.code ? "bg-red-50 font-semibold" : "hover:bg-gray-50 text-gray-700"}`}
                  style={selected?.code === mt.code ? { color: RED } : undefined}
                >
                  {MESSAGE_LABELS[mt.code] ?? mt.code}
                </button>
              ))
            )}
          </div>

          {/* Éditeur */}
          {selected && (
            <div className="flex-1 bg-white rounded-2xl border border-black/5 shadow-sm p-5 space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">
                  {selected.code}
                </p>
                <h2 className="text-base font-bold text-gray-900">
                  {MESSAGE_LABELS[selected.code] ?? selected.code}
                </h2>
              </div>

              {MESSAGE_NON_EMAIL_CODES.has(selected.code) ? (
                <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-700">
                  {selected.code === "CONTACTS_SURVEILLANT"
                    ? "Ce n'est pas un email : ce contenu s'affiche dans l'encadré « Contacts utiles » des pages Accueil et Aujourd'hui de l'espace surveillant. Les numéros de téléphone y deviennent cliquables (appel direct sur mobile). L'encadré apparaît dès le premier clic sur « Enregistrer » ; videz le message pour le masquer."
                    : "Ce n'est pas un email : ce contenu s'affiche tel quel dans un encadré du portail candidat — pas de sujet ni de variables ici."}
                </div>
              ) : (
                <Field label="Sujet de l'email">
                  <Input value={sujet} onChange={(e) => { setSujet(e.target.value); setSaveOk(false); }} />
                </Field>
              )}

              <Field label="Corps du message">
                <RichTextEditor
                  value={corps}
                  onChange={(html) => { setCorps(html); setSaveOk(false); }}
                />
              </Field>

              <div className="flex items-center gap-3">
                <Btn label={saving ? "Enregistrement…" : "Enregistrer"} onClick={saveMessage} disabled={saving} />
                {saveOk && <span className="text-sm text-green-600 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" />Enregistré</span>}
              </div>

              {!MESSAGE_NON_EMAIL_CODES.has(selected.code) && (
                <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3 text-xs text-gray-700">
                  <p className="font-medium mb-1">Variables disponibles :</p>
                  <p className="font-mono">{"{prenom}"} {"{nom}"} {"{login}"} {"{password}"} {"{date}"} {"{epreuves}"} {"{journees}"} {"{url}"} {"{jours}"}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Mots de passe ── */}
      {tab === "mdp" && (
        <div className="max-w-md">
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Réinitialiser le mot de passe d&apos;un candidat</h2>
            <p className="text-sm text-gray-700">
              Saisissez l&apos;adresse email du candidat. Un nouveau mot de passe temporaire sera généré.
            </p>

            <Field label="Email candidat">
              <Input
                type="email"
                value={candidatEmail}
                onChange={(e) => { setCandidatEmail(e.target.value); setResetResult(null); setResetErr(""); }}
                placeholder="ex. prenom.nom@example.com"
              />
            </Field>

            <Btn
              label={resetting ? "Réinitialisation…" : "Générer un nouveau mot de passe"}
              onClick={doResetPassword}
              disabled={resetting || !candidatEmail.trim()}
              icon={RefreshCw}
            />

            <ErrorMsg msg={resetErr} />

            {resetResult && (
              <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3 space-y-1">
                <p className="text-sm font-semibold text-green-800">Mot de passe réinitialisé</p>
                <p className="text-sm text-green-700">Login : <span className="font-mono font-semibold">{resetResult.login}</span></p>
                <p className="text-sm text-green-700">Nouveau mdp : <span className="font-mono font-semibold">{resetResult.new_password}</span></p>
                <p className="text-xs text-green-500 mt-1">À communiquer au candidat par email.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Comptes admin ── */}
      {tab === "comptes" && isSuperAdmin && (
        <div className="max-w-2xl space-y-6">
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Créer un compte admin</h2>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Field label="Nom d'utilisateur">
                  <Input
                    value={newAdminUsername}
                    onChange={(e) => setNewAdminUsername(e.target.value)}
                    placeholder="ex. jdupont"
                  />
                </Field>
              </div>
              <div className="flex-1">
                <Field label="Mot de passe" hint="8 caractères minimum">
                  <PasswordInput
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </Field>
              </div>
              <Btn
                label={creatingAdmin ? "Création…" : "Créer"}
                icon={UserPlus}
                onClick={createAdmin}
                disabled={creatingAdmin || !newAdminUsername.trim() || newAdminPassword.length < 8}
              />
            </div>
            <Field label="Adresse email (recommandé)" hint="Permet d'utiliser « Mot de passe oublié » sur la page de connexion">
              <Input
                type="email"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="prenom.nom@ensae.fr"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={newAdminSuperAdmin}
                onChange={(e) => setNewAdminSuperAdmin(e.target.checked)}
              />
              Compte super-admin (accès à cet onglet Administrateur)
            </label>
            <ErrorMsg msg={adminErr} />
          </div>

          <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
            {loadingAdmins ? (
              <div className="p-6 flex justify-center"><Spinner /></div>
            ) : adminAccounts.length === 0 ? (
              <p className="p-6 text-sm text-gray-700 text-center">Aucun compte admin.</p>
            ) : (
              adminAccounts.map((a, i) => (
                <div key={a.id} className={`px-5 py-4 flex items-center justify-between gap-3 ${i > 0 ? "border-t border-gray-100" : ""}`}>
                  <div className="flex items-start gap-2 min-w-0">
                    <Shield className={`h-4 w-4 shrink-0 mt-0.5 ${a.role === "super_admin" ? "text-amber-500" : "text-gray-700"}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">{a.username}</span>
                        {a.role === "super_admin" && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 shrink-0">
                            Super-admin
                          </span>
                        )}
                      </div>
                      {a.email ? (
                        <p className="text-xs text-gray-800 truncate">{a.email}</p>
                      ) : (
                        <p className="text-xs text-amber-800">Aucun email — « Mot de passe oublié » indisponible</p>
                      )}
                    </div>
                  </div>

                  {emailFor === a.id ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-52">
                        <Input
                          type="email"
                          autoFocus
                          value={emailValue}
                          onChange={(e) => setEmailValue(e.target.value)}
                          placeholder="prenom.nom@ensae.fr"
                        />
                      </div>
                      <Btn label="Enregistrer" small onClick={() => submitEmail(a)} />
                      <Btn label="Annuler" small variant="ghost" onClick={() => { setEmailFor(null); setEmailValue(""); }} />
                    </div>
                  ) : resetPwFor === a.id ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-40">
                        <PasswordInput
                          autoFocus
                          value={resetPwValue}
                          onChange={(e) => setResetPwValue(e.target.value)}
                          placeholder="Nouveau mot de passe"
                        />
                      </div>
                      <Btn label="Valider" small onClick={() => submitResetPassword(a)} disabled={resetPwValue.length < 8} />
                      <Btn label="Annuler" small variant="ghost" onClick={() => { setResetPwFor(null); setResetPwValue(""); }} />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => toggleAdminActif(a)}
                        className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border font-medium transition ${
                          a.actif
                            ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                            : "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${a.actif ? "bg-green-500" : "bg-orange-400"}`} />
                        {a.actif ? "Actif" : "Inactif"}
                      </button>
                      <Btn
                        label="Email"
                        small
                        variant="ghost"
                        onClick={() => { setEmailFor(a.id); setEmailValue(a.email ?? ""); setResetPwFor(null); }}
                      />
                      <Btn
                        label="Mot de passe"
                        icon={Key}
                        small
                        variant="ghost"
                        onClick={() => { setResetPwFor(a.id); setResetPwValue(""); setEmailFor(null); }}
                      />
                      <Btn
                        label={a.role === "super_admin" ? "Rétrograder" : "Promouvoir"}
                        small
                        variant="ghost"
                        onClick={() => toggleAdminRole(a)}
                      />
                      <button
                        onClick={() => deleteAdmin(a)}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition"
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
