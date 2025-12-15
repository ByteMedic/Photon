import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

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
  const [loadingLogPath, setLoadingLogPath] = useState(false);

  const fetchLogPath = async () => {
    setLoadingLogPath(true);
    setLogError(null);
    try {
      const path = await invoke<string>("log_path");
      setLogPath(path);
    } catch (err) {
      setLogError(String(err));
      setLogPath(null);
    } finally {
      setLoadingLogPath(false);
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
            <button className="ghost" onClick={fetchLogPath} disabled={loadingLogPath}>
              {loadingLogPath ? "Lecture..." : "Afficher le chemin du log"}
            </button>
          </div>

          <div className="card-body">
            {logPath && (
              <div className="log-path">
                <span className="label">Log file</span>
                <code>{logPath}</code>
              </div>
            )}
            {logError && <div className="log-error">Erreur: {logError}</div>}
            {!logPath && !logError && <p className="muted">Clique sur le bouton pour récupérer le chemin du log.</p>}
          </div>
        </div>
        {/* TODO(diagnostics): ajouter d'autres infos (device webcam détecté, profil en cours, dernière capture) quand disponibles. */}
      </section>
    </div>
  );
}

export default App;
