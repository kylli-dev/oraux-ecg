"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useToast, useConfirm } from "../Toast";
import {
  ChevronRight,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Key,
  Copy,
  Mail,
  Upload,
} from "lucide-react";
import {
  Btn,
  Empty,
  EpreuveFlat,
  ErrorMsg,
  Field,
  ImportExcelModal,
  Input,
  Modal,
  NavAffectationContext,
  Planning,
  Spinner,
  del,
  get,
  intentions,
  memoriserPlanning,
  patch,
  planningMemorise,
  post,
  useFiltre,
} from "./commun";

type Surveillant = {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  actif: boolean;
  code_acces: string;
  actif_planning?: boolean | null; // null = non associé, true/false = actif/inactif pour ce planning
};

// ── Section : Surveillants ────────────────────────────────────────────────────

function CredentialsModal({
  nom, prenom, email, code_acces, plainPassword, emailSent,
  onClose,
}: {
  nom: string; prenom: string; email: string; code_acces: string;
  plainPassword: string; emailSent: boolean; onClose: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string, key: string) => {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <Key className="h-5 w-5 text-[#C62828]" />
          <h3 className="text-base font-semibold">Identifiants générés</h3>
        </div>
        <p className="text-sm text-gray-800 mb-4">
          {prenom} {nom} — <span className="font-mono text-xs">{email}</span>
        </p>

        {emailSent ? (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-4">
            <Mail className="h-4 w-4 shrink-0" />
            Email envoyé à {email}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
            <Mail className="h-4 w-4 shrink-0" />
            Email non envoyé (SMTP non configuré) — communiquez ces identifiants manuellement.
          </div>
        )}

        <div className="space-y-2 mb-5">
          {[
            { label: "Login (email)", value: email, key: "login" },
            { label: "Mot de passe", value: plainPassword, key: "pwd" },
          ].map(({ label, value, key }) => (
            <div key={key} className="flex items-center justify-between bg-gray-50 rounded-lg border px-3 py-2">
              <div>
                <p className="text-[10px] text-gray-700 uppercase tracking-wide">{label}</p>
                <p className="text-sm font-mono font-medium">{value}</p>
              </div>
              <button
                onClick={() => copy(value, key)}
                className="text-gray-700 hover:text-[#C62828] transition"
                title="Copier"
              >
                {copied === key
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  : <Copy className="h-4 w-4" />}
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 bg-black text-white text-sm font-semibold rounded-lg hover:bg-black/80 transition"
        >
          Fermer
        </button>
      </motion.div>
    </div>
  );
}

// ── Charge par surveillant ────────────────────────────────────────────────────
// Nombre de créneaux surveillés par personne (1er et 2ᵉ surveillant), pour équilibrer la
// charge. Lecture seule : l'affectation se fait dans Salles & surveillants.
function ChargeSurveillants({ planningId, surveillants }: { planningId: number; surveillants: Surveillant[] }) {
  const allerAffecter = React.useContext(NavAffectationContext);
  const [donnees, setDonnees] = useState<{ pid: number; epreuves: EpreuveFlat[] } | null>(null);
  const [filtreDate, setFiltreDate] = useFiltre("charge:date", "", planningId);
  const [ouvert, setOuvert] = useState<number | null>(null);

  useEffect(() => {
    let annule = false;
    get<EpreuveFlat[]>(`plannings/${planningId}/epreuves`)
      .then((eps) => { if (!annule) setDonnees({ pid: planningId, epreuves: eps }); })
      .catch(() => { if (!annule) setDonnees({ pid: planningId, epreuves: [] }); });
    return () => { annule = true; };
  }, [planningId]);

  if (!donnees || donnees.pid !== planningId) return <div className="p-8 text-center"><Spinner /></div>;

  const actives = donnees.epreuves.filter((e) => e.statut !== "ANNULEE");
  const dates = Array.from(new Set(actives.map((e) => e.date))).sort();
  const eps = actives.filter((e) => !filtreDate || e.date === filtreDate);
  const sansSurveillant = eps.filter((e) => e.surveillant_id == null && e.surveillant2_id == null).length;
  const hm = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

  type Ligne = { s: Surveillant; premier: EpreuveFlat[]; second: EpreuveFlat[]; jours: number; chevauchements: number };
  const lignes: Ligne[] = surveillants
    .filter((s) => s.actif && s.actif_planning !== false)
    .map((s) => {
      const premier = eps.filter((e) => e.surveillant_id === s.id);
      const second = eps.filter((e) => e.surveillant2_id === s.id && e.surveillant_id !== s.id);
      const tous = [...premier, ...second];
      // Deux créneaux qui se recouvrent dans deux salles différentes : impossible à tenir
      let chevauchements = 0;
      for (let i = 0; i < tous.length; i++) for (let j = i + 1; j < tous.length; j++) {
        const a = tous[i], b = tous[j];
        if (a.date === b.date && a.salle_id !== b.salle_id
          && hm(a.heure_debut) < hm(b.heure_fin) && hm(b.heure_debut) < hm(a.heure_fin)) chevauchements++;
      }
      return { s, premier, second, jours: new Set(tous.map((e) => e.date)).size, chevauchements };
    })
    .sort((a, b) => (b.premier.length + b.second.length) - (a.premier.length + a.second.length)
      || a.s.nom.localeCompare(b.s.nom));

  const totaux = lignes.map((l) => l.premier.length + l.second.length);
  const max = Math.max(1, ...totaux);
  const moyenne = lignes.length ? totaux.reduce((a, b) => a + b, 0) / lignes.length : 0;
  const fmtJour = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filtreDate}
          onChange={(e) => setFiltreDate(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-black/15"
        >
          <option value="">Tout le planning</option>
          {dates.map((d) => <option key={d} value={d}>{fmtJour(d)}</option>)}
        </select>
        <span className="text-sm text-gray-800">
          Moyenne : <strong>{moyenne.toFixed(1)}</strong> créneau(x) par surveillant actif
        </span>
        {sansSurveillant > 0 && (
          <button
            type="button"
            onClick={() => allerAffecter({ manque: "surveillant", planningId, date: filtreDate || undefined })}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
            title="Ouvre Salles & surveillants, filtré sur les épreuves sans surveillant"
          >
            <AlertTriangle className="h-3.5 w-3.5" /> {sansSurveillant} épreuve(s) sans surveillant — affecter
          </button>
        )}
      </div>

      {lignes.length === 0 ? (
        <Empty message="Aucun surveillant actif sur ce planning" />
      ) : (
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 bg-black/[0.02] text-xs">
                <th className="text-left px-4 py-2 text-gray-700 font-medium">Surveillant</th>
                <th className="text-left px-4 py-2 text-gray-700 font-medium w-[40%]">Créneaux</th>
                <th className="text-right px-4 py-2 text-gray-700 font-medium">1er</th>
                <th className="text-right px-4 py-2 text-gray-700 font-medium">2ᵉ</th>
                <th className="text-right px-4 py-2 text-gray-700 font-medium">Journées</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => {
                const total = l.premier.length + l.second.length;
                const ecart = total - moyenne;
                const detail = [...l.premier.map((e) => ({ e, role: "1er" })), ...l.second.map((e) => ({ e, role: "2ᵉ" }))]
                  .sort((a, b) => a.e.date.localeCompare(b.e.date) || a.e.heure_debut.localeCompare(b.e.heure_debut));
                return (
                  <React.Fragment key={l.s.id}>
                    <tr
                      onClick={() => setOuvert(ouvert === l.s.id ? null : l.s.id)}
                      className="border-b border-black/[0.04] cursor-pointer hover:bg-black/[0.02]"
                    >
                      <td className="px-4 py-2.5 text-gray-900">
                        <span className="inline-flex items-center gap-1.5">
                          <ChevronRight className={`h-3.5 w-3.5 text-gray-700 transition ${ouvert === l.s.id ? "rotate-90" : ""}`} />
                          <span className="font-medium">{l.s.nom} {l.s.prenom}</span>
                        </span>
                        {l.chevauchements > 0 && (
                          <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-red-700" title="Créneaux qui se recouvrent dans des salles différentes">
                            <AlertTriangle className="h-3 w-3" /> {l.chevauchements} chevauchement(s)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-black/5 overflow-hidden">
                            <div
                              className={`h-full ${total === 0 ? "" : Math.abs(ecart) <= Math.max(1, moyenne * 0.2) ? "bg-emerald-500" : ecart > 0 ? "bg-amber-500" : "bg-sky-500"}`}
                              style={{ width: `${(total / max) * 100}%` }}
                            />
                          </div>
                          <span className="w-8 text-right font-semibold text-gray-900">{total}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-800">{l.premier.length}</td>
                      <td className="px-4 py-2.5 text-right text-gray-800">{l.second.length}</td>
                      <td className="px-4 py-2.5 text-right text-gray-800">{l.jours}</td>
                    </tr>
                    {ouvert === l.s.id && (
                      <tr className="border-b border-black/[0.04] bg-black/[0.015]">
                        <td colSpan={5} className="px-4 py-3">
                          {detail.length === 0 ? (
                            <p className="text-xs text-gray-700">Aucun créneau{filtreDate ? " ce jour-là" : ""}.</p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 text-xs text-gray-900">
                              {detail.map(({ e, role }) => (
                                <div key={`${e.id}-${role}`} className="flex items-center gap-2 rounded-lg bg-white border border-black/5 px-2.5 py-1.5">
                                  <span className="capitalize w-24 shrink-0 text-gray-800">{fmtJour(e.date)}</span>
                                  <span className="font-mono">{e.heure_debut.slice(0, 5)}</span>
                                  <span className="font-medium truncate">{e.matiere}</span>
                                  <span className="ml-auto text-gray-700 truncate">{e.salle_intitule ?? "sans salle"} · {role}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          <p className="px-4 py-2 text-xs text-gray-700 border-t border-black/5">
            Barre verte : proche de la moyenne · orange : au-dessus · bleue : en dessous. Cliquez sur un nom pour voir ses créneaux.
          </p>
        </div>
      )}
    </div>
  );
}

export function SurveillantsSection() {
  const toast = useToast();
  const confirm = useConfirm();
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [selectedPlanningId, setSelectedPlanningId] = useState<number | null>(null);
  const [surveillants, setSurvaillants] = useState<Surveillant[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [credentials, setCredentials] = useState<{
    nom: string; prenom: string; email: string; code_acces: string;
    plainPassword: string; emailSent: boolean;
  } | null>(null);
  const [filterActif, setFilterActif] = useFiltre<"tous" | "actif" | "inactif">("surveillants:actif", "tous");
  const [survRecherche] = useState(() => intentions.surveillant);
  useEffect(() => { if (survRecherche) intentions.surveillant = null; }, [survRecherche]);
  const [search, setSearch] = useFiltre("surveillants:recherche", survRecherche?.nom ?? "", undefined, !!survRecherche);
  const [view, setView] = useFiltre<"annuaire" | "charge">("surveillants:vue", "annuaire");

  useEffect(() => {
    get<Planning[]>("plannings/").then((ps) => {
      setPlannings(ps);
      if (ps.length > 0) setSelectedPlanningId((cur) => cur ?? planningMemorise(ps) ?? ps[0].id);
    }).catch(() => {});
  }, []);
  useEffect(() => memoriserPlanning(selectedPlanningId), [selectedPlanningId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = selectedPlanningId
        ? `surveillants/?planning_id=${selectedPlanningId}`
        : `surveillants/`;
      setSurvaillants(await get<Surveillant[]>(url));
    } finally {
      setLoading(false);
    }
  }, [selectedPlanningId]);

  useEffect(() => { load(); }, [load]);

  const handleToggleActif = async (s: Surveillant) => {
    try {
      const updated = await patch<Surveillant>(`surveillants/${s.id}/actif`, { actif: !s.actif });
      toast.success(updated.actif ? "Surveillant activé" : "Surveillant désactivé");
      setSurvaillants((prev) => prev.map((x) => (x.id === updated.id ? { ...x, actif: updated.actif } : x)));
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)); }
  };

  const handleTogglePlanning = async (s: Surveillant) => {
    if (!selectedPlanningId) return;
    const newActif = s.actif_planning === true ? false : true;
    try {
      const updated = await patch<Surveillant>(
        `surveillants/${s.id}/plannings/${selectedPlanningId}`,
        { actif: newActif }
      );
      toast.success(newActif ? "Associé au planning" : "Dissocié du planning");
      setSurvaillants((prev) => prev.map((x) => (x.id === s.id ? { ...x, actif_planning: updated.actif_planning } : x)));
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)); }
  };

  const handleDelete = async (s: Surveillant) => {
    if (!await confirm(`Supprimer ${s.prenom} ${s.nom} ?`, { confirmLabel: "Supprimer", danger: true })) return;
    try {
      await del(`surveillants/${s.id}`);
      toast.success("Surveillant supprimé");
      load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)); }
  };

  const handleSendCredentials = async (s: Surveillant) => {
    try {
      const res = await post<Surveillant & { plain_password: string; email_sent: boolean }>(
        `surveillants/${s.id}/envoyer-identifiants`, {}
      );
      setCredentials({
        nom: res.nom, prenom: res.prenom, email: res.email,
        code_acces: res.code_acces, plainPassword: res.plain_password, emailSent: res.email_sent,
      });
      if (res.email_sent) toast.success("Identifiants envoyés par email");
      else toast.info("Nouveau mot de passe généré (SMTP non configuré)");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)); }
  };

  const filtered = surveillants.filter((s) => {
    if (filterActif === "actif" && !s.actif) return false;
    if (filterActif === "inactif" && s.actif) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!`${s.nom} ${s.prenom} ${s.email}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-[#C62828]" />
          <div>
            <h2 className="text-xl font-semibold">Surveillants</h2>
            <p className="text-sm text-gray-700">Annuaire, comptes et charge des surveillants — l&apos;affectation se fait dans Salles &amp; surveillants</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="border rounded-lg px-3 py-2 text-sm"
            value={selectedPlanningId ?? ""}
            onChange={(e) => setSelectedPlanningId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Tous les plannings</option>
            {plannings.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
          </select>
          {view === "annuaire" && (
            <>
              <Btn label="Importer" icon={Upload} variant="ghost" onClick={() => setShowImport(true)} />
              <Btn label="Nouveau surveillant" icon={Plus} onClick={() => setShowCreate(true)} />
            </>
          )}
        </div>
      </div>

      {/* Onglets */}
      {selectedPlanningId && (
        <div className="flex rounded-xl border overflow-hidden w-fit text-xs font-medium">
          {(["annuaire", "charge"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-2 transition ${view === v ? "bg-black text-white" : "bg-white text-gray-800 hover:bg-black/5"}`}
            >
              {v === "annuaire" ? "Annuaire" : "Charge par surveillant"}
            </button>
          ))}
        </div>
      )}

      {/* ── Vue Annuaire ── */}
      {view === "annuaire" && (
        <>
          {selectedPlanningId && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex rounded-lg border overflow-hidden text-xs">
                {(["tous", "actif", "inactif"] as const).map((f) => (
                  <button key={f} onClick={() => setFilterActif(f)}
                    className={`px-3 py-1.5 transition ${filterActif === f ? "bg-black text-white" : "bg-white text-gray-800 hover:bg-black/5"}`}
                  >
                    {f === "tous" ? "Tous" : f === "actif" ? "Actifs" : "Inactifs"}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Rechercher…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C62828]/30 w-52"
              />
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center"><Spinner /></div>
          ) : filtered.length === 0 ? (
            <Empty message="Aucun surveillant" sub="Créez le premier surveillant dans le pool global." />
          ) : (
            <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F5F5F5] border-b">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-800 tracking-wide">Nom</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-800 tracking-wide">Email</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-800 tracking-wide">Statut global</th>
                    {selectedPlanningId && (
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-800 tracking-wide">Ce planning</th>
                    )}
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} className="border-t border-black/5 hover:bg-black/[0.012] transition">
                      <td className="px-5 py-3">
                        <p className="font-medium">{s.prenom} {s.nom}</p>
                      </td>
                      <td className="px-5 py-3 text-gray-800 text-xs font-mono">{s.email}</td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => handleToggleActif(s)}
                          className={`text-xs px-2.5 py-1 rounded-full font-semibold transition ${
                            s.actif ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                        >
                          {s.actif ? "Actif" : "Inactif"}
                        </button>
                      </td>
                      {selectedPlanningId && (
                        <td className="px-5 py-3">
                          <button
                            onClick={() => handleTogglePlanning(s)}
                            title={
                              s.actif_planning === true ? "Actif pour ce planning — cliquer pour désactiver"
                              : s.actif_planning === false ? "Inactif pour ce planning — cliquer pour activer"
                              : "Non associé — cliquer pour associer"
                            }
                            className="flex items-center gap-1.5 text-xs hover:opacity-80 transition"
                          >
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              s.actif_planning === true ? "bg-green-500"
                              : s.actif_planning === false ? "bg-amber-400"
                              : "bg-gray-300"
                            }`} />
                            <span className="text-gray-700">
                              {s.actif_planning === true ? "Actif"
                              : s.actif_planning === false ? "Inactif"
                              : "Non associé"}
                            </span>
                          </button>
                        </td>
                      )}
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Btn label="Identifiants" icon={Key} onClick={() => handleSendCredentials(s)} small variant="ghost" />
                          <Btn label="Supprimer" icon={Trash2} onClick={() => handleDelete(s)} small variant="danger" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Charge par surveillant ── */}
      {view === "charge" && selectedPlanningId && (
        <ChargeSurveillants planningId={selectedPlanningId} surveillants={surveillants} />
      )}

      {/* Modal création */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouveau surveillant">
        <CreateSurveillantForm
          planningId={selectedPlanningId!}
          onSuccess={(res) => {
            setShowCreate(false);
            toast.success("Surveillant créé");
            setCredentials({
              nom: res.nom, prenom: res.prenom, email: res.email,
              code_acces: res.code_acces, plainPassword: res.plain_password, emailSent: res.email_sent,
            });
            load();
          }}
        />
      </Modal>

      {/* Modal identifiants */}
      {credentials && (
        <CredentialsModal
          {...credentials}
          onClose={() => setCredentials(null)}
        />
      )}

      <ImportExcelModal
        open={showImport}
        onClose={() => setShowImport(false)}
        title="Importer des surveillants"
        libelle="surveillant"
        templateUrl="/api/backend/surveillants/import/template"
        uploadUrl={`/api/backend/surveillants/import${selectedPlanningId ? `?planning_id=${selectedPlanningId}` : ""}`}
        onSuccess={load}
        resultRenderer={(r) => (r.surveillants?.length > 0 || r.deja_presents?.length > 0) && (
          <div className="mt-3 max-h-48 overflow-y-auto space-y-2">
            {r.surveillants?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-green-800 mb-1">Surveillants créés :</p>
                <ul className="text-xs text-gray-900 space-y-0.5">
                  {r.surveillants.map((x: { id: number; prenom: string; nom: string; email: string }) => (
                    <li key={x.id}>{x.prenom} {x.nom} — {x.email}</li>
                  ))}
                </ul>
              </div>
            )}
            {r.deja_presents?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-900 mb-1">Déjà présents (non recréés{selectedPlanningId ? ", associés au planning" : ""}) :</p>
                <ul className="text-xs text-gray-900 space-y-0.5">
                  {r.deja_presents.map((x: { id: number; prenom: string; nom: string; email: string }) => (
                    <li key={x.id}>{x.prenom} {x.nom} — {x.email}</li>
                  ))}
                </ul>
              </div>
            )}
            {r.emails_programmes > 0 && (
              <p className="text-xs text-gray-900">
                Les identifiants sont envoyés par email à {r.emails_programmes} surveillant{r.emails_programmes > 1 ? "s" : ""}.
              </p>
            )}
          </div>
        )}
      />
    </div>
  );
}

function CreateSurveillantForm({
  planningId,
  onSuccess,
}: {
  planningId: number | null;
  onSuccess: (res: Surveillant & { plain_password: string; email_sent: boolean }) => void;
}) {
  const [form, setForm] = useState({ nom: "", prenom: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.nom.trim() || !form.prenom.trim() || !form.email.trim()) {
      setError("Tous les champs sont obligatoires");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await post<Surveillant & { plain_password: string; email_sent: boolean }>(
        "surveillants/",
        { ...form }
      );
      // Si un planning est sélectionné, on l'associe automatiquement
      if (planningId) {
        await patch(`surveillants/${res.id}/plannings/${planningId}`, { actif: true });
      }
      onSuccess(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Field label="Prénom">
        <Input value={form.prenom} onChange={(e) => set("prenom", e.target.value)} placeholder="Prénom" />
      </Field>
      <Field label="NOM">
        <Input value={form.nom} onChange={(e) => set("nom", e.target.value)} placeholder="NOM" />
      </Field>
      <Field label="Email">
        <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="prenom.nom@exemple.fr" />
      </Field>
      <ErrorMsg msg={error} />
      <Btn
        label={loading ? "Création…" : "Créer et générer identifiants"}
        icon={loading ? undefined : Key}
        onClick={submit}
        disabled={loading || !form.nom || !form.prenom || !form.email}
      />
    </div>
  );
}
