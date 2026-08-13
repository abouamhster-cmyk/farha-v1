import { Component } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary:", error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-cream px-6">
          <div className="text-center max-w-md space-y-4">
            <div className="w-14 h-14 rounded-full bg-henne/10 flex items-center justify-center mx-auto">
              <AlertTriangle size={28} className="text-henne" />
            </div>
            <h1 className="font-display text-2xl font-bold">Quelque chose a planté</h1>
            <p className="text-muted text-sm">Rechargez la page. Si le problème persiste, contactez-nous.</p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 bg-emerald text-white font-bold px-6 py-3 rounded-xl cursor-pointer"
            >
              <RotateCcw size={16} /> Recharger
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
