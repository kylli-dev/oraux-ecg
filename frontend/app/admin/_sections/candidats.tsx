"use client";

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useToast, useConfirm } from "../Toast";
import {
  Trash2,
  X,
  Loader2,
  Upload,
  Edit2,
  UserPlus,
  Key,
  Copy,
  Mail,
  Save,
} from "lucide-react";
import {
  Btn,
  DayViewData,
  EPREUVE_STATUT_LABEL,
  Empty,
  ErrorMsg,
  EtablissementItem,
  Field,
  ImportExcelModal,
  Input,
  LigneManque,
  Modal,
  Planning,
  RED,
  Select,
  Spinner,
  StatutBadge,
  TripletDisponible,
  TripletEpreuveGestion,
  del,
  detailPrepa,
  formatDateCourte,
  get,
  hm,
  intentions,
  memoriserPlanning,
  plageAvecPrepa,
  planningMemorise,
  post,
  put,
  statutEpreuveCls,
  useFiltre,
} from "./commun";

type Candidat = {
  id: number;
  planning_id: number;
  nom: string;
  prenom: string;
  email: string;
  code_acces: string;
  statut: string;
};

type CandidatListeItem = {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  code_candidat: string | null;
  civilite: string | null;
  is_inscrit: boolean;
  inscription_id: number | null;
  is_liste_attente: boolean;
  statut: string;
  profil: string | null;
  commentaire?: string | null;
};

// Badge « Non visible candidats » d'un triplet libre auquel il manque une affectation,
// avec la raison affichée en dessous
function BadgeNonPublie({ manques, planningId, date }: { manques?: string[]; planningId: number; date: string }) {
  if (!manques || manques.length === 0) return null;
  return (
    <span
      className="inline-flex flex-col items-end gap-0.5 mr-2 align-middle"
      title="L'admin peut tout de même inscrire un candidat sur ce créneau."
    >
      <span className="text-[10px] font-semibold text-orange-800 bg-orange-50 border border-orange-300 px-1.5 py-0.5 rounded">
        Non visible candidats
      </span>
      {manques.map((m) => (
        <span key={m} className="text-[10px] text-orange-800 whitespace-nowrap">
          Manque <LigneManque ligne={m} planningId={planningId} date={date} />
        </span>
      ))}
    </span>
  );
}

type InscriptionGestion = {
  id: number;
  date: string;
  epreuves: TripletEpreuveGestion[];
};

type FicheCandidat = {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  civilite: string | null;
  code_candidat: string | null;
  numero_ine: string | null;
  profil: string | null;
  tel_portable: string | null;
  handicape: boolean | null;
  classe: string | null;
  etablissement: string | null;
  ville_etablissement: string | null;
  qualite: string | null;
  commentaire?: string | null;
  inscription: InscriptionGestion | null;
  liste_attente: { date: string }[];
};

type JourneeInscritItem = {
  candidat_id: number;
  candidat_nom: string;
  candidat_prenom: string;
  candidat_code: string | null;
  candidat_profil: string | null;
  candidat_classe: string | null;
  inscription_id: number;
  epreuves: TripletEpreuveGestion[];
};

type ListeAttenteAdminDate = {
  date: string;
  created_at: string;
};

type ListeAttenteAdminItem = {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  code_candidat: string | null;
  civilite: string | null;
  profil: string | null;
  dates: ListeAttenteAdminDate[];
  premier_enregistrement: string;
};

// ── Section : Candidats ────────────────────────────────────────────────────────
export function CandidatsSection() {
  const toast = useToast();
  const confirm = useConfirm();
  const [intention] = useState(() => intentions.candidats);
  useEffect(() => { if (intention) intentions.candidats = null; }, [intention]);
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [candidats, setCandidats] = useState<Candidat[]>([]);
  const [planningId, setPlanningId] = useState<number | "">(intention?.planningId ?? "");
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [gestionKey, setGestionKey] = useState(0);
  const [tab, setTab] = useFiltre<"liste" | "gestion" | "liste_attente" | "compactage">("candidats:onglet", intention?.tab ?? "liste", undefined, !!intention);
  const [error, setError] = useState("");
  const [searchCand, setSearchCand] = useFiltre("candidats:recherche", intention?.recherche ?? "", undefined, !!intention);
  const [filterProfil, setFilterProfil] = useFiltre<"" | "HGG" | "ESH">("candidats:profil", "");
  const [selectedCandId, setSelectedCandId] = useState<number | null>(intention?.tab === "liste" ? intention.candidatId : null);
  const [editCandId, setEditCandId] = useState<number | null>(null);

  useEffect(() => {
    get<Planning[]>("plannings/")
      .then((ps) => {
        setPlannings(ps);
        setPlanningId((cur) => cur || planningMemorise(ps) || cur);
      })
      .catch(() => {});
  }, []);
  useEffect(() => memoriserPlanning(planningId), [planningId]);

  const loadCandidats = useCallback(async () => {
    if (!planningId) return;
    setLoading(true);
    setError("");
    try {
      setCandidats(await get<Candidat[]>(`candidats/?planning_id=${planningId}`));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [planningId]);

  useEffect(() => {
    loadCandidats();
  }, [loadCandidats]);

  const handleDelete = async (id: number) => {
    if (!await confirm("Supprimer ce candidat ?", { confirmLabel: "Supprimer", danger: true })) return;
    try {
      await del(`candidats/${id}`);
      toast.success("Candidat supprimé");
      loadCandidats();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDeleteAll = async () => {
    if (!planningId || candidats.length === 0) return;
    if (!await confirm(`Supprimer les ${candidats.length} candidat(s) de ce planning ? Cette action est irréversible.`, { confirmLabel: "Tout supprimer", danger: true })) return;
    // Une seule requête (une par candidat saturait le navigateur sur un gros planning)
    await del(`candidats/planning/${planningId}/all`);
    toast.success(`${candidats.length} candidat(s) supprimé(s)`);
    loadCandidats();
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Candidats</h2>
          <p className="text-sm text-gray-700 mt-0.5">Gérez les candidats et leurs inscriptions</p>
        </div>
        <div className="flex items-center gap-2">
          <Btn
            label="Importer"
            icon={Upload}
            onClick={() => setShowImport(true)}
            disabled={!planningId}
            variant="ghost"
            small
          />
          <Btn
            label="Tout supprimer"
            icon={Trash2}
            onClick={handleDeleteAll}
            disabled={!planningId || candidats.length === 0}
            variant="danger"
            small
          />
          <Btn
            label="Ajouter un candidat"
            icon={UserPlus}
            onClick={() => setShowCreate(true)}
            disabled={!planningId}
          />
        </div>
      </div>

      <div className="mb-5">
        <Field label="Filtrer par planning">
          <Select
            value={planningId}
            onChange={(e) => {
              setPlanningId(e.target.value ? Number(e.target.value) : "");
              setTab("liste");
            }}
          >
            <option value="">-- Sélectionner un planning --</option>
            {plannings.map((p) => (
              <option key={p.id} value={p.id}>{p.nom}</option>
            ))}
          </Select>
        </Field>
      </div>

      {!planningId ? (
        <Empty message="Sélectionnez un planning" sub="Choisissez un planning ci-dessus pour voir ses candidats." />
      ) : (
        <>
          {/* Onglets */}
          <div className="flex border-b border-gray-200 mb-5">
            {(["liste", "gestion", "liste_attente", "compactage"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                  tab === t
                    ? "border-[#C62828] text-[#C62828]"
                    : "border-transparent text-gray-800 hover:text-black"
                }`}
              >
                {t === "liste" ? "Liste"
                  : t === "gestion" ? "Gestion inscriptions"
                  : t === "liste_attente" ? "Liste d'attente"
                  : "Compactage"}
              </button>
            ))}
          </div>

          {tab === "liste" && (
            <>
              <div className="mb-3 flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  placeholder="Rechercher par nom ou prénom…"
                  value={searchCand}
                  onChange={(e) => setSearchCand(e.target.value)}
                  className="w-full max-w-sm border border-black/15 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                />
                <div className="flex gap-1">
                  {(["", "HGG", "ESH"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setFilterProfil(p)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
                        filterProfil === p
                          ? p === "HGG" ? "bg-purple-100 text-purple-700 border-purple-300"
                            : p === "ESH" ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                            : "bg-black/10 text-gray-900 border-black/20"
                          : "bg-white text-gray-700 border-black/10 hover:bg-black/[0.03]"
                      }`}
                    >
                      {p === "" ? "Tous" : p}
                    </button>
                  ))}
                </div>
              </div>
              {loading ? (
                <div className="flex justify-center py-16 text-gray-700"><Spinner /></div>
              ) : error ? (
                <ErrorMsg msg={error} />
              ) : candidats.length === 0 ? (
                <Empty message="Aucun candidat" sub="Ajoutez des candidats à ce planning." />
              ) : (
                <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#F5F5F5] text-left">
                        {["Nom", "Prénom", "Email", "Profil", "Statut", ""].map((h) => (
                          <th key={h} className="px-5 py-3.5 text-xs font-semibold text-gray-800 tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {candidats.filter((c) => {
                        const q = searchCand.trim().toLowerCase();
                        if (q && !c.nom.toLowerCase().includes(q) && !c.prenom.toLowerCase().includes(q)) return false;
                        if (filterProfil) {
                          const p = c.profil?.toUpperCase() ||
                            ((c.classe || "").toUpperCase().includes("ESH") ? "ESH" :
                             (c.classe || "").toUpperCase().includes("HGG") ? "HGG" : "");
                          if (p !== filterProfil) return false;
                        }
                        return true;
                      }).map((c) => (
                        <tr
                          key={c.id}
                          onClick={() => setSelectedCandId(c.id)}
                          className={`border-t border-black/5 cursor-pointer hover:bg-black/[0.02] transition ${selectedCandId === c.id ? "bg-red-50 border-l-2 border-l-[#C62828]" : ""}`}
                        >
                          <td className="px-5 py-3.5 font-medium">{c.nom}</td>
                          <td className="px-5 py-3.5">{c.prenom}</td>
                          <td className="px-5 py-3.5 text-gray-800">{c.email}</td>
                          <td className="px-5 py-3.5">
                            {(() => {
                              const p = c.profil?.toUpperCase() ||
                                ((c.classe || "").toUpperCase().includes("ESH") ? "ESH" :
                                 (c.classe || "").toUpperCase().includes("HGG") ? "HGG" : "");
                              return p === "HGG"
                                ? <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-100 text-purple-700">HGG</span>
                                : p === "ESH"
                                ? <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">ESH</span>
                                : <span className="text-xs text-gray-700">—</span>;
                            })()}
                          </td>
                          <td className="px-5 py-3.5"><StatutBadge statut={c.statut} /></td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditCandId(c.id); }}
                                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 text-gray-900 border border-black/15 rounded-lg hover:bg-black/[0.03] transition"
                              >
                                <Edit2 className="h-3 w-3" />
                                Modifier
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedCandId(c.id); }}
                                className="text-xs px-2.5 py-1 text-[#C62828] border border-[#C62828]/30 rounded-lg hover:bg-red-50 transition"
                              >
                                Gérer
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition text-red-600 bg-red-50 hover:bg-red-100"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Supprimer
                              </button>
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

          {tab === "gestion" && (
            <GestionCandidatsTab key={gestionKey} planningId={planningId as number} />
          )}

          {tab === "liste_attente" && (
            <ListeAttenteTab planningId={planningId as number} candidatInitial={intention?.candidatId ?? null} />
          )}

          {tab === "compactage" && (
            <CompactageTab
              planningId={planningId as number}
              planning={plannings.find(p => p.id === planningId) ?? null}
            />
          )}
        </>
      )}

      <ImportExcelModal
        open={showImport}
        onClose={() => setShowImport(false)}
        title="Importer des candidats"
        templateUrl={`/api/backend/excel/candidats/template-complet`}
        uploadUrl={`/api/backend/excel/plannings/${planningId}/candidats/import-complet`}
        onSuccess={() => { loadCandidats(); setGestionKey(k => k + 1); }}
        resultRenderer={(r) => r.candidats?.length > 0 && (
          <div className="mt-3 max-h-40 overflow-y-auto">
            <p className="text-xs font-medium text-green-700 mb-1">Candidats importés ({r.candidats.length}) — mots de passe provisoires :</p>
            <table className="w-full text-xs">
              <thead><tr><th className="text-left text-green-700">Nom</th><th className="text-left text-green-700">Login</th><th className="text-left text-green-700">MDP provisoire</th></tr></thead>
              <tbody>
                {r.candidats.map((c: {id: number; prenom: string; nom: string; login: string; password_provisoire: string}) => (
                  <tr key={c.id}><td>{c.prenom} {c.nom}</td><td className="font-mono">{c.login}</td><td className="font-mono font-bold">{c.password_provisoire}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      />

      <Modal open={editCandId !== null} onClose={() => setEditCandId(null)} title="Modifier le candidat" wide>
        {editCandId !== null && (
          <CreateCandidatForm
            key={editCandId}
            plannings={plannings}
            candidatId={editCandId}
            onSuccess={() => { setEditCandId(null); loadCandidats(); }}
          />
        )}
      </Modal>

      <Modal open={showCreate} onClose={() => { setShowCreate(false); loadCandidats(); }} title="Ajouter un candidat" wide>
        <CreateCandidatForm
          plannings={plannings}
          defaultPlanningId={planningId !== "" ? planningId : undefined}
          onSuccess={() => { setShowCreate(false); loadCandidats(); }}
        />
      </Modal>

      <AnimatePresence>
        {selectedCandId !== null && planningId !== "" && (
          <CandidatGestionDrawer
            key={selectedCandId}
            candidatId={selectedCandId}
            planningId={planningId as number}
            onClose={() => setSelectedCandId(null)}
            onRefreshList={loadCandidats}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Formulaire d'ajout — et de modification quand candidatId est fourni (onglet Liste) :
// mêmes champs, mêmes contrôles, pré-rempli avec la fiche du candidat.
type CandidatDetail = {
  id: number; planning_id: number; nom: string; prenom: string; email: string;
  profil: string | null; classe: string | null; civilite: string | null; code_candidat: string | null;
  numero_ine: string | null; date_naissance: string | null; tel_portable: string | null;
  qualite: string | null; handicape: boolean | null; code_uai: string | null; etablissement: string | null;
};

function CreateCandidatForm({
  plannings,
  defaultPlanningId,
  onSuccess,
  candidatId,
}: {
  plannings: Planning[];
  defaultPlanningId?: number;
  onSuccess: () => void;
  candidatId?: number;
}) {
  const toast = useToast();
  const edition = candidatId != null;
  const [form, setForm] = useState({
    planning_id: defaultPlanningId ?? (plannings[0]?.id ?? 0),
    civilite: "",
    nom: "",
    prenom: "",
    email: "",
    profil: "" as "" | "HGG" | "ESH",
    classe: "",
    code_candidat: "",
    numero_ine: "",
    date_naissance: "", // aaaa-mm-jj (champ date), converti en jj/mm/aaaa à l'envoi
    tel_portable: "",
    qualite: "",
    handicape: false,
    code_uai: "",
    envoyer_identifiants: false,
  });
  const [etablissements, setEtablissements] = useState<EtablissementItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Identifiants renvoyés par le serveur : le mot de passe n'est montré qu'une seule fois
  const [cree, setCree] = useState<{ nom: string; login: string; password: string; envoye: boolean } | null>(null);
  // Établissement importé absent du référentiel : affiché tel quel, conservé s'il n'est pas changé
  const [etabActuel, setEtabActuel] = useState<{ code_uai: string; nom: string } | null>(null);
  const [chargement, setChargement] = useState(edition);

  useEffect(() => {
    get<EtablissementItem[]>("parametrages/etablissements/").then(setEtablissements).catch(() => {});
  }, []);

  useEffect(() => {
    if (candidatId == null) return;
    get<CandidatDetail>(`candidats/${candidatId}`)
      .then((c) => {
        const cl = (c.classe ?? "").toUpperCase();
        const profil = (c.profil ?? "").toUpperCase() || (cl.includes("ESH") ? "ESH" : cl.includes("HGG") ? "HGG" : "");
        const dn = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(c.date_naissance ?? "");
        setForm((f) => ({
          ...f,
          planning_id: c.planning_id,
          civilite: c.civilite ?? "",
          nom: c.nom,
          prenom: c.prenom,
          email: c.email,
          profil: profil === "HGG" || profil === "ESH" ? profil : "",
          classe: c.classe ?? "",
          code_candidat: c.code_candidat ?? "",
          numero_ine: c.numero_ine ?? "",
          date_naissance: dn ? `${dn[3]}-${dn[2]}-${dn[1]}` : "",
          tel_portable: c.tel_portable ?? "",
          qualite: c.qualite ?? "",
          handicape: !!c.handicape,
          code_uai: c.code_uai ?? "",
        }));
        if (c.code_uai) setEtabActuel({ code_uai: c.code_uai, nom: c.etablissement ?? c.code_uai });
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setChargement(false));
  }, [candidatId]);

  const setF = (k: string, v: string | number | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const emailValide = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim());
  const pret = !!form.nom.trim() && !!form.prenom.trim() && emailValide && !!form.profil;

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const [a, m, j] = form.date_naissance ? form.date_naissance.split("-") : [];
      if (edition) {
        const { planning_id: _p, envoyer_identifiants: _e, ...fiche } = form;
        void _p; void _e;
        await put(`candidats/${candidatId}`, { ...fiche, date_naissance: form.date_naissance ? `${j}/${m}/${a}` : "" });
        toast.success("Fiche du candidat enregistrée");
        onSuccess();
        return;
      }
      const res = await post<{ login: string; password_provisoire: string; email_identifiants_envoye: boolean }>("candidats/", {
        ...form,
        date_naissance: form.date_naissance ? `${j}/${m}/${a}` : "",
      });
      setCree({
        nom: `${form.prenom.trim()} ${form.nom.trim()}`,
        login: res.login,
        password: res.password_provisoire,
        envoye: res.email_identifiants_envoye,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  if (chargement) return <div className="flex justify-center py-10"><Spinner /></div>;

  if (cree) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-900">
          <span className="font-semibold">{cree.nom}</span> a été ajouté(e). Identifiants de connexion au portail candidat :
        </p>
        <div className="rounded-lg border border-black/10 bg-gray-50 p-3 text-sm space-y-1">
          <div><span className="text-gray-800">Login :</span> <span className="font-mono text-gray-900">{cree.login}</span></div>
          <div className="flex items-center gap-2">
            <span className="text-gray-800">Mot de passe provisoire :</span>
            <span className="font-mono text-gray-900">{cree.password}</span>
            <button
              onClick={() => navigator.clipboard?.writeText(`Login : ${cree.login}\nMot de passe : ${cree.password}`)}
              className="text-gray-800 hover:text-black"
              title="Copier les identifiants"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-800">
          {cree.envoye
            ? "Les identifiants ont été envoyés par e-mail au candidat (modèle « Admissibilité »)."
            : "Notez ce mot de passe : il ne sera plus affiché. Vous pourrez en générer un nouveau dans Paramétrages."}
        </p>
        <Btn label="Terminer" onClick={onSuccess} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!edition && (
        <Field label="Planning">
          <Select value={form.planning_id} onChange={(e) => setF("planning_id", Number(e.target.value))}>
            {plannings.map((p) => (
              <option key={p.id} value={p.id}>{p.nom}</option>
            ))}
          </Select>
        </Field>
      )}
      <div className="grid grid-cols-[110px_1fr_1fr] gap-3">
        <Field label="Civilité">
          <Select value={form.civilite} onChange={(e) => setF("civilite", e.target.value)}>
            <option value="">—</option>
            <option value="M.">M.</option>
            <option value="Mme">Mme</option>
          </Select>
        </Field>
        <Field label="Nom *">
          <Input value={form.nom} onChange={(e) => setF("nom", e.target.value)} placeholder="DUPONT" />
        </Field>
        <Field label="Prénom *">
          <Input value={form.prenom} onChange={(e) => setF("prenom", e.target.value)} placeholder="Alice" />
        </Field>
      </div>
      <Field label="Email *" hint={form.email && !emailValide ? "Adresse email invalide" : "Sert aussi d'identifiant de connexion au portail"}>
        <Input type="email" value={form.email} onChange={(e) => setF("email", e.target.value)} placeholder="alice.dupont@exemple.fr" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Profil *" hint="Détermine les triplets proposés (ESH ou HGG)">
          <Select value={form.profil} onChange={(e) => setF("profil", e.target.value)}>
            <option value="">— Choisir —</option>
            <option value="HGG">HGG</option>
            <option value="ESH">ESH</option>
          </Select>
        </Field>
        <Field label="Classe">
          <Input
            value={form.classe}
            onChange={(e) => setF("classe", e.target.value)}
            placeholder={form.profil ? `ECG - Maths approfondies et ${form.profil}` : "ECG - Maths approfondies et …"}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Code candidat">
          <Input value={form.code_candidat} onChange={(e) => setF("code_candidat", e.target.value)} />
        </Field>
        <Field label="N° INE">
          <Input value={form.numero_ine} onChange={(e) => setF("numero_ine", e.target.value)} />
        </Field>
        <Field label="Date de naissance">
          <Input type="date" value={form.date_naissance} onChange={(e) => setF("date_naissance", e.target.value)} />
        </Field>
        <Field label="Téléphone portable">
          <Input type="tel" value={form.tel_portable} onChange={(e) => setF("tel_portable", e.target.value)} />
        </Field>
        <Field label="Qualité">
          <Select value={form.qualite} onChange={(e) => setF("qualite", e.target.value)}>
            <option value="">—</option>
            <option value="Boursier">Boursier</option>
            <option value="Non boursier">Non boursier</option>
          </Select>
        </Field>
        <Field label="Établissement">
          <Select value={form.code_uai} onChange={(e) => setF("code_uai", e.target.value)}>
            <option value="">—</option>
            {etabActuel && !etablissements.some((et) => et.code_uai === etabActuel.code_uai) && (
              <option value={etabActuel.code_uai}>{etabActuel.nom} (hors référentiel)</option>
            )}
            {etablissements.map((et) => (
              <option key={et.id} value={et.code_uai}>{et.nom}{et.ville ? ` (${et.ville})` : ""}</option>
            ))}
          </Select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-900 cursor-pointer">
        <input type="checkbox" checked={form.handicape} onChange={(e) => setF("handicape", e.target.checked)} />
        Candidat en situation de handicap
      </label>
      {!edition && (
        <label className="flex items-center gap-2 text-sm text-gray-900 cursor-pointer">
          <input type="checkbox" checked={form.envoyer_identifiants} onChange={(e) => setF("envoyer_identifiants", e.target.checked)} />
          Envoyer les identifiants par e-mail au candidat (modèle « Admissibilité »)
        </label>
      )}
      <ErrorMsg msg={error} />
      <Btn
        label={loading ? (edition ? "Enregistrement…" : "Création…") : edition ? "Enregistrer" : "Créer le candidat"}
        icon={edition ? Save : UserPlus}
        onClick={submit}
        disabled={loading || !pret}
      />
      {!pret && <p className="text-xs text-gray-800">* Nom, prénom, email valide et profil sont obligatoires.</p>}
    </div>
  );
}

// Commentaire libre des admins sur la fiche (absence, changement de créneau, échange avec la famille…)
function CommentaireCandidat({ candidatId, initial, onSaved }: { candidatId: number; initial: string | null; onSaved?: () => void }) {
  const toast = useToast();
  const [texte, setTexte] = useState(initial ?? "");
  const [enregistre, setEnregistre] = useState(initial ?? "");
  const [saving, setSaving] = useState(false);
  const modifie = texte.trim() !== enregistre.trim();

  const enregistrer = async () => {
    setSaving(true);
    try {
      const r = await put<{ commentaire: string | null }>(`gestion-candidats/candidat/${candidatId}/commentaire`, { commentaire: texte });
      setEnregistre(r.commentaire ?? "");
      setTexte(r.commentaire ?? "");
      toast.success("Commentaire enregistré");
      onSaved?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-700 uppercase tracking-wide mb-2">Commentaire</p>
      <textarea
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        maxLength={2000}
        rows={4}
        placeholder="Absence, changement de créneau, échange avec la famille…"
        className="w-full rounded-lg border border-black/15 bg-white px-2 py-1.5 text-xs text-gray-900 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-black/10 resize-y"
      />
      {modifie && (
        <div className="flex gap-2 mt-1.5">
          <button
            onClick={enregistrer}
            disabled={saving}
            className="text-xs px-2.5 py-1 rounded-lg bg-black text-white hover:bg-black/80 transition disabled:opacity-50"
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
          <button
            onClick={() => setTexte(enregistre)}
            disabled={saving}
            className="text-xs px-2.5 py-1 rounded-lg border border-black/15 text-gray-800 hover:bg-black/5 transition disabled:opacity-50"
          >
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}

// ── CandidatGestionDrawer ─────────────────────────────────────────────────────
function CandidatGestionDrawer({
  candidatId,
  planningId,
  onClose,
  onRefreshList,
}: {
  candidatId: number;
  planningId: number;
  onClose: () => void;
  onRefreshList: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [fiche, setFiche] = useState<FicheCandidat | null>(null);
  const [triplets, setTriplets] = useState<TripletDisponible[]>([]);
  const [loadingAction, setLoadingAction] = useState(false);
  const [credsResult, setCredsResult] = useState<{ login: string; password: string } | null>(null);
  // Mode assignation libre
  const [modeLibre, setModeLibre] = useState(false);
  const [libresDate, setLibresDate] = useState("");
  const [libresData, setLibresData] = useState<Record<string, { id: number; heure_debut: string; heure_fin: string; statut: string; preparation_minutes?: number | null }[]>>({});
  const [selection, setSelection] = useState<Record<string, number>>({});
  const [loadingLibres, setLoadingLibres] = useState(false);

  // Cassage partiel + assignation directe : créneaux compatibles avec les épreuves restantes
  type CreneauCompatible = {
    id: number; matiere: string; heure_prepa: string | null; heure_debut: string; heure_fin: string;
    statut: string; salle: string | null; compatible: boolean; motif: string | null;
  };
  const [compat, setCompat] = useState<{ date: string | null; matieres_manquantes: string[]; creneaux: CreneauCompatible[] } | null>(null);
  const [voirIncompatibles, setVoirIncompatibles] = useState(false);
  // Filtres de la liste « Créneaux disponibles »
  const [fDate, setFDate] = useState("");
  const [fPeriode, setFPeriode] = useState<"" | "matin" | "apres-midi">("");
  const [fHeure, setFHeure] = useState("");
  const [fStatut, setFStatut] = useState("");
  const [fAVenir, setFAVenir] = useState(true);

  const loadData = useCallback(() => {
    get<FicheCandidat>(`gestion-candidats/candidat/${candidatId}/fiche`).then(setFiche).catch(() => {});
    get<TripletDisponible[]>(`gestion-candidats/${planningId}/triplets`).then(setTriplets).catch(() => {});
    get<{ date: string | null; matieres_manquantes: string[]; creneaux: CreneauCompatible[] }>(
      `gestion-candidats/candidat/${candidatId}/creneaux-compatibles`
    ).then(setCompat).catch(() => setCompat(null));
  }, [candidatId, planningId]);

  useEffect(() => { loadData(); }, [loadData]);

  const refresh = () => { loadData(); onRefreshList(); };

  const doInscrire = async (t: TripletDisponible) => {
    setLoadingAction(true);
    try {
      await post(`gestion-candidats/candidat/${candidatId}/inscrire`, { date: t.date, heure_debut: t.heure_debut, epreuve_ids: t.epreuves.map((e) => e.id) });
      toast.success(fiche?.inscription ? "Réinscription effectuée" : "Candidat inscrit");
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setLoadingAction(false); }
  };

  const doAction = async (endpoint: string, confirmMsg: string, successMsg: string, danger = false) => {
    if (!await confirm(confirmMsg, { confirmLabel: "Confirmer", danger })) return;
    setLoadingAction(true);
    try {
      await post(`gestion-candidats/candidat/${candidatId}/${endpoint}`, {});
      toast.success(successMsg);
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setLoadingAction(false); }
  };

  const doRetirerEpreuve = async (ep: { id: number; matiere: string; heure_debut: string }, libererEn: "LIBRE" | "PRERESERVEE") => {
    const quoi = libererEn === "LIBRE" ? "redeviendra libre pour tous" : "sera préréservé (mis de côté)";
    if (!await confirm(
      `Retirer l'épreuve de ${ep.matiere} (${ep.heure_debut}) du triplet de ${fiche?.nom} ${fiche?.prenom} ? ` +
      `Ses autres épreuves restent réservées ; ce créneau ${quoi}.`,
      { confirmLabel: "Retirer", danger: true }
    )) return;
    setLoadingAction(true);
    try {
      await post(`gestion-candidats/candidat/${candidatId}/epreuve/${ep.id}/retirer`, { liberer_en: libererEn });
      toast.success(`${ep.matiere} retiré — les autres épreuves sont conservées`);
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setLoadingAction(false); }
  };

  const doAssignerEpreuve = async (cr: { id: number; matiere: string; heure_debut: string }) => {
    setLoadingAction(true);
    try {
      await post(`gestion-candidats/candidat/${candidatId}/epreuve/${cr.id}/assigner`, {});
      toast.success(`${cr.matiere} ${cr.heure_debut} assigné`);
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setLoadingAction(false); }
  };

  const doEnvoyerIdentifiants = async () => {
    setLoadingAction(true);
    try {
      const r = await post<{ login: string; new_password: string }>(`parametrages/candidats/${candidatId}/reset-password`, {});
      setCredsResult({ login: r.login, password: r.new_password });
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setLoadingAction(false); }
  };

  const loadLibres = async (date: string) => {
    if (!date) { setLibresData({}); return; }
    setLoadingLibres(true);
    try {
      const eps = await get<{ id: number; matiere: string; heure_debut: string; heure_fin: string; statut: string; preparation_minutes?: number | null }[]>(
        `gestion-candidats/${planningId}/epreuves-disponibles?date=${date}`
      );
      const grouped: Record<string, { id: number; heure_debut: string; heure_fin: string; statut: string; preparation_minutes?: number | null }[]> = {};
      for (const ep of eps) {
        if (!grouped[ep.matiere]) grouped[ep.matiere] = [];
        grouped[ep.matiere].push({ id: ep.id, heure_debut: ep.heure_debut, heure_fin: ep.heure_fin, statut: ep.statut, preparation_minutes: ep.preparation_minutes });
      }
      setLibresData(grouped);
      setSelection({});
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setLoadingLibres(false); }
  };

  const doInscrireDirect = async () => {
    const ids = Object.values(selection).filter(Boolean);
    if (ids.length === 0) return;
    setLoadingAction(true);
    try {
      await post(`gestion-candidats/candidat/${candidatId}/inscrire-direct`, { epreuve_ids: ids });
      toast.success("Assignation libre effectuée");
      setModeLibre(false);
      setSelection({});
      setLibresData({});
      setLibresDate("");
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setLoadingAction(false); }
  };

  const fmt_date = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  const PROFIL_EXCLUSION: Record<string, string> = { HGG: "ESH", ESH: "HGG" };
  const classeUp = (fiche?.classe || "").toUpperCase();
  const profilUpper = (fiche?.profil || "").toUpperCase() ||
    (classeUp.includes("ESH") ? "ESH" : classeUp.includes("HGG") ? "HGG" : "");
  const matiereExclue = PROFIL_EXCLUSION[profilUpper];

  // Triplets compatibles avec le profil du candidat, puis filtres de la fenêtre
  const aujourdhui = new Date().toLocaleDateString("sv-SE"); // AAAA-MM-JJ, heure locale
  const tripletsProfil = triplets.filter(t =>
    !matiereExclue || !t.epreuves.some(e => e.matiere.toUpperCase() === matiereExclue)
  );
  const tripletsFiltres = tripletsProfil
    .filter(t => !fAVenir || t.date >= aujourdhui)
    .filter(t => !fDate || t.date === fDate)
    .filter(t => !fPeriode || (fPeriode === "matin" ? t.heure_debut < "13:00" : t.heure_debut >= "13:00"))
    .filter(t => !fHeure || t.heure_debut === fHeure)
    .filter(t => !fStatut || t.type_slot === fStatut)
    .sort((a, b) => a.date.localeCompare(b.date) || a.heure_debut.localeCompare(b.heure_debut));
  const datesDispo = [...new Set(tripletsProfil.filter(t => !fAVenir || t.date >= aujourdhui).map(t => t.date))].sort();
  const heuresDispo = [...new Set(
    tripletsProfil.filter(t => (!fAVenir || t.date >= aujourdhui) && (!fDate || t.date === fDate)).map(t => t.heure_debut)
  )].sort();
  const filtresActifs = !!(fDate || fPeriode || fHeure || fStatut) || !fAVenir;
  const resetFiltres = () => { setFDate(""); setFPeriode(""); setFHeure(""); setFStatut(""); setFAVenir(true); };

  const tripletsByDate: Record<string, TripletDisponible[]> = {};
  for (const t of tripletsFiltres) {
    if (!tripletsByDate[t.date]) tripletsByDate[t.date] = [];
    tripletsByDate[t.date].push(t);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative w-full max-w-3xl bg-white shadow-2xl flex flex-col h-full"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-white shrink-0">
          <div>
            {fiche ? (
              <>
                {fiche.civilite && <p className="text-xs text-gray-700">{fiche.civilite}</p>}
                <h3 className="font-bold text-base leading-tight">{fiche.nom} {fiche.prenom}</h3>
                {fiche.code_candidat && <p className="text-xs font-mono text-gray-700 mt-0.5">{fiche.code_candidat}</p>}
              </>
            ) : (
              <div className="h-5 w-40 bg-black/5 rounded animate-pulse" />
            )}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-black/5 transition ml-4">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body: two columns */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Left: identity card */}
          <div className="w-56 shrink-0 border-r flex flex-col overflow-y-auto bg-gray-50/50">
            {!fiche ? (
              <div className="flex justify-center p-6"><Spinner /></div>
            ) : (
              <div className="p-4 space-y-4">
                {/* Identity */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-700 uppercase tracking-wide mb-2">Identité</p>
                  <dl className="space-y-1.5 text-xs">
                    <div className="flex gap-1.5 flex-wrap"><dt className="text-gray-700 w-12 shrink-0">Email</dt><dd className="break-all min-w-0">{fiche.email}</dd></div>
                    {fiche.tel_portable && <div className="flex gap-1.5"><dt className="text-gray-700 w-12 shrink-0">Tél.</dt><dd>{fiche.tel_portable}</dd></div>}
                    {fiche.profil && <div className="flex gap-1.5"><dt className="text-gray-700 w-12 shrink-0">Profil</dt><dd className="font-medium text-blue-700">{fiche.profil}</dd></div>}
                    {fiche.classe && <div className="flex gap-1.5"><dt className="text-gray-700 w-12 shrink-0">Classe</dt><dd>{fiche.classe}</dd></div>}
                    {fiche.etablissement && <div className="flex gap-1.5 flex-wrap"><dt className="text-gray-700 w-12 shrink-0">Établ.</dt><dd className="break-words min-w-0">{fiche.etablissement}</dd></div>}
                    {fiche.qualite && <div className="flex gap-1.5"><dt className="text-gray-700 w-12 shrink-0">Qualité</dt><dd>{fiche.qualite}</dd></div>}
                    {fiche.numero_ine && <div className="flex gap-1.5"><dt className="text-gray-700 w-12 shrink-0">INE</dt><dd className="font-mono">{fiche.numero_ine}</dd></div>}
                    {fiche.handicape !== null && fiche.handicape !== undefined && (
                      <div className="flex gap-1.5"><dt className="text-gray-700 w-12 shrink-0">Handicap</dt>
                        <dd className={fiche.handicape ? "text-amber-700 font-semibold" : ""}>{fiche.handicape ? "Oui" : "Non"}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                <CommentaireCandidat key={fiche.id} candidatId={fiche.id} initial={fiche.commentaire ?? null} />

                {/* Liste d'attente */}
                {fiche.liste_attente.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-gray-700 uppercase tracking-wide mb-2">Liste d&apos;attente</p>
                    <div className="flex flex-col gap-1">
                      {fiche.liste_attente.map(la => (
                        <span key={la.date} className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded">
                          {new Date(la.date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Envoyer identifiants */}
                <div className="pt-2 border-t">
                  <button
                    onClick={doEnvoyerIdentifiants}
                    disabled={loadingAction}
                    className="w-full text-xs px-3 py-2 bg-white border border-black/15 rounded-lg hover:bg-black/[0.03] transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <Key className="h-3 w-3" />
                    Envoyer les identifiants
                  </button>

                  {/* Inline creds display */}
                  {credsResult && (
                    <div className="mt-2 p-2 bg-gray-50 border rounded-lg space-y-1.5">
                      {[
                        { label: "Login", val: credsResult.login },
                        { label: "MDP", val: credsResult.password },
                      ].map(({ label, val }) => (
                        <div key={label} className="flex items-center justify-between gap-1">
                          <div>
                            <p className="text-[9px] text-gray-700 uppercase">{label}</p>
                            <p className="text-xs font-mono font-medium truncate max-w-[100px]">{val}</p>
                          </div>
                          <button
                            onClick={() => { const el = document.createElement('textarea'); el.value = val; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el); }}
                            className="text-gray-700 hover:text-[#C62828] transition shrink-0"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: inscription + triplets */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 min-w-0">
            <p className="text-sm font-bold text-gray-900 uppercase tracking-wide">Inscription aux oraux</p>

            {/* Inscription courante */}
            {fiche?.inscription ? (
              <div className="rounded-xl border bg-white shadow-sm p-4">
                <p className="text-xs font-semibold text-green-700 mb-3">
                  ✓ Inscrit(e) le <span className="capitalize">{fmt_date(fiche.inscription.date)}</span>
                </p>
                <div className="rounded-lg border overflow-hidden text-sm mb-3 divide-y">
                  {fiche.inscription.epreuves.map(e => (
                    <div key={e.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                      <span className="font-semibold text-gray-900 w-20">{e.matiere}</span>
                      <span className="text-gray-900 tabular-nums font-medium" title={detailPrepa(e)}>{plageAvecPrepa(e)}</span>
                      {!!e.preparation_minutes && (
                        <span className="text-[11px] text-gray-700 tabular-nums">prépa {e.preparation_minutes} min · oral {e.heure_debut}</span>
                      )}
                      <div className="ml-auto flex gap-1.5">
                        <button
                          onClick={() => doRetirerEpreuve(e, "LIBRE")}
                          disabled={loadingAction}
                          title="Retirer cette épreuve ; le créneau redevient libre"
                          className="text-[11px] px-2 py-1 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition disabled:opacity-50"
                        >
                          Retirer
                        </button>
                        <button
                          onClick={() => doRetirerEpreuve(e, "PRERESERVEE")}
                          disabled={loadingAction}
                          title="Retirer cette épreuve ; le créneau est préréservé (mis de côté)"
                          className="text-[11px] px-2 py-1 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 transition disabled:opacity-50"
                        >
                          Retirer + préréserver
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Assignation directe : compléter le triplet avec un créneau compatible */}
                {compat && compat.matieres_manquantes.length > 0 && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 mb-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-900">
                      Triplet incomplet — à compléter : {compat.matieres_manquantes.join(", ")}
                    </p>
                    <p className="text-[11px] text-gray-800">
                      Créneaux libres ou préréservés du même jour, compatibles avec ses autres épreuves
                      (préparation et changement de salle compris). Cliquez sur un horaire pour l&apos;assigner.
                    </p>
                    {compat.matieres_manquantes.map(m => {
                      const crs = compat.creneaux.filter(c => c.matiere === m && (voirIncompatibles || c.compatible));
                      return (
                        <div key={m}>
                          <p className="text-xs font-semibold text-gray-900 mb-1">{m}</p>
                          {crs.length === 0 ? (
                            <p className="text-xs italic text-gray-700">Aucun créneau compatible disponible ce jour-là.</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {crs.map(c => (
                                <button
                                  key={c.id}
                                  onClick={() => c.compatible && doAssignerEpreuve(c)}
                                  disabled={loadingAction || !c.compatible}
                                  title={c.compatible
                                    ? `Assigner ${m} ${c.heure_debut}${c.salle ? ` — salle ${c.salle}` : ""}`
                                    : `Incompatible : ${c.motif}`}
                                  className={`text-xs px-2.5 py-1 rounded-lg border tabular-nums transition ${
                                    c.compatible
                                      ? c.statut === "PRERESERVEE"
                                        ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                                        : "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                                      : "border-gray-200 bg-gray-50 text-gray-700 line-through cursor-not-allowed"
                                  } disabled:opacity-60`}
                                >
                                  {c.heure_debut}{c.salle ? ` · ${c.salle}` : ""}{c.statut === "PRERESERVEE" ? " (préréservé)" : ""}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {compat.creneaux.some(c => !c.compatible) && (
                      <button
                        onClick={() => setVoirIncompatibles(v => !v)}
                        className="text-[11px] text-gray-800 underline hover:text-black"
                      >
                        {voirIncompatibles ? "Masquer les créneaux incompatibles" : "Afficher aussi les créneaux incompatibles"}
                      </button>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => doAction("desinscrire", `Désinscrire ${fiche.nom} ${fiche.prenom} ?`, "Candidat désinscrit", true)}
                    disabled={loadingAction}
                    className="text-xs px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition disabled:opacity-50"
                  >
                    Désinscrire
                  </button>
                  <button
                    onClick={() => doAction("desinscrire-prereserver", "Désinscrire et préréserver les créneaux ?", "Désinscrit et créneaux préréservés", true)}
                    disabled={loadingAction}
                    className="text-xs px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition disabled:opacity-50"
                  >
                    Désinscrire + Préréserver
                  </button>
                  <button
                    onClick={() => doAction("casser-triplet", `Casser le triplet de ${fiche.nom} ${fiche.prenom} ?`, "Triplet cassé")}
                    disabled={loadingAction}
                    className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
                  >
                    Casser le triplet
                  </button>
                </div>
              </div>
            ) : fiche ? (
              <div className="rounded-xl border border-dashed bg-gray-50 p-4 text-xs text-gray-700 text-center">
                Non inscrit(e) à ce jour
              </div>
            ) : null}

            {/* Triplets disponibles / Assignation libre */}
            <div className="rounded-xl border bg-white shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-800">
                  {modeLibre ? "Assignation libre" : "Créneaux disponibles (rotation N²)"}
                </p>
                <button
                  onClick={() => { setModeLibre(o => !o); setLibresDate(""); setLibresData({}); setSelection({}); }}
                  className={`text-[10px] px-2.5 py-1 rounded-lg border transition ${modeLibre ? "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100" : "bg-gray-50 text-gray-800 border-gray-200 hover:bg-gray-100"}`}
                >
                  {modeLibre ? "← Rotation N²" : "Assignation libre →"}
                </button>
              </div>

              {!modeLibre && tripletsProfil.length > 0 && (
                <div className="mb-3 rounded-lg border border-black/10 bg-gray-50 p-2.5 space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <select value={fDate} onChange={(e) => { setFDate(e.target.value); setFHeure(""); }}
                      className="text-xs border border-black/15 rounded-lg px-2 py-1.5 bg-white text-gray-900" title="Date">
                      <option value="">Toutes les dates</option>
                      {datesDispo.map(d => <option key={d} value={d}>{formatDateCourte(d)}</option>)}
                    </select>
                    <select value={fPeriode} onChange={(e) => setFPeriode(e.target.value as "" | "matin" | "apres-midi")}
                      className="text-xs border border-black/15 rounded-lg px-2 py-1.5 bg-white text-gray-900" title="Période">
                      <option value="">Matin et après-midi</option>
                      <option value="matin">Matin (avant 13h)</option>
                      <option value="apres-midi">Après-midi (13h et après)</option>
                    </select>
                    <select value={fHeure} onChange={(e) => setFHeure(e.target.value)}
                      className="text-xs border border-black/15 rounded-lg px-2 py-1.5 bg-white text-gray-900" title="Heure de début">
                      <option value="">Toutes les heures</option>
                      {heuresDispo.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <select value={fStatut} onChange={(e) => setFStatut(e.target.value)}
                      className="text-xs border border-black/15 rounded-lg px-2 py-1.5 bg-white text-gray-900" title="Statut">
                      <option value="">Tous les statuts</option>
                      <option value="LIBRE">Libre</option>
                      <option value="PRERESERVEE">Préréservé</option>
                      <option value="INDISPONIBLE">Indisponible</option>
                    </select>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-1.5 text-xs text-gray-900 cursor-pointer">
                      <input type="checkbox" checked={fAVenir} onChange={(e) => { setFAVenir(e.target.checked); setFDate(""); }} />
                      À venir uniquement (à partir d&apos;aujourd&apos;hui)
                    </label>
                    <span className="text-xs text-gray-900">
                      <span className="font-semibold">{tripletsFiltres.length}</span> créneau{tripletsFiltres.length > 1 ? "x" : ""}
                      {filtresActifs && <> sur {tripletsProfil.length}</>}
                      {filtresActifs && (
                        <button onClick={resetFiltres} className="ml-2 font-medium hover:underline" style={{ color: RED }}>
                          Réinitialiser
                        </button>
                      )}
                    </span>
                  </div>
                </div>
              )}

              {!modeLibre ? (
                Object.keys(tripletsByDate).length === 0 ? (
                  <p className="text-xs text-gray-700">
                    {tripletsProfil.length === 0
                      ? "Aucun créneau disponible"
                      : "Aucun créneau ne correspond aux filtres."}
                    {tripletsProfil.length > 0 && filtresActifs && (
                      <button onClick={resetFiltres} className="ml-1 font-medium hover:underline" style={{ color: RED }}>
                        Réinitialiser
                      </button>
                    )}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(tripletsByDate).map(([date, trips]) => {
                      const allMatieres = [...new Set(trips.flatMap(t => t.epreuves.map(e => e.matiere)))].sort();
                      return (
                        <div key={date}>
                          <p className="text-xs font-semibold text-gray-800 mb-2 capitalize">{fmt_date(date)}</p>
                          <div className="rounded-lg border overflow-hidden">
                            <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-gray-50 text-left">
                                  <th className="px-3 py-2 text-gray-700 font-semibold">Heure</th>
                                  {allMatieres.map(m => (
                                    <th key={m} className="px-3 py-2 text-gray-700 font-semibold">{m}</th>
                                  ))}
                                  <th className="px-3 py-2"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {trips.map((t, idx) => (
                                  <tr
                                    key={idx}
                                    className={`border-t border-black/5 ${t.type_slot === "PRERESERVEE" ? "bg-amber-50/60" : ""}`}
                                  >
                                    <td className="px-3 py-2 font-medium">{t.heure_debut}</td>
                                    {allMatieres.map(mat => {
                                      const ep = t.epreuves.find(e => e.matiere === mat);
                                      return (
                                        <td key={mat} className="px-3 py-2 tabular-nums whitespace-nowrap" title={ep && ep.heure_fin ? detailPrepa(ep) : undefined}>
                                          {ep ? (ep.heure_fin ? plageAvecPrepa(ep) : ep.heure_debut) : '–'}
                                        </td>
                                      );
                                    })}
                                    <td className="px-3 py-2 text-right whitespace-nowrap">
                                      <BadgeNonPublie manques={t.manques_publication} planningId={planningId} date={t.date} />
                                      {t.type_slot === "PRERESERVEE" && (
                                        <span className="mr-2 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                          Préréservé
                                        </span>
                                      )}
                                      {t.type_slot === "INDISPONIBLE" && (
                                        <span className="mr-2 text-[10px] text-gray-800 bg-gray-100 border border-gray-300 px-1.5 py-0.5 rounded" title={t.motif ?? undefined}>
                                          Indisponible
                                        </span>
                                      )}
                                      <button
                                        onClick={() => doInscrire(t)}
                                        disabled={loadingAction}
                                        className="text-[10px] px-2.5 py-1 rounded-lg text-white transition disabled:opacity-50 bg-[#C62828] hover:bg-[#B71C1C]"
                                      >
                                        Inscrire
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                /* Mode assignation libre */
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-800 shrink-0">Date</label>
                    <input
                      type="date"
                      value={libresDate}
                      onChange={(e) => { setLibresDate(e.target.value); loadLibres(e.target.value); }}
                      className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-200"
                    />
                    {loadingLibres && <Loader2 className="h-3 w-3 animate-spin text-gray-700" />}
                  </div>

                  {libresDate && Object.keys(libresData).length === 0 && !loadingLibres && (
                    <p className="text-xs text-gray-700">Aucun créneau libre pour cette date.</p>
                  )}

                  {Object.keys(libresData).length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] text-gray-700">Choisir un créneau par matière (★ = préréservé)</p>
                      {Object.entries(libresData).map(([matiere, eps]) => (
                        <div key={matiere} className="flex items-center gap-2">
                          <span className="text-xs font-semibold w-24 shrink-0 truncate" title={matiere}>{matiere}</span>
                          <select
                            value={selection[matiere] ?? ""}
                            onChange={(e) => setSelection(prev => ({ ...prev, [matiere]: Number(e.target.value) }))}
                            className="text-xs border rounded-lg px-2 py-1.5 flex-1 focus:outline-none focus:ring-1 focus:ring-orange-200"
                          >
                            <option value="">-- Choisir --</option>
                            {eps.map(ep => (
                              <option key={ep.id} value={ep.id}>
                                {plageAvecPrepa(ep)}{ep.preparation_minutes ? ` (oral ${ep.heure_debut})` : ""}{ep.statut === "PRERESERVEE" ? " ★" : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                      <button
                        onClick={doInscrireDirect}
                        disabled={loadingAction || Object.keys(libresData).length === 0 || Object.keys(libresData).some(m => !selection[m])}
                        className="text-xs px-3 py-1.5 rounded-lg text-white bg-[#C62828] hover:bg-[#B71C1C] disabled:opacity-40 flex items-center gap-1.5"
                      >
                        {loadingAction && <Loader2 className="h-3 w-3 animate-spin" />}
                        Inscrire ({Object.values(selection).filter(Boolean).length}/{Object.keys(libresData).length} matières sélectionnées)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── CompactageTab ─────────────────────────────────────────────────────────────
function CompactageTab({
  planningId,
  planning,
}: {
  planningId: number;
  planning: Planning | null;
}) {
  const toast = useToast();
  const storageKey = `compactage_date_${planningId}`;
  const [selectedDate, setSelectedDate] = useState(planning?.date_debut ?? "");
  const [inscrits, setInscrits] = useState<JourneeInscritItem[]>([]);

  // Restaure la dernière date choisie depuis localStorage après le montage
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) setSelectedDate(saved);
  }, [storageKey]);

  // Sauvegarde dès que la date change
  useEffect(() => {
    if (selectedDate) localStorage.setItem(storageKey, selectedDate);
  }, [storageKey, selectedDate]);
  const [triplets, setTriplets] = useState<TripletDisponible[]>([]);
  const [jour, setJour] = useState<DayViewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [drawerCandidatId, setDrawerCandidatId] = useState<number | null>(null);
  const [markingAbsent, setMarkingAbsent] = useState<Set<number>>(new Set());
  const confirm = useConfirm();
  // Filtres (liste des trous + tableau des inscrits)
  const [fRecherche, setFRecherche] = useState("");
  const [fMatiere, setFMatiere] = useState("");
  const [fSession, setFSession] = useState<"" | "Matin" | "Après-midi">("");
  const [fMotif, setFMotif] = useState<"" | "LIBRE" | "PRERESERVEE" | "ABSENT">("");
  const [fProfil, setFProfil] = useState<"" | "HGG" | "ESH">("");
  const [fAbsents, setFAbsents] = useState(false);
  const filtresActifs = !!(fRecherche || fMatiere || fSession || fMotif || fProfil || fAbsents);
  const resetFiltres = () => {
    setFRecherche(""); setFMatiere(""); setFSession(""); setFMotif(""); setFProfil(""); setFAbsents(false);
  };

  const toggleAbsent = async (candidatId: number, ep: TripletEpreuveGestion) => {
    setMarkingAbsent(s => new Set(s).add(ep.id));
    try {
      const isAbsent = ep.statut === "ABSENT";
      if (isAbsent) {
        await del(`gestion-candidats/candidat/${candidatId}/epreuve/${ep.id}/marquer-absent`);
      } else {
        await post(`gestion-candidats/candidat/${candidatId}/epreuve/${ep.id}/marquer-absent`, {});
      }
      loadDay();
    } catch {
      toast.error("Erreur lors du marquage d'absence");
    } finally {
      setMarkingAbsent(s => { const n = new Set(s); n.delete(ep.id); return n; });
    }
  };

  const loadDay = useCallback(() => {
    setLoading(true);
    const dateParam = selectedDate ? `?date=${selectedDate}` : "";
    Promise.all([
      get<JourneeInscritItem[]>(`gestion-candidats/${planningId}/journee${dateParam}`),
      get<TripletDisponible[]>(`gestion-candidats/${planningId}/triplets`),
      selectedDate
        ? get<DayViewData>(`plannings/${planningId}/day?date=${selectedDate}`)
        : Promise.resolve(null),
    ])
      .then(([i, t, d]) => { setInscrits(i); setTriplets(t); setJour(d); })
      .catch(() => toast.error("Erreur lors du chargement"))
      .finally(() => setLoading(false));
  }, [planningId, selectedDate]);

  useEffect(() => { loadDay(); }, [loadDay]);

  // All subjects for that day (for column headers)
  const allMatieres = [...new Set(inscrits.flatMap(c => c.epreuves.map(e => e.matiere)))].sort();

  // Free triplets for the selected date
  const freeTriplets = triplets.filter(t => t.date === selectedDate);

  // Trous de la journée = épreuves sans candidat présent : libres, préréservées, ou dont le
  // candidat est marqué absent (l'épreuve reste « Absent » pour garder la trace, jusqu'à ce
  // que l'admin libère la place pour la réattribuer).
  const trous = (jour?.demi_journees ?? [])
    .flatMap(dj => dj.epreuves.map(e => ({ ...e, session: dj.type === "MATIN" ? "Matin" : "Après-midi" })))
    .filter(e => e.statut === "ABSENT" || ((e.statut === "LIBRE" || e.statut === "PRERESERVEE") && e.candidat_id == null))
    .sort((a, b) => hm(a.heure_debut).localeCompare(hm(b.heure_debut)) || a.matiere.localeCompare(b.matiere, "fr"));
  const nbAbsents = trous.filter(e => e.statut === "ABSENT").length;

  // Session de chaque épreuve (les inscrits ne la portent pas) et matières de la journée
  const sessionParEpreuve = new Map<number, string>(
    (jour?.demi_journees ?? []).flatMap(dj => dj.epreuves.map(e => [e.id, dj.type === "MATIN" ? "Matin" : "Après-midi"] as [number, string]))
  );
  const matieresJour = [...new Set((jour?.demi_journees ?? []).flatMap(dj => dj.epreuves.map(e => e.matiere)))]
    .sort((a, b) => a.localeCompare(b, "fr"));
  const q = fRecherche.trim().toLowerCase();
  const profilDe = (c: JourneeInscritItem) => {
    const p = (c.candidat_profil ?? "").toUpperCase();
    if (p) return p;
    const cl = (c.candidat_classe ?? "").toUpperCase();
    return cl.includes("ESH") ? "ESH" : cl.includes("HGG") ? "HGG" : "";
  };

  const trousFiltres = trous
    .filter(e => !fMatiere || e.matiere === fMatiere)
    .filter(e => !fSession || e.session === fSession)
    .filter(e => !fMotif || e.statut === fMotif)
    .filter(e => !fAbsents || e.statut === "ABSENT")
    .filter(e => !q || `${e.candidat_nom ?? ""} ${e.candidat_prenom ?? ""}`.toLowerCase().includes(q));

  // Un candidat est gardé s'il a au moins une épreuve correspondant à la matière / session
  const inscritsFiltres = inscrits
    .filter(c => !q || `${c.candidat_nom} ${c.candidat_prenom} ${c.candidat_code ?? ""}`.toLowerCase().includes(q))
    .filter(c => !fProfil || profilDe(c) === fProfil)
    .filter(c => !fAbsents || c.epreuves.some(ep => ep.statut === "ABSENT"))
    .filter(c => c.epreuves.some(ep =>
      (!fMatiere || ep.matiere === fMatiere) && (!fSession || sessionParEpreuve.get(ep.id) === fSession)
    ));

  const libererPlace = async (e: (typeof trous)[number]) => {
    if (e.candidat_id == null) return;
    if (!await confirm(
      `Libérer la place de ${e.candidat_nom ?? ""} ${e.candidat_prenom ?? ""} (${e.matiere} à ${hm(e.heure_debut)}) ? ` +
      "L'épreuve est retirée de son inscription et redevient Libre (visible sur le portail) ; la mention « absent » n'est plus conservée sur ce créneau.",
      { confirmLabel: "Libérer", danger: true }
    )) return;
    try {
      await post(`gestion-candidats/candidat/${e.candidat_id}/epreuve/${e.id}/retirer`, { liberer_en: "LIBRE" });
      toast.success("Place libérée");
      loadDay();
    } catch (err) { toast.error(err instanceof Error ? err.message : String(err)); }
  };

  const fmt_date = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold">Compactage du planning</h3>
          <p className="text-xs text-gray-700 mt-0.5">
            Visualisez les candidats inscrits par journée et réaffectez-les pour combler les trous créés par des absences.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-800 shrink-0">Journée :</label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            min={planning?.date_debut}
            max={planning?.date_fin}
            className="border border-black/15 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <>
          {/* Filtres */}
          {(inscrits.length > 0 || trous.length > 0) && (
            <div className="rounded-xl border bg-white shadow-sm p-3 flex flex-wrap items-end gap-3">
              <label className="text-xs text-gray-900 space-y-1">
                <span className="block font-medium">Candidat</span>
                <input
                  value={fRecherche}
                  onChange={e => setFRecherche(e.target.value)}
                  placeholder="Nom, prénom, code…"
                  className="border border-black/15 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 bg-white w-48"
                />
              </label>
              <label className="text-xs text-gray-900 space-y-1">
                <span className="block font-medium">Matière</span>
                <select value={fMatiere} onChange={e => setFMatiere(e.target.value)} className="border border-black/15 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 bg-white">
                  <option value="">Toutes</option>
                  {matieresJour.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label className="text-xs text-gray-900 space-y-1">
                <span className="block font-medium">Session</span>
                <select value={fSession} onChange={e => setFSession(e.target.value as "" | "Matin" | "Après-midi")} className="border border-black/15 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 bg-white">
                  <option value="">Toutes</option>
                  <option value="Matin">Matin</option>
                  <option value="Après-midi">Après-midi</option>
                </select>
              </label>
              <label className="text-xs text-gray-900 space-y-1">
                <span className="block font-medium">Motif du trou</span>
                <select value={fMotif} onChange={e => setFMotif(e.target.value as "" | "LIBRE" | "PRERESERVEE" | "ABSENT")} className="border border-black/15 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 bg-white">
                  <option value="">Tous</option>
                  <option value="LIBRE">Libre</option>
                  <option value="PRERESERVEE">Préréservé</option>
                  <option value="ABSENT">Absent</option>
                </select>
              </label>
              <label className="text-xs text-gray-900 space-y-1">
                <span className="block font-medium">Profil</span>
                <select value={fProfil} onChange={e => setFProfil(e.target.value as "" | "HGG" | "ESH")} className="border border-black/15 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 bg-white">
                  <option value="">Tous</option>
                  <option value="HGG">HGG</option>
                  <option value="ESH">ESH</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-900 cursor-pointer pb-1.5">
                <input type="checkbox" checked={fAbsents} onChange={e => setFAbsents(e.target.checked)} />
                Absents uniquement
              </label>
              {filtresActifs && (
                <button onClick={resetFiltres} className="text-sm text-[#C62828] hover:underline pb-1.5">
                  Réinitialiser les filtres
                </button>
              )}
            </div>
          )}

          {/* Trous de la journée */}
          {trous.length === 0 ? (
            selectedDate && (
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                Aucun trou ce jour : toutes les épreuves ont un candidat présent.
              </div>
            )
          ) : (
            <div className="rounded-xl border border-gray-300 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-100 border-b border-gray-300 text-sm text-gray-900 flex flex-wrap gap-x-4 gap-y-1">
                <span className="font-semibold">{trous.length} créneau{trous.length > 1 ? "x" : ""} vide{trous.length > 1 ? "s" : ""}</span>
                {nbAbsents > 0 && <span>dont {nbAbsents} absence{nbAbsents > 1 ? "s" : ""}</span>}
                {filtresActifs && <span>{trousFiltres.length} affiché{trousFiltres.length > 1 ? "s" : ""}</span>}
                <span>{freeTriplets.length} triplet{freeTriplets.length > 1 ? "s" : ""} complet{freeTriplets.length > 1 ? "s" : ""} libre{freeTriplets.length > 1 ? "s" : ""}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      {["Heure", "Matière", "Session", "Salle", "Motif", ""].map(h => (
                        <th key={h} className="px-4 py-2 text-xs font-semibold text-gray-900">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {trousFiltres.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-3 text-sm text-gray-800">Aucun créneau vide ne correspond aux filtres.</td></tr>
                    )}
                    {trousFiltres.map(e => (
                      <tr key={e.id} className="border-t border-black/5">
                        <td className="px-4 py-2 font-mono text-gray-900">{hm(e.heure_debut)}</td>
                        <td className="px-4 py-2 text-gray-900">{e.matiere}</td>
                        <td className="px-4 py-2 text-gray-900">{e.session}</td>
                        <td className="px-4 py-2 text-gray-900">{e.salle_intitule ?? <span className="italic text-gray-700">non assignée</span>}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-semibold ${statutEpreuveCls(e.statut)}`}>
                            {e.statut === "ABSENT"
                              ? `Absent : ${e.candidat_nom ?? ""} ${e.candidat_prenom ?? ""}`.trim()
                              : EPREUVE_STATUT_LABEL[e.statut] ?? e.statut}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          {e.statut === "ABSENT" && e.candidat_id != null && (
                            <button
                              onClick={() => libererPlace(e)}
                              className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-black/15 text-gray-900 hover:bg-black/[0.03] transition"
                            >
                              Libérer la place
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="px-4 py-2 border-t text-xs text-gray-800">
                Pour combler un trou, ouvrez « Réaffecter » sur un candidat et déplacez son épreuve sur ce créneau.
                Une place d&apos;absent doit d&apos;abord être libérée.
              </p>
            </div>
          )}

          {inscrits.length === 0 ? (
            <Empty
              message="Aucun candidat inscrit ce jour"
              sub={freeTriplets.length > 0
                ? `${freeTriplets.length} créneau(x) libre(s) disponible(s) pour d'autres journées.`
                : "Aucune inscription ni créneau libre ce jour."}
            />
          ) : (
            <>
              <p className="text-xs text-gray-700">
                {filtresActifs ? `${inscritsFiltres.length} sur ` : ""}{inscrits.length} candidat(s) inscrit(s) le{" "}
                <span className="font-medium text-gray-800 capitalize">{fmt_date(selectedDate)}</span>
              </p>

              <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left border-b">
                      <th className="px-4 py-3 text-xs font-semibold text-gray-700">Candidat</th>
                      {allMatieres.map(m => (
                        <th key={m} className="px-4 py-3 text-xs font-semibold text-gray-700">{m}</th>
                      ))}
                      <th className="px-4 py-3 text-xs font-semibold text-gray-700"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {inscritsFiltres.length === 0 && (
                      <tr><td colSpan={allMatieres.length + 2} className="px-4 py-3 text-sm text-gray-800">Aucun candidat ne correspond aux filtres.</td></tr>
                    )}
                    {inscritsFiltres.map((c, i) => {
                      const slotByMatiere: Record<string, TripletEpreuveGestion> = {};
                      for (const e of c.epreuves) slotByMatiere[e.matiere] = e;

                      const hasAbsence = c.epreuves.some(ep => ep.statut === "ABSENT");

                      return (
                        <tr
                          key={c.candidat_id}
                          className={`border-t border-black/5 group ${
                            hasAbsence ? "bg-red-50/40" : i % 2 === 0 ? "" : "bg-black/[0.01]"
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium flex items-center gap-2">
                              {c.candidat_nom} {c.candidat_prenom}
                              {hasAbsence && (
                                <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-semibold">
                                  ABSENT PARTIEL
                                </span>
                              )}
                            </div>
                            {c.candidat_code && (
                              <div className="text-xs font-mono text-gray-700">{c.candidat_code}</div>
                            )}
                          </td>
                          {allMatieres.map(m => {
                            const ep = slotByMatiere[m];
                            const isAbsent = ep?.statut === "ABSENT";
                            const isBusy = markingAbsent.has(ep?.id ?? -1);
                            return (
                              <td key={m} className="px-4 py-3 text-xs">
                                {ep ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className={`font-mono ${isAbsent ? "line-through text-red-300" : "text-gray-800"}`}>
                                      {ep.heure_debut}
                                    </span>
                                    {isAbsent ? (
                                      <button
                                        onClick={() => toggleAbsent(c.candidat_id, ep)}
                                        disabled={isBusy}
                                        title="Annuler l'absence"
                                        className="text-[10px] px-1.5 py-0.5 rounded border border-red-300 bg-red-100 text-red-600 hover:bg-red-200 transition disabled:opacity-40"
                                      >
                                        {isBusy ? "…" : "✕ absent"}
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => toggleAbsent(c.candidat_id, ep)}
                                        disabled={isBusy}
                                        title="Marquer absent sur cette épreuve"
                                        className="text-[10px] px-1.5 py-0.5 rounded border border-black/15 text-gray-700 hover:border-red-300 hover:text-red-500 hover:bg-red-50 transition opacity-0 group-hover:opacity-100 disabled:opacity-40"
                                      >
                                        {isBusy ? "…" : "absent"}
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-700">—</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => setDrawerCandidatId(c.candidat_id)}
                              className="text-xs px-3 py-1.5 rounded-lg border font-medium transition text-[#C62828] border-[#C62828]/30 hover:bg-red-50"
                            >
                              Réaffecter
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </>
          )}
        </>
      )}

      {/* Gestion drawer for reassignment */}
      <AnimatePresence>
        {drawerCandidatId !== null && (
          <CandidatGestionDrawer
            key={drawerCandidatId}
            candidatId={drawerCandidatId}
            planningId={planningId}
            onClose={() => setDrawerCandidatId(null)}
            onRefreshList={loadDay}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── ListeAttenteTab ──────────────────────────────────────────────────────────
function ListeAttenteTab({ planningId, candidatInitial = null }: { planningId: number; candidatInitial?: number | null }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [liste, setListe] = useState<ListeAttenteAdminItem[]>([]);
  const [triplets, setTriplets] = useState<TripletDisponible[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(candidatInitial);
  const [search, setSearch] = useState("");
  const [loadingAction, setLoadingAction] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      get<ListeAttenteAdminItem[]>(`gestion-candidats/${planningId}/liste-attente`),
      get<TripletDisponible[]>(`gestion-candidats/${planningId}/triplets`),
    ]).then(([l, t]) => { setListe(l); setTriplets(t); }).catch(() => {}).finally(() => setLoading(false));
  }, [planningId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const selected = liste.find(c => c.id === selectedId) ?? null;

  // Triplets filtered to the candidate's available dates and profile
  const _LA_PROFIL_EXCL: Record<string, string> = { HGG: "ESH", ESH: "HGG" };
  const _laProfilUp = (selected?.profil || "").toUpperCase();
  const _laMatiereExclue = _LA_PROFIL_EXCL[_laProfilUp];
  const candidatDates = new Set(selected?.dates.map(d => d.date) ?? []);
  const tripletsFiltered = selected
    ? triplets.filter(t =>
        candidatDates.has(t.date) &&
        (!_laMatiereExclue || !t.epreuves.some(e => e.matiere.toUpperCase() === _laMatiereExclue))
      )
    : [];
  const tripletsByDate: Record<string, TripletDisponible[]> = {};
  for (const t of tripletsFiltered) {
    if (!tripletsByDate[t.date]) tripletsByDate[t.date] = [];
    tripletsByDate[t.date].push(t);
  }

  const doInscrire = async (c: ListeAttenteAdminItem, t: TripletDisponible) => {
    if (!await confirm(`Inscrire ${c.nom} ${c.prenom} sur le créneau du ${fmt_date(t.date)} à ${t.heure_debut} ?`, { confirmLabel: "Inscrire" })) return;
    setLoadingAction(true);
    try {
      await post(`gestion-candidats/candidat/${c.id}/inscrire`, { date: t.date, heure_debut: t.heure_debut, epreuve_ids: t.epreuves.map((e) => e.id) });
      toast.success(`${c.prenom} ${c.nom} inscrit(e) — sorti(e) de la liste d'attente`);
      setSelectedId(null);
      loadAll();
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setLoadingAction(false); }
  };

  const fmt_date = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  // « Prévenir par e-mail » : l'admin choisit qui prévenir (ordre de la file), jamais
  // automatique. Mémorisé seulement pour la session, pour éviter un double envoi par mégarde.
  const [prevenus, setPrevenus] = useState<Set<string>>(new Set());
  const doPrevenir = async (c: ListeAttenteAdminItem, date: string) => {
    if (!await confirm(
      `Envoyer à ${c.prenom} ${c.nom} (${c.email}) l'e-mail « une place s'est libérée le ${fmt_date(date)} » ? ` +
      "La place n'est pas réservée : le candidat devra s'inscrire lui-même sur le portail.",
      { confirmLabel: "Envoyer" }
    )) return;
    setLoadingAction(true);
    try {
      await post(`gestion-candidats/${planningId}/liste-attente/prevenir`, { candidat_id: c.id, date });
      setPrevenus((prev) => new Set(prev).add(`${c.id}|${date}`));
      toast.success(`E-mail envoyé à ${c.prenom} ${c.nom}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setLoadingAction(false); }
  };

  const fmt_datetime = (s: string) =>
    new Date(s).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

  const filtered = liste.filter(c => {
    const q = search.toLowerCase();
    return !q || `${c.nom} ${c.prenom} ${c.email} ${c.code_candidat ?? ""}`.toLowerCase().includes(q);
  });

  if (loading) return <div className="flex justify-center py-16 text-gray-700"><Spinner /></div>;

  if (liste.length === 0) {
    return (
      <Empty
        message="Aucun candidat en liste d'attente"
        sub="Les candidats qui s'inscrivent sur liste d'attente apparaîtront ici."
      />
    );
  }

  return (
    <div className="flex gap-4" style={{ height: "calc(100vh - 220px)" }}>
      {/* ── Colonne gauche : liste candidats en L.A. ── */}
      <div className="w-64 flex-shrink-0 flex flex-col border rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="p-2.5 border-b">
          <input
            type="text"
            placeholder="Rechercher…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-xs px-2.5 py-1.5 border rounded-lg bg-gray-50 focus:outline-none focus:ring-1 focus:ring-[#C62828]"
          />
        </div>
        <div className="overflow-y-auto flex-1 divide-y divide-black/5">
          {filtered.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id === selectedId ? null : c.id)}
              className={`w-full text-left px-3 py-2.5 text-xs hover:bg-black/[0.03] transition ${
                selectedId === c.id ? "bg-amber-50 border-l-2 border-amber-500" : ""
              }`}
            >
              <div className="font-medium truncate">{c.nom} {c.prenom}</div>
              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                {c.code_candidat && <span className="font-mono text-gray-700">{c.code_candidat}</span>}
                {c.profil && <span className="bg-blue-100 text-blue-700 px-1 rounded text-[10px]">{c.profil}</span>}
                <span className="bg-amber-100 text-amber-700 px-1 rounded text-[10px]">{c.dates.length} date(s)</span>
              </div>
              <div className="text-[10px] text-gray-700 mt-0.5">depuis le {fmt_datetime(c.premier_enregistrement)}</div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="p-4 text-xs text-gray-700 text-center">Aucun résultat</p>
          )}
        </div>
        <div className="px-3 py-2 border-t bg-black/[0.02] text-[10px] text-gray-700">
          {liste.length} candidat(s) en liste d&apos;attente
        </div>
      </div>

      {/* ── Zone principale ── */}
      {!selected ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-700">
          Sélectionnez un candidat pour voir ses disponibilités et l&apos;inscrire
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto min-w-0 space-y-4">
          {/* En-tête candidat */}
          <div className="rounded-xl border bg-white shadow-sm p-4 flex items-start justify-between">
            <div>
              {selected.civilite && <p className="text-xs text-gray-700">{selected.civilite}</p>}
              <h3 className="text-base font-bold leading-tight">{selected.nom} {selected.prenom}</h3>
              <p className="text-xs text-gray-800 mt-0.5">{selected.email}</p>
              {selected.code_candidat && (
                <p className="text-xs font-mono text-gray-700 mt-0.5">{selected.code_candidat}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              {selected.profil && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">{selected.profil}</span>
              )}
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                L.A. depuis le {fmt_datetime(selected.premier_enregistrement)}
              </span>
            </div>
          </div>

          {/* Dates disponibles */}
          <div className="rounded-xl border bg-white shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-800 mb-2">
              Journées pour lesquelles {selected.prenom} a indiqué des disponibilités
            </p>
            <div className="flex flex-wrap gap-2">
              {selected.dates.map(d => {
                const hasTriplets = tripletsByDate[d.date]?.length > 0;
                return (
                  <span
                    key={d.date}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${
                      hasTriplets
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-gray-50 text-gray-700 border-gray-200"
                    }`}
                  >
                    {new Date(d.date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long" })}
                    {hasTriplets && <span className="ml-1 text-[10px]">({tripletsByDate[d.date].length} dispo.)</span>}
                    {!hasTriplets && <span className="ml-1 text-[10px]">(complet)</span>}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Créneaux disponibles */}
          {Object.keys(tripletsByDate).length === 0 ? (
            <div className="rounded-xl border border-dashed bg-gray-50 p-6 text-sm text-gray-700 text-center">
              Aucun créneau disponible sur les journées indiquées par ce candidat
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-gray-800">
                Créneaux disponibles sur les journées de disponibilité
              </p>
              {Object.entries(tripletsByDate).map(([date, trips]) => {
                const allMatieres = [...new Set(trips.flatMap(t => t.epreuves.map(e => e.matiere)))].sort();
                const dejaPrevenu = prevenus.has(`${selected.id}|${date}`);
                return (
                  <div key={date} className="rounded-xl border bg-white shadow-sm overflow-hidden">
                    <div className="px-4 py-2.5 border-b bg-gray-50 flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-xs font-semibold capitalize">{fmt_date(date)}</p>
                      <button
                        onClick={() => doPrevenir(selected, date)}
                        disabled={loadingAction}
                        title="Envoie au candidat l'e-mail « Place libérée » (modèle éditable dans Paramétrages)"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border border-black/15 bg-white text-gray-900 hover:bg-black/[0.03] disabled:opacity-50 transition"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        {dejaPrevenu ? "Prévenu ✓ — renvoyer" : "Prévenir par e-mail"}
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left border-b">
                          <th className="px-4 py-2 text-gray-700 font-semibold">Heure</th>
                          {allMatieres.map(m => (
                            <th key={m} className="px-4 py-2 text-gray-700 font-semibold">{m}</th>
                          ))}
                          <th className="px-4 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {trips.map((t, idx) => (
                          <tr
                            key={idx}
                            className={`border-t border-black/5 ${t.type_slot === "PRERESERVEE" ? "bg-amber-50/50" : ""}`}
                          >
                            <td className="px-4 py-2.5 font-medium">{t.heure_debut}</td>
                            {allMatieres.map(mat => {
                              const ep = t.epreuves.find(e => e.matiere === mat);
                              return <td key={mat} className="px-4 py-2.5">{ep?.heure_debut ?? '–'}</td>;
                            })}
                            <td className="px-4 py-2.5 text-right whitespace-nowrap">
                              <BadgeNonPublie manques={t.manques_publication} planningId={planningId} date={t.date} />
                              {t.type_slot === "PRERESERVEE" && (
                                <span className="mr-2 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                  Préréservé
                                </span>
                              )}
                              <button
                                onClick={() => doInscrire(selected, t)}
                                disabled={loadingAction}
                                className="text-[10px] px-3 py-1.5 rounded-lg text-white transition disabled:opacity-50 bg-[#C62828] hover:bg-[#B71C1C] font-medium"
                              >
                                Inscrire
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── GestionCandidatsTab ────────────────────────────────────────────────────────
function GestionCandidatsTab({ planningId }: { planningId: number }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [liste, setListe] = useState<CandidatListeItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [fiche, setFiche] = useState<FicheCandidat | null>(null);
  const [triplets, setTriplets] = useState<TripletDisponible[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useFiltre<"" | "inscrits" | "non_inscrits" | "attente">("gestion:statut", "");
  const [filterProfil, setFilterProfil] = useFiltre<"" | "HGG" | "ESH">("gestion:profil", "");
  const [filterDateCreneau, setFilterDateCreneau] = useFiltre("gestion:date", "", planningId);
  const [filterHeureCreneau, setFilterHeureCreneau] = useFiltre("gestion:heure", "", planningId);
  const [loadingAction, setLoadingAction] = useState(false);

  const loadListe = useCallback(() => {
    get<CandidatListeItem[]>(`gestion-candidats/${planningId}/candidats`)
      .then(setListe)
      .catch(() => {});
  }, [planningId]);

  const loadTriplets = useCallback(() => {
    get<TripletDisponible[]>(`gestion-candidats/${planningId}/triplets`)
      .then(setTriplets)
      .catch(() => {});
  }, [planningId]);

  const loadFiche = useCallback(() => {
    if (!selectedId) { setFiche(null); return; }
    get<FicheCandidat>(`gestion-candidats/candidat/${selectedId}/fiche`)
      .then(setFiche)
      .catch(() => {});
  }, [selectedId]);

  useEffect(() => { loadListe(); loadTriplets(); }, [loadListe, loadTriplets]);
  useEffect(() => { loadFiche(); }, [loadFiche]);

  const refresh = () => { loadListe(); loadTriplets(); loadFiche(); };

  const doInscrire = async (t: TripletDisponible) => {
    if (!selectedId) return;
    setLoadingAction(true);
    try {
      await post(`gestion-candidats/candidat/${selectedId}/inscrire`, { date: t.date, heure_debut: t.heure_debut, epreuve_ids: t.epreuves.map((e) => e.id) });
      toast.success("Candidat inscrit");
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setLoadingAction(false); }
  };

  const doAction = async (endpoint: string, confirm_msg: string, successMsg?: string) => {
    if (!selectedId) return;
    if (!await confirm(confirm_msg, { confirmLabel: "Confirmer", danger: endpoint.includes("desinscrire") || endpoint.includes("annuler") })) return;
    setLoadingAction(true);
    try {
      await post(`gestion-candidats/candidat/${selectedId}/${endpoint}`, {});
      if (successMsg) toast.success(successMsg);
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setLoadingAction(false); }
  };

  const fmt_date = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  const filtered = liste.filter(c => {
    if (filterStatut === "inscrits" && !c.is_inscrit) return false;
    if (filterStatut === "non_inscrits" && c.is_inscrit) return false;
    if (filterStatut === "attente" && !c.is_liste_attente) return false;
    if (filterProfil && c.profil !== filterProfil) return false;
    const q = search.toLowerCase();
    return !q || `${c.nom} ${c.prenom} ${c.email} ${c.code_candidat ?? ""} ${c.commentaire ?? ""}`.toLowerCase().includes(q);
  });

  // Filtre par profil candidat (ESH n'inscrit pas en HGG et vice-versa)
  const _PROFIL_EXCL: Record<string, string> = { HGG: "ESH", ESH: "HGG" };
  const _classeUp = (fiche?.classe || "").toUpperCase();
  const _profilUp = (fiche?.profil || "").toUpperCase() ||
    (_classeUp.includes("ESH") ? "ESH" : _classeUp.includes("HGG") ? "HGG" : "");
  const _matiereExclue = _PROFIL_EXCL[_profilUp];

  const tripletsProfil = triplets.filter(t =>
    !(_matiereExclue && t.epreuves.some(e => e.matiere.toUpperCase() === _matiereExclue))
  );

  // Une date ou une heure qui n'est plus proposée (autre candidat, créneau pris) ne filtre plus
  const datesCreneaux = [...new Set(tripletsProfil.map(t => t.date))].sort();
  const dateCreneau = datesCreneaux.includes(filterDateCreneau) ? filterDateCreneau : "";
  const heuresCreneaux = [...new Set(
    tripletsProfil.filter(t => !dateCreneau || t.date === dateCreneau).map(t => t.heure_debut)
  )].sort();
  const heureCreneau = heuresCreneaux.includes(filterHeureCreneau) ? filterHeureCreneau : "";

  // Group triplets by date
  const tripletsByDate: Record<string, TripletDisponible[]> = {};
  for (const t of tripletsProfil) {
    if (dateCreneau && t.date !== dateCreneau) continue;
    if (heureCreneau && t.heure_debut !== heureCreneau) continue;
    if (!tripletsByDate[t.date]) tripletsByDate[t.date] = [];
    tripletsByDate[t.date].push(t);
  }
  const matieres = fiche?.inscription?.epreuves.map(e => e.matiere) ?? (triplets[0]?.epreuves.map(e => e.matiere) ?? []);

  return (
    <div className="flex gap-4" style={{ height: "calc(100vh - 220px)" }}>
      {/* ── Colonne gauche : liste candidats ── */}
      <div className="w-60 flex-shrink-0 flex flex-col border rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="p-2.5 border-b">
          <input
            type="text"
            placeholder="Rechercher…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-xs px-2.5 py-1.5 border rounded-lg bg-gray-50 focus:outline-none focus:ring-1 focus:ring-[#C62828]"
          />
          <select
            aria-label="Filtrer par statut"
            value={filterStatut}
            onChange={e => setFilterStatut(e.target.value as typeof filterStatut)}
            className="mt-1.5 w-full text-xs text-gray-900 px-2 py-1.5 border rounded-lg bg-gray-50 focus:outline-none focus:ring-1 focus:ring-[#C62828]"
          >
            <option value="">Tous les candidats ({liste.length})</option>
            <option value="inscrits">Inscrits ({liste.filter(c => c.is_inscrit).length})</option>
            <option value="non_inscrits">Non inscrits ({liste.filter(c => !c.is_inscrit).length})</option>
            <option value="attente">En liste d&apos;attente ({liste.filter(c => c.is_liste_attente).length})</option>
          </select>
          <div className="mt-1.5 flex gap-1">
            {(["", "HGG", "ESH"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setFilterProfil(p)}
                className={`flex-1 text-xs font-semibold px-2 py-1 rounded-lg border transition ${
                  filterProfil === p
                    ? p === "HGG" ? "bg-purple-100 text-purple-700 border-purple-300"
                      : p === "ESH" ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                      : "bg-black/10 text-gray-900 border-black/20"
                    : "bg-white text-gray-700 border-black/10 hover:bg-black/[0.03]"
                }`}
              >
                {p === "" ? "Tous" : p}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-y-auto flex-1 divide-y divide-black/5">
          {filtered.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id === selectedId ? null : c.id)}
              className={`w-full text-left px-3 py-2.5 text-xs hover:bg-black/[0.03] transition ${
                selectedId === c.id ? "bg-red-50 border-l-2 border-[#C62828]" : ""
              }`}
            >
              <div className="font-medium truncate">{c.nom} {c.prenom}</div>
              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                {c.code_candidat && <span className="font-mono text-gray-700">{c.code_candidat}</span>}
                {c.is_inscrit && <span className="bg-green-100 text-green-700 px-1 py-0 rounded text-[10px]">Inscrit</span>}
                {c.is_liste_attente && <span className="bg-amber-100 text-amber-700 px-1 py-0 rounded text-[10px]">L.A.</span>}
                {c.commentaire && <span title={c.commentaire} className="bg-sky-100 text-sky-800 px-1 py-0 rounded text-[10px]">Commentaire</span>}
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="p-4 text-xs text-gray-700 text-center">Aucun candidat</p>
          )}
        </div>
        <div className="px-3 py-2 border-t bg-black/[0.02] text-[10px] text-gray-700 flex justify-between">
          <span>{liste.filter(c => c.is_inscrit).length} inscrit(s)</span>
          <span>{liste.filter(c => c.is_liste_attente).length} en L.A.</span>
        </div>
      </div>

      {/* ── Zone principale ── */}
      {!selectedId || !fiche ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-700">
          Sélectionnez un candidat dans la liste
        </div>
      ) : (
        <div className="flex-1 flex gap-4 overflow-hidden min-w-0">
          {/* ── Fiche candidat ── */}
          <div className="w-64 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
            <div className="rounded-xl border bg-white shadow-sm p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  {fiche.civilite && <p className="text-xs text-gray-700">{fiche.civilite}</p>}
                  <h3 className="text-base font-bold leading-tight">{fiche.nom}</h3>
                  <p className="text-sm">{fiche.prenom}</p>
                </div>
                {fiche.profil && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">{fiche.profil}</span>
                )}
              </div>
              <dl className="space-y-1.5 text-xs">
                {fiche.code_candidat && (
                  <div className="flex gap-1"><dt className="text-gray-700 shrink-0">N°</dt><dd className="font-mono">{fiche.code_candidat}</dd></div>
                )}
                <div className="flex gap-1"><dt className="text-gray-700 shrink-0">Email</dt><dd className="truncate">{fiche.email}</dd></div>
                {fiche.tel_portable && (
                  <div className="flex gap-1"><dt className="text-gray-700 shrink-0">Tél.</dt><dd>{fiche.tel_portable}</dd></div>
                )}
                {fiche.handicape !== null && fiche.handicape !== undefined && (
                  <div className="flex gap-1"><dt className="text-gray-700 shrink-0">Handicap</dt><dd>{fiche.handicape ? "Oui" : "Non"}</dd></div>
                )}
                {fiche.classe && (
                  <div className="flex gap-1"><dt className="text-gray-700 shrink-0">Classe</dt><dd>{fiche.classe}</dd></div>
                )}
                {fiche.etablissement && (
                  <div className="flex gap-1"><dt className="text-gray-700 shrink-0">Établ.</dt><dd className="truncate">{fiche.etablissement}</dd></div>
                )}
                {fiche.qualite && (
                  <div className="flex gap-1"><dt className="text-gray-700 shrink-0">Qualité</dt><dd>{fiche.qualite}</dd></div>
                )}
                {fiche.numero_ine && (
                  <div className="flex gap-1"><dt className="text-gray-700 shrink-0">INE</dt><dd className="font-mono">{fiche.numero_ine}</dd></div>
                )}
              </dl>
            </div>

            <div className="rounded-xl border bg-white shadow-sm p-4">
              <CommentaireCandidat key={fiche.id} candidatId={fiche.id} initial={fiche.commentaire ?? null} onSaved={loadListe} />
            </div>

            {/* Liste d'attente */}
            {fiche.liste_attente.length > 0 && (
              <div className="rounded-xl border bg-white shadow-sm p-4">
                <p className="text-xs font-semibold text-gray-800 mb-2">Liste d&apos;attente</p>
                <div className="flex flex-wrap gap-1">
                  {fiche.liste_attente.map(la => (
                    <span key={la.date} className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded">
                      {new Date(la.date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Panneau inscription ── */}
          <div className="flex-1 overflow-y-auto min-w-0 space-y-4">
            {/* Inscription courante */}
            {fiche.inscription && (
              <div className="rounded-xl border bg-white shadow-sm p-5">
                <p className="text-sm font-semibold text-green-700 mb-3">✓ Inscrit(e) aux créneaux suivants</p>
                <div className="rounded-lg border overflow-hidden text-sm mb-4">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="px-3 py-2 text-xs font-semibold text-gray-700">Jour</th>
                        {fiche.inscription.epreuves.map(e => (
                          <th key={e.id} className="px-3 py-2 text-xs font-semibold text-gray-700">{e.matiere}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-3 py-2 font-medium capitalize">{fmt_date(fiche.inscription.date)}</td>
                        {fiche.inscription.epreuves.map(e => (
                          <td key={e.id} className="px-3 py-2">{e.heure_debut}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => doAction("desinscrire", `Désinscrire ${fiche.nom} ${fiche.prenom} ?`, "Candidat désinscrit")}
                    disabled={loadingAction}
                    className="text-xs px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition disabled:opacity-50"
                  >
                    Désinscrire
                  </button>
                  <button
                    onClick={() => doAction("desinscrire-prereserver", `Désinscrire et préréserver les créneaux ?`, "Désinscrit et créneaux préréservés")}
                    disabled={loadingAction}
                    className="text-xs px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition disabled:opacity-50"
                  >
                    Désinscrire + Préréserver
                  </button>
                  <button
                    onClick={() => doAction("casser-triplet", `Casser le triplet de ${fiche.nom} ${fiche.prenom} ? Les 3 créneaux seront libérés individuellement.`, "Triplet cassé")}
                    disabled={loadingAction}
                    className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
                  >
                    Casser le triplet
                  </button>
                </div>
              </div>
            )}

            {/* Triplets disponibles */}
            <div className="rounded-xl border bg-white shadow-sm p-5">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
                <p className="text-sm font-semibold">Créneaux disponibles à l&apos;inscription</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    aria-label="Filtrer les créneaux par date"
                    value={dateCreneau}
                    onChange={e => setFilterDateCreneau(e.target.value)}
                    className="text-xs text-gray-900 px-2 py-1.5 border rounded-lg bg-gray-50 focus:outline-none focus:ring-1 focus:ring-[#C62828]"
                  >
                    <option value="">Toutes les dates</option>
                    {datesCreneaux.map(d => (
                      <option key={d} value={d}>{fmt_date(d)}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Filtrer les créneaux par heure"
                    value={heureCreneau}
                    onChange={e => setFilterHeureCreneau(e.target.value)}
                    className="text-xs text-gray-900 px-2 py-1.5 border rounded-lg bg-gray-50 focus:outline-none focus:ring-1 focus:ring-[#C62828]"
                  >
                    <option value="">Toutes les heures</option>
                    {heuresCreneaux.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>
              {Object.keys(tripletsByDate).length === 0 ? (
                <p className="text-sm text-gray-700">Aucun créneau disponible</p>
              ) : (
                <div className="space-y-5">
                  {Object.entries(tripletsByDate).map(([date, trips]) => {
                    const allMatieres = [...new Set(trips.flatMap(t => t.epreuves.map(e => e.matiere)))].sort();
                    return (
                      <div key={date}>
                        <p className="text-xs font-semibold text-gray-800 mb-2 capitalize">{fmt_date(date)}</p>
                        <div className="rounded-lg border overflow-hidden">
                          <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-50 text-left">
                                <th className="px-3 py-2 text-gray-700 font-semibold">Heure</th>
                                {allMatieres.map(m => (
                                  <th key={m} className="px-3 py-2 text-gray-700 font-semibold">{m}</th>
                                ))}
                                <th className="px-3 py-2"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {trips.map((t, idx) => (
                                <tr
                                  key={idx}
                                  className={`border-t border-black/5 ${t.type_slot === "PRERESERVEE" ? "bg-amber-50/60" : ""}`}
                                >
                                  <td className="px-3 py-2 font-medium">{t.heure_debut}</td>
                                  {allMatieres.map(mat => {
                                    const ep = t.epreuves.find(e => e.matiere === mat);
                                    return <td key={mat} className="px-3 py-2">{ep?.heure_debut ?? '–'}</td>;
                                  })}
                                  <td className="px-3 py-2 text-right whitespace-nowrap">
                                    <BadgeNonPublie manques={t.manques_publication} planningId={planningId} date={t.date} />
                                    {t.type_slot === "PRERESERVEE" && (
                                      <span className="mr-2 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                        Préréservé
                                      </span>
                                    )}
                                    <button
                                      onClick={() => doInscrire(t)}
                                      disabled={loadingAction}
                                      className="text-[10px] px-2.5 py-1 rounded-lg text-white transition disabled:opacity-50 bg-[#C62828] hover:bg-[#B71C1C]"
                                    >
                                      Inscrire
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
