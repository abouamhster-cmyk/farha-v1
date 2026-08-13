import { useEffect, useState } from "react";
import { callFunction } from "../lib/supabaseClient.js";
import {
  Users, Music, CreditCard, TrendingUp, TrendingDown, Share2,
  Loader2, AlertTriangle, Lightbulb, BarChart3, DollarSign,
  UserPlus, CheckCircle2, Clock, Sparkles, Target, Megaphone,
  ShieldAlert, Zap, Heart, Package, RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react";

const PRIORITY_STYLES = {
  critical: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", badge: "bg-red-100 text-red-700", label: "Critique" },
  high:     { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", badge: "bg-orange-100 text-orange-700", label: "Important" },
  medium:   { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", badge: "bg-blue-100 text-blue-700", label: "Moyen" },
  low:      { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", badge: "bg-green-100 text-green-700", label: "Info" },
};

const TYPE_ICONS = {
  growth: TrendingUp, revenue: DollarSign, conversion: Target, quality: AlertTriangle,
  engagement: Heart, product: Music, viral: Share2, pricing: Package,
  payment: ShieldAlert, ads: Megaphone,
};

function fmt(cents) {
  return (cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function StatCard({ icon: Icon, label, value, sub, color = "emerald" }) {
  const colors = {
    emerald: "bg-emerald/10 text-emerald",
    safran: "bg-safran/10 text-safran",
    henne: "bg-henne/10 text-henne",
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-purple-50 text-purple-600",
  };
  return (
    <div className="bg-white border border-line rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
          <Icon size={20} />
        </div>
      </div>
      <div className="text-2xl font-bold text-ink">{value}</div>
      <div className="text-sm text-muted mt-0.5">{label}</div>
      {sub && <div className="text-xs text-muted/70 mt-1">{sub}</div>}
    </div>
  );
}

function MiniBar({ data, labelKey = "name", valueKey = "count", color = "#0A3832" }) {
  if (!data?.length) return <p className="text-sm text-muted">Aucune donnée</p>;
  const max = Math.max(...data.map(d => d[valueKey]));
  return (
    <div className="space-y-2">
      {data.slice(0, 8).map(d => (
        <div key={d[labelKey]} className="flex items-center gap-3">
          <span className="text-xs text-muted w-20 truncate capitalize">{d[labelKey]}</span>
          <div className="flex-1 h-5 bg-cream rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(d[valueKey] / max) * 100}%`, backgroundColor: color }}
            />
          </div>
          <span className="text-xs font-bold text-ink w-8 text-right">{d[valueKey]}</span>
        </div>
      ))}
    </div>
  );
}

function SparkLine({ data, valueKey = "count", height = 60 }) {
  if (!data?.length) return null;
  const values = data.map(d => d[valueKey] ?? d.amount ?? 0);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const w = 300;
  const points = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * w;
    const y = height - ((v - min) / range) * (height - 8) - 4;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke="#0A3832"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sugLoading, setSugLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedSugs, setExpandedSugs] = useState({});
  const [activeTab, setActiveTab] = useState("overview");

  const load = () => {
    setLoading(true);
    setError(null);
    callFunction("admin-stats", {})
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  const loadSuggestions = () => {
    setSugLoading(true);
    callFunction("admin-ai-suggestions", {})
      .then(setSuggestions)
      .catch(() => {})
      .finally(() => setSugLoading(false));
  };

  useEffect(() => { load(); loadSuggestions(); }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="text-safran animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4 mt-20">
        <AlertTriangle size={40} className="text-henne mx-auto" />
        <h2 className="font-display text-xl font-bold text-ink">Erreur d'accès</h2>
        <p className="text-muted text-sm">{error}</p>
        <button onClick={load} className="bg-henne hover:bg-henne-light text-white font-bold px-6 py-2.5 rounded-xl">
          Réessayer
        </button>
      </div>
    );
  }

  const o = stats?.overview ?? {};
  const tabs = [
    { id: "overview", label: "Vue d'ensemble", Icon: BarChart3 },
    { id: "suggestions", label: "Suggestions IA", Icon: Sparkles },
    { id: "users", label: "Utilisateurs", Icon: Users },
    { id: "orders", label: "Commandes", Icon: CreditCard },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink flex items-center gap-2.5">
            <ShieldAlert size={24} className="text-henne" /> Administration
          </h1>
          <p className="text-muted text-sm mt-1">Vue d'ensemble de Farha Studio</p>
        </div>
        <button
          onClick={() => { load(); loadSuggestions(); }}
          className="flex items-center gap-2 bg-emerald hover:bg-emerald-light text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors cursor-pointer"
        >
          <RefreshCw size={14} /> Actualiser
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-line rounded-xl p-1 mb-6 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === t.id ? "bg-emerald text-white" : "text-muted hover:text-ink hover:bg-cream"
            }`}
          >
            <t.Icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6 animate-fadeIn">
          {/* KPI Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Users} label="Utilisateurs" value={o.totalUsers} sub={`+${o.newUsers30d} ce mois`} color="emerald" />
            <StatCard icon={DollarSign} label="Revenus total" value={fmt(o.totalRevenueCents)} sub={`${fmt(o.revenue30dCents)} ce mois`} color="safran" />
            <StatCard icon={Music} label="Chansons créées" value={o.totalSongs} sub={`${o.completedSongs} complétées`} color="blue" />
            <StatCard icon={Target} label="Taux de conversion" value={`${o.conversionRate}%`} sub={`${o.paidOrders} achats / ${o.totalUsers} inscrits`} color="purple" />
          </div>

          {/* Secondary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white border border-line rounded-xl p-4 text-center">
              <div className="text-lg font-bold text-ink">{o.newUsersToday}</div>
              <div className="text-xs text-muted">Inscrits aujourd'hui</div>
            </div>
            <div className="bg-white border border-line rounded-xl p-4 text-center">
              <div className="text-lg font-bold text-ink">{o.newUsers7d}</div>
              <div className="text-xs text-muted">Inscrits (7j)</div>
            </div>
            <div className="bg-white border border-line rounded-xl p-4 text-center">
              <div className="text-lg font-bold text-ink">{fmt(o.revenueTodayCents)}</div>
              <div className="text-xs text-muted">Revenus aujourd'hui</div>
            </div>
            <div className="bg-white border border-line rounded-xl p-4 text-center">
              <div className="text-lg font-bold text-ink">{fmt(o.revenue7dCents)}</div>
              <div className="text-xs text-muted">Revenus (7j)</div>
            </div>
            <div className="bg-white border border-line rounded-xl p-4 text-center">
              <div className="text-lg font-bold text-ink">{o.totalShares}</div>
              <div className="text-xs text-muted">Partages</div>
            </div>
            <div className="bg-white border border-line rounded-xl p-4 text-center">
              <div className="text-lg font-bold text-ink">{fmt(o.avgOrderValueCents)}</div>
              <div className="text-xs text-muted">Panier moyen</div>
            </div>
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
              <h3 className="font-display font-bold text-ink mb-1 flex items-center gap-2">
                <UserPlus size={16} className="text-emerald" /> Inscriptions (30 jours)
              </h3>
              <p className="text-xs text-muted mb-4">Évolution quotidienne des nouveaux inscrits</p>
              <SparkLine data={stats?.trends?.dailySignups} />
              {stats?.trends?.dailySignups?.length > 0 && (
                <div className="flex justify-between text-[0.65rem] text-muted mt-2">
                  <span>{stats.trends.dailySignups[0]?.date}</span>
                  <span>{stats.trends.dailySignups[stats.trends.dailySignups.length - 1]?.date}</span>
                </div>
              )}
            </div>
            <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
              <h3 className="font-display font-bold text-ink mb-1 flex items-center gap-2">
                <DollarSign size={16} className="text-safran" /> Revenus (30 jours)
              </h3>
              <p className="text-xs text-muted mb-4">Évolution quotidienne des revenus en centimes</p>
              <SparkLine data={stats?.trends?.dailyRevenue} valueKey="amount" />
              {stats?.trends?.dailyRevenue?.length > 0 && (
                <div className="flex justify-between text-[0.65rem] text-muted mt-2">
                  <span>{stats.trends.dailyRevenue[0]?.date}</span>
                  <span>{stats.trends.dailyRevenue[stats.trends.dailyRevenue.length - 1]?.date}</span>
                </div>
              )}
            </div>
          </div>

          {/* Distributions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
              <h3 className="font-display font-bold text-ink mb-4 flex items-center gap-2">
                <Music size={16} className="text-safran" /> Styles musicaux
              </h3>
              <MiniBar data={stats?.distributions?.styles} color="#E89528" />
            </div>
            <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
              <h3 className="font-display font-bold text-ink mb-4 flex items-center gap-2">
                <BarChart3 size={16} className="text-emerald" /> Dialectes
              </h3>
              <MiniBar data={stats?.distributions?.dialects} color="#0A3832" />
            </div>
            <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
              <h3 className="font-display font-bold text-ink mb-4 flex items-center gap-2">
                <Package size={16} className="text-henne" /> Packs vendus
              </h3>
              <MiniBar data={stats?.distributions?.packs} color="#B83A28" />
            </div>
          </div>
        </div>
      )}

      {/* Suggestions IA Tab */}
      {activeTab === "suggestions" && (
        <div className="space-y-4 animate-fadeIn">
          <div className="bg-gradient-to-r from-emerald to-emerald-light rounded-2xl p-6 text-white mb-2">
            <div className="flex items-center gap-3 mb-2">
              <Sparkles size={24} />
              <h2 className="font-display text-xl font-bold">Suggestions stratégiques</h2>
            </div>
            <p className="text-white/70 text-sm">
              Analyse automatique de vos données pour des recommandations concrètes sur la croissance, les revenus, la conversion et la stratégie pub.
            </p>
          </div>

          {sugLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={28} className="text-safran animate-spin" />
              <span className="ml-3 text-muted">Analyse en cours...</span>
            </div>
          ) : !suggestions?.suggestions?.length ? (
            <div className="text-center py-16 text-muted">
              <Lightbulb size={36} className="mx-auto mb-3 text-safran/40" />
              <p>Pas assez de données pour générer des suggestions.</p>
              <p className="text-xs mt-1">Les suggestions apparaîtront quand vous aurez plus d'utilisateurs et de transactions.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {suggestions.suggestions.map((s, i) => {
                const ps = PRIORITY_STYLES[s.priority] || PRIORITY_STYLES.medium;
                const SIcon = TYPE_ICONS[s.type] || Lightbulb;
                const expanded = expandedSugs[i];
                return (
                  <div
                    key={i}
                    className={`${ps.bg} ${ps.border} border rounded-2xl overflow-hidden transition-all`}
                  >
                    <button
                      onClick={() => setExpandedSugs(prev => ({ ...prev, [i]: !prev[i] }))}
                      className="w-full flex items-center gap-3 p-4 sm:p-5 text-left cursor-pointer"
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${ps.badge}`}>
                        <SIcon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[0.6rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${ps.badge}`}>
                            {ps.label}
                          </span>
                        </div>
                        <h3 className={`font-bold text-sm sm:text-base mt-1 ${ps.text}`}>{s.title}</h3>
                      </div>
                      {expanded ? <ChevronUp size={18} className="text-muted flex-shrink-0" /> : <ChevronDown size={18} className="text-muted flex-shrink-0" />}
                    </button>
                    {expanded && (
                      <div className="px-5 pb-5 pt-0">
                        <p className="text-sm text-ink/80 leading-relaxed whitespace-pre-line">{s.detail}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Users Tab */}
      {activeTab === "users" && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-line">
              <h3 className="font-display font-bold text-ink flex items-center gap-2">
                <Users size={18} className="text-emerald" /> Derniers inscrits
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-cream text-left text-xs text-muted uppercase tracking-wider">
                    <th className="px-5 py-3">Nom</th>
                    <th className="px-5 py-3">Crédits</th>
                    <th className="px-5 py-3">Inscrit le</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats?.recentUsers ?? []).map(u => (
                    <tr key={u.id} className="border-t border-line hover:bg-cream/50 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-ink">{u.full_name}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${u.credits > 0 ? "bg-safran/15 text-safran" : "bg-cream text-muted"}`}>
                          {u.credits}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-muted">{new Date(u.created_at).toLocaleDateString("fr-FR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!stats?.recentUsers?.length && (
                <p className="text-center text-muted py-8">Aucun utilisateur</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === "orders" && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={CreditCard} label="Total commandes" value={o.totalOrders} color="emerald" />
            <StatCard icon={CheckCircle2} label="Payées" value={o.paidOrders} color="safran" />
            <StatCard icon={DollarSign} label="Revenu total" value={fmt(o.totalRevenueCents)} color="blue" />
            <StatCard icon={Clock} label="Panier moyen" value={fmt(o.avgOrderValueCents)} color="purple" />
          </div>

          <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-line">
              <h3 className="font-display font-bold text-ink flex items-center gap-2">
                <CreditCard size={18} className="text-safran" /> Dernières commandes
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-cream text-left text-xs text-muted uppercase tracking-wider">
                    <th className="px-5 py-3">Pack</th>
                    <th className="px-5 py-3">Montant</th>
                    <th className="px-5 py-3">Statut</th>
                    <th className="px-5 py-3">Provider</th>
                    <th className="px-5 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats?.recentOrders ?? []).map(ord => {
                    const statusColors = {
                      paid: "bg-green-100 text-green-700",
                      pending: "bg-yellow-100 text-yellow-700",
                      failed: "bg-red-100 text-red-700",
                      refunded: "bg-gray-100 text-gray-600",
                    };
                    return (
                      <tr key={ord.id} className="border-t border-line hover:bg-cream/50 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-ink capitalize">{ord.pack_id}</td>
                        <td className="px-5 py-3.5">{fmt(ord.amount_cents)}</td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusColors[ord.status] || "bg-gray-100 text-gray-600"}`}>
                            {ord.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-muted capitalize">{ord.provider}</td>
                        <td className="px-5 py-3.5 text-muted">{new Date(ord.created_at).toLocaleDateString("fr-FR")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!stats?.recentOrders?.length && (
                <p className="text-center text-muted py-8">Aucune commande</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
