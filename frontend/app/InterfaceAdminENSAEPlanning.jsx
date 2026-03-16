import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  CalendarDays,
  Users,
  UserCog,
  ClipboardCheck,
  Database,
  Upload,
  Download,
  Menu,
  X,
} from "lucide-react";

const ENSAE_RED = "#C62828";

const rowsSeed = [
  { time: "09:00", subject: "Math", candidate: "Dupont", examiner: "Martin", room: "A101" },
  { time: "10:00", subject: "Anglais", candidate: "—", examiner: "Martin", room: "A102" },
  { time: "11:00", subject: "Math", candidate: "Bernard B", examiner: "Martin", room: "A103" },
  { time: "12:00", subject: "Anglais", candidate: "Martin C", examiner: "Martin", room: "A104" },
  { time: "13:00", subject: "HGG", candidate: "Bernard B", examiner: "Martin", room: "A105" },
  { time: "14:00", subject: "Math", candidate: "Dupont", examiner: "Martin", room: "A106" },
  { time: "15:00", subject: "Anglais", candidate: "—", examiner: "Martin", room: "A107" },
  { time: "16:00", subject: "ESH", candidate: "Martin C", examiner: "Martin", room: "A108" },
];

const menu = [
  {
    title: "Organisation",
    items: [
      { label: "Planning", icon: CalendarDays, key: "planning" },
      { label: "Candidats", icon: Users, key: "candidats" },
      { label: "Intervenants", icon: UserCog, key: "intervenants" },
    ],
  },
  {
    title: "Évaluations",
    items: [{ label: "Notes", icon: ClipboardCheck, key: "notes" }],
  },
  {
    title: "Données",
    items: [{ label: "Imports & Exports", icon: Database, key: "imports" }],
  },
];

function classNames(...c) {
  return c.filter(Boolean).join(" ");
}

function LogoENSAE() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-full border border-white/35 grid place-items-center">
        <div className="h-6 w-6 rounded-full border border-white/50" />
      </div>
      <div className="leading-tight">
        <div className="text-white font-semibold tracking-wide">ENSAE</div>
        <div className="text-white/80 text-xs">IP Paris</div>
      </div>
    </div>
  );
}

function Sidebar({ active, onSelect }) {
  return (
    <aside
      className="h-full w-[240px] shrink-0 text-white"
      style={{ backgroundColor: ENSAE_RED }}
    >
      <div className="p-5">
        <LogoENSAE />
      </div>

      <nav className="px-3 pb-6">
        {menu.map((group) => (
          <div key={group.title} className="mb-5">
            <div className="px-3 py-2 text-xs uppercase tracking-wider text-white/70">
              {group.title}
            </div>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = active === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => onSelect(item.key)}
                    className={classNames(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition",
                      "focus:outline-none focus:ring-2 focus:ring-white/30",
                      isActive ? "bg-white/18" : "hover:bg-black/10"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="mt-2 px-3">
          <div className="h-px bg-white/15" />
        </div>

        <div className="px-3 pt-4 text-xs text-white/70">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            <span>Back-office</span>
          </div>
        </div>
      </nav>
    </aside>
  );
}

function TopTitle({ title }) {
  return (
    <div className="flex items-center justify-center gap-3">
      <button
        className="h-9 w-9 grid place-items-center rounded-lg bg-white shadow-sm border border-black/5 hover:bg-black/[0.02] transition"
        aria-label="Semaine précédente"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="text-lg md:text-xl font-semibold">{title}</div>
      <button
        className="h-9 w-9 grid place-items-center rounded-lg bg-white shadow-sm border border-black/5 hover:bg-black/[0.02] transition"
        aria-label="Semaine suivante"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function ActionPill({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-black/10"
      style={{ backgroundColor: ENSAE_RED }}
      onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(0.95)")}
      onMouseLeave={(e) => (e.currentTarget.style.filter = "brightness(1)")}
    >
      <Plus className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}

function Table({ rows }) {
  return (
    <div className="rounded-lg bg-white shadow-sm border border-black/5 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-[820px] w-full">
          <thead>
            <tr className="bg-[#F5F5F5] text-left">
              {[
                { k: "time", label: "Heure" },
                { k: "subject", label: "Matière" },
                { k: "candidate", label: "Candidat" },
                { k: "examiner", label: "Examinateur" },
                { k: "room", label: "Salle" },
              ].map((h) => (
                <th
                  key={h.k}
                  className="px-6 py-4 text-xs font-semibold tracking-wide text-black/70"
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr
                key={idx}
                className="border-t border-black/5 hover:bg-black/[0.015] transition"
              >
                <td className="px-6 py-4 text-sm text-black/85">{r.time}</td>
                <td className="px-6 py-4 text-sm text-black/85">{r.subject}</td>
                <td className="px-6 py-4 text-sm text-black/85">{r.candidate}</td>
                <td className="px-6 py-4 text-sm text-black/85">{r.examiner}</td>
                <td className="px-6 py-4 text-sm text-black/85">{r.room}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Pagination({ page, setPage, total = 4 }) {
  return (
    <div className="flex items-center justify-center gap-2 pt-5">
      <button
        className="h-9 w-9 rounded-full grid place-items-center hover:bg-black/[0.04] transition"
        aria-label="Page précédente"
        onClick={() => setPage((p) => Math.max(1, p - 1))}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {Array.from({ length: total }).map((_, i) => {
        const n = i + 1;
        const isActive = n === page;
        return (
          <button
            key={n}
            onClick={() => setPage(n)}
            className={classNames(
              "h-9 w-9 rounded-full grid place-items-center text-sm font-medium transition",
              isActive ? "text-white shadow-sm" : "text-black/60 hover:bg-black/[0.04]"
            )}
            style={isActive ? { backgroundColor: ENSAE_RED } : undefined}
            aria-current={isActive ? "page" : undefined}
          >
            {n}
          </button>
        );
      })}

      <button
        className="h-9 w-9 rounded-full grid place-items-center hover:bg-black/[0.04] transition"
        aria-label="Page suivante"
        onClick={() => setPage((p) => Math.min(total, p + 1))}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function MobileSidebar({ open, onClose, active, onSelect }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: open ? 1 : 0 }}
      className={classNames(
        "fixed inset-0 z-50 md:hidden",
        open ? "pointer-events-auto" : "pointer-events-none"
      )}
      aria-hidden={!open}
    >
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <motion.div
        initial={{ x: -280 }}
        animate={{ x: open ? 0 : -280 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        className="absolute left-0 top-0 h-full"
      >
        <div className="h-full">
          <Sidebar
            active={active}
            onSelect={(k) => {
              onSelect(k);
              onClose();
            }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function InterfaceAdminENSAEPlanning() {
  const [active, setActive] = useState("planning");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rowsSeed;
    return rowsSeed.filter((r) =>
      [r.time, r.subject, r.candidate, r.examiner, r.room]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [query]);

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-black">
      <MobileSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        active={active}
        onSelect={setActive}
      />

      <div className="flex min-h-screen">
        <div className="hidden md:block">
          <Sidebar active={active} onSelect={setActive} />
        </div>

        <main className="flex-1">
          {/* Top bar (mobile) */}
          <div className="md:hidden sticky top-0 z-10 bg-[#F5F5F5]/90 backdrop-blur border-b border-black/5">
            <div className="px-4 py-3 flex items-center justify-between">
              <button
                onClick={() => setSidebarOpen(true)}
                className="h-10 w-10 rounded-lg bg-white shadow-sm border border-black/5 grid place-items-center"
                aria-label="Ouvrir le menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="text-sm font-semibold">ENSAE — Admin</div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="h-10 w-10 rounded-lg bg-white shadow-sm border border-black/5 grid place-items-center opacity-0"
                aria-hidden
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
            <TopTitle title="Lundi 17 Juin" />

            <div className="mt-6 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/45" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search…"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white shadow-sm border border-black/5 focus:outline-none focus:ring-2 focus:ring-black/10"
                />
              </div>

              <div className="flex flex-wrap gap-2 justify-start lg:justify-end">
                <ActionPill label="Nouvelle journée type" onClick={() => alert("Action: Nouvelle journée type")}/>
                <ActionPill label="Ajouter un créneau" onClick={() => alert("Action: Ajouter un créneau")}/>
                <ActionPill label="Modifier un créneau" onClick={() => alert("Action: Modifier un créneau")}/>
              </div>
            </div>

            <div className="mt-6">
              <Table rows={rows} />
              <Pagination page={page} setPage={setPage} total={4} />
            </div>

            <div className="mt-8 rounded-lg border border-black/5 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold">Hint (MVP)</div>
              <div className="mt-1 text-sm text-black/65">
                Cette maquette reproduit la structure : sidebar fixe (240px), titre centré avec navigation,
                barre d’actions (search + 3 boutons), tableau responsive avec scroll horizontal et pagination.
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-black/60">
                <span className="inline-flex items-center gap-1 rounded-full bg-[#F5F5F5] px-3 py-1">
                  <Upload className="h-3.5 w-3.5" /> Import
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#F5F5F5] px-3 py-1">
                  <Download className="h-3.5 w-3.5" /> Export
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#F5F5F5] px-3 py-1">
                  <LayoutGrid className="h-3.5 w-3.5" /> Dashboard
                </span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
