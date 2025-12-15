import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type RuntimeInfo = {
  webcam_detected: boolean;
  active_profile: string | null;
};

function FeatureItem({ title, description }: { title: string; description: string }) {
  return (
    <li className="feature">
      <strong>{title}</strong>
      <span>{description}</span>
    </li>
  );
}

function App() {
  const [deviceReady] = useState(false);
  const [logPath, setLogPath] = useState<string | null>(null);
  const [logError, setLogError] = useState<string | null>(null);
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);

  const fetchDiagnostics = async () => {
    setLoadingDiagnostics(true);
    setLogError(null);
    setRuntimeError(null);
    try {
      const path = await invoke<string>("log_path");
      setLogPath(path);
      const info = await invoke<RuntimeInfo>("runtime_info");
      setRuntimeInfo(info);
    } catch (err) {
      setLogError(String(err));
      setRuntimeError(String(err));
      setLogPath(null);
      setRuntimeInfo(null);
    } finally {
      setLoadingDiagnostics(false);
    }
  };

  return (
    <div className="page">
      <header>
        <h1>Photon</h1>
        <p>Scanner par webcam — Tauri + Rust + React</p>
      </header>

      <section className="status">
        <div className="badge">{deviceReady ? "Webcam OK" : "Webcam à configurer"}</div>
        <div className="badge">Apache-2.0</div>
        <div className="badge">Rust natif (imageproc, fast_image_resize, pdf-writer)</div>
      </section>

      <section>
        <h2>Fonctionnalités prévues</h2>
        <ul className="features">
          <FeatureItem title="Capture" description="Aperçu temps réel, détection auto des bords, recadrage manuel de secours." />
          <FeatureItem title="Traitement" description="Redressement, filtres lisibilité, réglage contraste/netteté, resize performant." />
          <FeatureItem title="Multi-pages" description="Ajout, ordre, suppression/retake; export PDF/PNG/JPG." />
          <FeatureItem title="Favoris" description="Dossiers + formats + nommage auto; profils de scan (texte/photo)." />
          <FeatureItem title="Local & privé" description="Traitement local uniquement, dépendances permissives." />
        </ul>
      </section>

      <section>
        <h2>Prochaines étapes</h2>
        <ol className="steps">
          <li>Brancher la webcam via Tauri, mock vidéo pour les tests.</li>
          <li>Implémenter la détection/redressement en Rust pur.</li>
          <li>Assembler un export PDF multi-page avec pdf-writer.</li>
        </ol>
      </section>

      <section className="diagnostic">
        <div className="card">
          <div className="card-header">
            <div>
              <h3>Diagnostic développeur</h3>
              <p>Chemin du log backend Tauri (niveau DEBUG).</p>
            </div>
            <button className="ghost" onClick={fetchDiagnostics} disabled={loadingDiagnostics}>
              {loadingDiagnostics ? "Lecture..." : "Actualiser les diagnostics"}
            </button>
          </div>

          <div className="card-body">
            <div className="runtime-grid">
              <div className="log-path">
                <span className="label">Log file</span>
                {logPath ? <code>{logPath}</code> : <p className="muted">Chemin non chargé.</p>}
              </div>
              <div className="runtime-block">
                <span className="label">Webcam détectée</span>
                {runtimeInfo ? (
                  <span className={`pill ${runtimeInfo.webcam_detected ? "pill-ok" : "pill-warn"}`}>
                    {runtimeInfo.webcam_detected ? "Oui" : "Non"}
                  </span>
                ) : (
                  <p className="muted">Etat non chargé.</p>
                )}
              </div>
              <div className="runtime-block">
                <span className="label">Profil actif</span>
                {runtimeInfo ? (
                  <span className="pill pill-info">{runtimeInfo.active_profile ?? "Aucun"}</span>
                ) : (
                  <p className="muted">Etat non chargé.</p>
                )}
              </div>
            </div>

            {(logError || runtimeError) && (
              <div className="log-error">Erreur: {logError || runtimeError}</div>
            )}
            {!logPath && !runtimeInfo && !logError && !runtimeError && (
              <p className="muted">Clique sur le bouton pour récupérer les diagnostics (log + état runtime).</p>
            )}
          </div>
        </div>
        {/* TODO(diagnostics): alimenter runtime_info avec les vraies données (webcam réelle, profil sélectionné, dernière capture). */}
      </section>
    </div>
  );
}

export default App;
