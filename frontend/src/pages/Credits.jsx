import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { PLAN_CONTENT, formatEuros } from "../lib/planContent.js";
import {
  CreditCard, ArrowRight, Package, Clock, CheckCircle2, XCircle, Music, TrendingUp
} from "lucide-react";

function CreditGauge({ current, total }) {
  const pct = total > 0 ? Math.min((current / total) * 100, 100) : 0;
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative w-44 h-44 mx-auto">
      <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
        <circle cx="80" cy="80" r={radius} fill="none" stroke="#e5e0d8" strokeWidth="12" />
        <circle
          cx="80" cy="80" r={radius} fill="none"
          stroke="#0A3832" strokeWidth="12" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-display font-bold text-emerald">{current}</span>
        <span className="text-xs text-muted">crédit{current !== 1 ? "s" : ""} restant{current !== 1 ? "s" : ""}</span>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-white border border-line rounded-xl p-4 space-y-1">
      <div className="flex items-center gap-2 text-muted text-xs font-semibold">
        <Icon size={14} /> {label}
      </div>
      <div className="text-xl font-display font-bold">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

export default function Credits() {
  const { profile, refreshProfile } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    refreshProfile();
    loadOrders();
  }, []);

  async function loadOrders() {
    const { data } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setOrders(data ?? []);
    setLoading(false);
  }

  const credits = profile?.credits ?? 0;
  const paidOrders = orders.filter(o => o.status === "paid");
  const totalSpent = paidOrders.reduce((sum, o) => sum + (o.amount_cents ?? 0), 0);
  const totalCreditsEver = paidOrders.reduce((sum, o) => sum + (o.songs_granted ?? 0), 0);
  const totalUsed = totalCreditsEver - credits;

  const statusConfig = {
    paid: { label: "Payé", Icon: CheckCircle2, color: "text-emerald" },
    pending: { label: "En attente", Icon: Clock, color: "text-safran" },
    failed: { label: "Échoué", Icon: XCircle, color: "text-henne" },
    refunded: { label: "Remboursé", Icon: XCircle, color: "text-muted" },
  };

  return (
    <div className="max-w-[900px] mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">Mes crédits</h1>
          <p className="text-muted text-sm">Solde, achats et historique</p>
        </div>
        <Link
          to="/tarifs"
          className="inline-flex items-center gap-2 bg-henne hover:bg-henne-light text-white font-bold px-6 py-3 rounded-xl shadow-md transition-all text-sm cursor-pointer"
        >
          Acheter des crédits <ArrowRight size={16} />
        </Link>
      </div>

      {/* Jauge + stats */}
      <div className="bg-white border border-line rounded-2xl p-6 sm:p-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
          <div className="sm:col-span-1">
            <CreditGauge current={credits} total={Math.max(totalCreditsEver, credits, 1)} />
          </div>
          <div className="sm:col-span-2 grid grid-cols-2 gap-4">
            <StatCard icon={Package} label="Total acheté" value={totalCreditsEver} sub={`${paidOrders.length} commande${paidOrders.length !== 1 ? "s" : ""}`} />
            <StatCard icon={Music} label="Utilisés" value={Math.max(totalUsed, 0)} sub="chansons créées" />
            <StatCard icon={CreditCard} label="Total dépensé" value={formatEuros(totalSpent)} />
            <StatCard icon={TrendingUp} label="Crédits restants" value={credits} sub="sans expiration" />
          </div>
        </div>
      </div>

      {/* Historique des commandes */}
      <div className="bg-white border border-line rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-line">
          <h2 className="font-display font-bold text-lg">Historique des achats</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-muted text-sm">Chargement...</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-muted text-sm">Aucun achat pour le moment.</p>
            <Link to="/tarifs" className="text-emerald font-bold text-sm hover:underline">
              Voir les offres →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cream/50 text-xs text-muted font-semibold uppercase tracking-wider">
                  <th className="text-left px-6 py-3">Date</th>
                  <th className="text-left px-6 py-3">Pack</th>
                  <th className="text-center px-6 py-3">Crédits</th>
                  <th className="text-right px-6 py-3">Montant</th>
                  <th className="text-center px-6 py-3">Paiement</th>
                  <th className="text-center px-6 py-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/50">
                {orders.map(order => {
                  const st = statusConfig[order.status] || statusConfig.pending;
                  const packInfo = PLAN_CONTENT[order.pack_id];
                  return (
                    <tr key={order.id} className="hover:bg-cream/30 transition-colors">
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        {new Date(order.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-6 py-3.5 font-semibold">
                        {packInfo?.name || order.pack_id || "—"}
                      </td>
                      <td className="px-6 py-3.5 text-center font-bold text-emerald">
                        +{order.songs_granted ?? 0}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        {order.amount_cents ? formatEuros(order.amount_cents) : "—"}
                      </td>
                      <td className="px-6 py-3.5 text-center capitalize text-muted">
                        {order.provider || "—"}
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${st.color}`}>
                          <st.Icon size={12} /> {st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
