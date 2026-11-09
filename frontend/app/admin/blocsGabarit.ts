// Corps d'un PUT journee-types/blocs/{id} à partir d'un bloc tel que renvoyé par le serveur.
// Le serveur remplace TOUS les champs (un champ absent repart à sa valeur par défaut : nombre
// de créneaux à N², bonus à 0, durées par matière et échanges de triplets effacés) : on part
// donc du bloc complet et on n'applique que ce que l'utilisateur a modifié.

type ConfigMatiere = { nom: string; duree_minutes: number; preparation_minutes: number; salles?: number | null };

export type BlocServeur = {
  ordre: number;
  type_bloc: string;
  heure_debut: string;
  heure_fin: string;
  matieres: string[];
  matieres_config?: ConfigMatiere[] | null;
  duree_minutes: number | null;
  pause_minutes: number | null;
  preparation_minutes: number | null;
  salles_par_matiere: number;
  nb_slots: number | null;
  bonus_slots?: number;
  type_demi_journee?: string | null;
  custom_matrix?: number[][] | null;
};

export type ModifsBloc = Partial<Pick<BlocServeur,
  "ordre" | "heure_debut" | "heure_fin" | "matieres" | "duree_minutes" | "pause_minutes" |
  "preparation_minutes" | "salles_par_matiere" | "nb_slots">>;

const hm = (t: string | null | undefined) => (t ?? "").slice(0, 5);

export function corpsBlocModifie(bloc: BlocServeur, m: ModifsBloc) {
  const v = <K extends keyof ModifsBloc>(k: K) => (m[k] !== undefined ? m[k] : bloc[k]) as BlocServeur[K];
  const matieres = v("matieres") ?? [];
  const duree = v("duree_minutes");
  const prep = v("preparation_minutes");
  const dureeChangee = duree !== bloc.duree_minutes;
  const prepChangee = prep !== bloc.preparation_minutes;

  // Durées propres à chaque matière : gardées, sauf si la durée (ou la préparation) du bloc a
  // été modifiée, qui s'applique alors à toutes les matières. Une matière ajoutée prend celles
  // du bloc.
  let matieres_config: ConfigMatiere[] | null = null;
  if (bloc.matieres_config?.length && bloc.type_bloc === "GENERATION") {
    const liste = matieres.map((nom) => {
      const c = bloc.matieres_config!.find((x) => x.nom === nom);
      return {
        nom,
        duree_minutes: (dureeChangee || !c ? duree : c.duree_minutes) as number,
        preparation_minutes: (prepChangee || !c ? prep : c.preparation_minutes) as number,
        ...(c?.salles != null ? { salles: c.salles } : {}),
      };
    });
    matieres_config = liste.every((c) => c.duree_minutes != null && c.preparation_minutes != null) ? liste : null;
  }

  // Les échanges de triplets ne valent que pour la grille d'origine : gardés tant que les
  // matières, horaires, durées et nombre de créneaux sont inchangés.
  const memeGrille =
    matieres.join("|") === bloc.matieres.join("|") &&
    hm(v("heure_debut")) === hm(bloc.heure_debut) &&
    hm(v("heure_fin")) === hm(bloc.heure_fin) &&
    !dureeChangee && !prepChangee &&
    v("pause_minutes") === bloc.pause_minutes &&
    v("nb_slots") === bloc.nb_slots;

  return {
    ordre: v("ordre"),
    heure_debut: hm(v("heure_debut")),
    heure_fin: hm(v("heure_fin")),
    matieres,
    matieres_config,
    duree_minutes: duree,
    pause_minutes: v("pause_minutes"),
    preparation_minutes: prep,
    salles_par_matiere: v("salles_par_matiere") ?? 1,
    nb_slots: v("nb_slots"),
    bonus_slots: bloc.bonus_slots ?? 0,
    type_demi_journee: bloc.type_demi_journee ?? null,
    custom_matrix: memeGrille ? bloc.custom_matrix ?? null : null,
  };
}
