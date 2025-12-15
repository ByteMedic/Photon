import { useState } from "react";

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
    </div>
  );
}

export default App;
