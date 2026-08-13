import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { formatEuros } from "../lib/planContent.js";
import {
  Users, Music, CreditCard, TrendingUp, AlertTriangle,
  Clock, CheckCircle2, XCircle, ShieldAlert, Loader2
} from "lucide-react";

const ADMIN_EMAILS = ["abouamhster@gmail.com"];

function StatCard({ icon: Icon, label, value, sub, color = "text-emerald" }) {
  return (
    <div className="bg-white border border-line rounded-xl p-5 space-y-1">
      <div className="flex items-center gap-2 text-muted text-xs font-semibold">
        <Icon size={14} /> {label}
      </div>
      <div className={`text-2xl font-display font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("orders");

  const isAdmin = ADMIN_EMAILS.includes(user?.email ?? "");

  useEffect(() => {
    if (!isAdmin) return;
    loadStats();
  }, [isAdmin]);

  async function loadStats() {
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase.functions.invoke("admin-stats");
    if (err || data?.error) {
      setError(data?.error || err?.message || "Erreur");
      setLoading(false);
      return;
    }
    setStats(data);
    setLoading(false);
  }

  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-4">
        <ShieldAlert size={40} className="text-henne" />
        <h1 className="font-display text-xl font-bold">Accès réservé</h1>
        <p className="text-muted text-sm">Cette page est réservée aux administrateurs.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 size={28} className="text-emerald animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-4">
        <AlertTriangle size={32} className="text-henne" />
        <p className="text-sm text-muted">{error}</p>
        <button onClick={loadStats} className="text-emerald text-sm font-bold hover:underline">Réessayer</button>
      </div>
    );
  }

  const tabs = [
    { id: "orders", label: "Commandes" },
    { id: "users", label: "Utilisateurs" },
    { id: "songs", label: "Chansons" },
    { id: "errors", label: `Erreurs (${stats.errorSongs.length})` },
  ];

  const statusStyle = {
    paid: { label: "Payé", Icon: CheckCircle2, color: "text-emerald" },
    pending: { label: "En attente", Icon: Clock, color: "text-safran" },
    failed: { label: "Échoué", Icon: XCircle, color: "text-henne" },
    refunded: { label: "Remboursé", Icon: XCircle, color: "text-muted" },
  };

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">Administration</h1>
          <p className="text-muted text-sm">Vue d'ensemble de Farha</p>
        </div>
        <button
          onClick={loadStats}
          className="text-xs font-bold text-emerald hover:underline"
        >
          Rafraîchir
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Utilisateurs" value={stats.totalUsers} />
        <StatCard icon={Music} label="Chansons" value={stats.totalSongs} />
        <StatCard icon={CreditCard} label="Revenus" value={formatEuros(stats.totalRevenue)} color="text-emerald" sub={`${stats.paidOrders} commande${stats.paidOrders !== 1 ? "s" : ""} payée${stats.paidOrders !== 1 ? "s" : ""}`} />
        <StatCard icon={TrendingUp} label="Crédits vendus" value={stats.totalCreditsGranted} sub={`${stats.pendingOrders} en attente · ${stats.failedOrders} échouée${stats.failedOrders !== 1 ? "s" : ""}`} />
      </div>

      {/* Provider breakdown */}
      {Object.keys(stats.providerBreakdown).length > 0 && (
        <div className="flex flex-wrap gap-3">
          {Object.entries(stats.providerBreakdown).map(([provider, cents]) => (
            <div key={provider} className="bg-white border border-line rounded-lg px-4 py-2 text-sm">
              <span className="capitalize font-semibold">{provider}</span>
              <span className="text-muted ml-2">{formatEuros(cents)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border border-line rounded-2xl overflow-hidden">
        <div className="flex border-b border-line overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-3 text-sm font-semibold whitespace-nowrap transition-colors ${
                tab === t.id ? "text-emerald border-b-2 border-emerald" : "text-muted hover:text-emerald"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          {tab === "orders" && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cream/50 text-xs text-muted font-semibold uppercase tracking-wider">
                  <th className="text-left px-5 py-3">Date</th>
                  <th className="text-left px-5 py-3">Pack</th>
                  <th className="text-center px-5 py-3">Crédits</th>
                  <th className="text-right px-5 py-3">Montant</th>
                  <th className="text-center px-5 py-3">Paiement</th>
                  <th className="text-center px-5 py-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/50">
                {stats.recentOrders.map(order => {
                  const st = statusStyle[order.status] || statusStyle.pending;
                  return (
                    <tr key={order.id} className="hover:bg-cream/30 transition-colors">
                      <td className="px-5 py-3 whitespace-nowrap">
                        {new Date(order.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-5 py-3 font-semibold">{order.pack_id || "—"}</td>
                      <td className="px-5 py-3 text-center font-bold text-emerald">+{order.songs_granted ?? 0}</td>
                      <td className="px-5 py-3 text-right">{order.amount_cents ? formatEuros(order.amount_cents) : "—"}</td>
                      <td className="px-5 py-3 text-center capitalize text-muted">{order.provider || "—"}</td>
                      <td className="px-5 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${st.color}`}>
                          <st.Icon size={12} /> {st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {tab === "users" && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cream/50 text-xs text-muted font-semibold uppercase tracking-wider">
                  <th className="text-left px-5 py-3">Nom</th>
                  <th className="text-center px-5 py-3">Crédits</th>
                  <th className="text-left px-5 py-3">Inscrit le</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/50">
                {stats.recentUsers.map(u => (
                  <tr key={u.id} className="hover:bg-cream/30 transition-colors">
                    <td className="px-5 py-3 flex items-center gap-2.5">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} className="w-7 h-7 rounded-full object-cover" alt="" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-emerald/10 text-emerald flex items-center justify-center text-[0.6rem] font-bold">
                          {(u.full_name ?? "U")[0].toUpperCase()}
                        </div>
                      )}
                      <span className="font-semibold">{u.full_name || "—"}</span>
                    </td>
                    <td className="px-5 py-3 text-center font-bold">{u.credits}</td>
                    <td className="px-5 py-3 text-muted">
                      {new Date(u.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "songs" && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cream/50 text-xs text-muted font-semibold uppercase tracking-wider">
                  <th className="text-left px-5 py-3">Destinataire</th>
                  <th className="text-left px-5 py-3">Occasion</th>
                  <th className="text-center px-5 py-3">Style</th>
                  <th className="text-center px-5 py-3">Statut</th>
                  <th className="text-left px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/50">
                {stats.recentSongs.map(s => (
                  <tr key={s.id} className="hover:bg-cream/30 transition-colors">
                    <td className="px-5 py-3 font-semibold">{s.recipient_name || "—"}</td>
                    <td className="px-5 py-3 text-muted">{s.occasion || "—"}</td>
                    <td className="px-5 py-3 text-center capitalize">{s.music_style}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        s.status === "completed" ? "bg-emerald/10 text-emerald" :
                        s.status === "failed" ? "bg-henne/10 text-henne" :
                        "bg-safran/10 text-safran"
                      }`}>{s.status}</span>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-muted">
                      {new Date(s.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "errors" && (
            stats.errorSongs.length === 0 ? (
              <div className="p-8 text-center text-muted text-sm">Aucune chanson en erreur.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-cream/50 text-xs text-muted font-semibold uppercase tracking-wider">
                    <th className="text-left px-5 py-3">Destinataire</th>
                    <th className="text-left px-5 py-3">Raison</th>
                    <th className="text-left px-5 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/50">
                  {stats.errorSongs.map(s => (
                    <tr key={s.id} className="hover:bg-cream/30 transition-colors">
                      <td className="px-5 py-3 font-semibold">{s.recipient_name || "—"}</td>
                      <td className="px-5 py-3 text-henne text-xs max-w-xs truncate">{s.failure_reason || "—"}</td>
                      <td className="px-5 py-3 whitespace-nowrap text-muted">
                        {new Date(s.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>
    </div>
  );
}
