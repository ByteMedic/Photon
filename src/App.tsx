import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import en from "./locales/en.json";
import fr from "./locales/fr.json";

// Shape of the translation JSON files so we keep both locales in sync at compile time.
type TranslationSchema = typeof en;
// Supported locale codes. The default must stay aligned with the product ask (English first).
type Locale = "en" | "fr";

// Runtime info returned by the Tauri backend (stubbed for now but typed here for clarity).
type RuntimeInfo = {
  webcam_detected: boolean;
  active_profile: string | null;
};

// Centralized translation map ensures we only maintain translations in dedicated JSON files.
const translations: Record<Locale, TranslationSchema> = {
  en,
  fr,
};

// Simple feature renderer kept generic so it can render any locale-provided item.
function FeatureItem({ title, description }: TranslationSchema["features"]["items"][number]) {
  return (
    <li className="feature">
      <strong>{title}</strong>
      <span>{description}</span>
    </li>
  );
}

function App() {
  // Frontend-only flag for the status pill until the webcam is wired.
  const [deviceReady] = useState(false);
  // Track the current UI language (default English as requested).
  const [locale, setLocale] = useState<Locale>("en");
  // Store diagnostic data fetched from the backend.
  const [logPath, setLogPath] = useState<string | null>(null);
  const [logError, setLogError] = useState<string | null>(null);
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);

  // Convenience accessor so the JSX reads like a server-rendered template.
  const t = translations[locale];

  // Fetch both log path and runtime metadata in a single user action to help debugging.
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
      // Use the same error message for both pieces of data to avoid losing context for the user.
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
        <div className="header-top">
          <div>
            <h1>{t.header.title}</h1>
            <p>{t.header.subtitle}</p>
          </div>
          <div className="language-picker">
            <label htmlFor="locale-select">{t.languagePicker.label}</label>
            <select
              id="locale-select"
              value={locale}
              onChange={(event) => setLocale(event.target.value as Locale)}
            >
              <option value="en">{t.languagePicker.english}</option>
              <option value="fr">{t.languagePicker.french}</option>
            </select>
          </div>
        </div>
      </header>

      <section className="status">
        <div className="badge">{deviceReady ? t.status.webcamReady : t.status.webcamConfigure}</div>
        <div className="badge">{t.status.license}</div>
        <div className="badge">{t.status.techStack}</div>
      </section>

      <section>
        <h2>{t.features.title}</h2>
        <ul className="features">
          {t.features.items.map((feature) => (
            <FeatureItem key={feature.title} {...feature} />
          ))}
        </ul>
      </section>

      <section>
        <h2>{t.steps.title}</h2>
        <ol className="steps">
          {t.steps.items.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="diagnostic">
        <div className="card">
          <div className="card-header">
            <div>
              <h3>{t.diagnostics.title}</h3>
              <p>{t.diagnostics.subtitle}</p>
            </div>
            <button className="ghost" onClick={fetchDiagnostics} disabled={loadingDiagnostics}>
              {loadingDiagnostics ? t.diagnostics.loading : t.diagnostics.button}
            </button>
          </div>

          <div className="card-body">
            <div className="runtime-grid">
              <div className="log-path">
                <span className="label">{t.diagnostics.logLabel}</span>
                {logPath ? <code>{logPath}</code> : <p className="muted">{t.diagnostics.logMissing}</p>}
              </div>
              <div className="runtime-block">
                <span className="label">{t.diagnostics.runtimeWebcam}</span>
                {runtimeInfo ? (
                  <span className={`pill ${runtimeInfo.webcam_detected ? "pill-ok" : "pill-warn"}`}>
                    {runtimeInfo.webcam_detected ? t.diagnostics.runtimeYes : t.diagnostics.runtimeNo}
                  </span>
                ) : (
                  <p className="muted">{t.diagnostics.runtimeMissing}</p>
                )}
              </div>
              <div className="runtime-block">
                <span className="label">{t.diagnostics.runtimeProfile}</span>
                {runtimeInfo ? (
                  <span className="pill pill-info">{runtimeInfo.active_profile ?? t.diagnostics.profileNone}</span>
                ) : (
                  <p className="muted">{t.diagnostics.runtimeMissing}</p>
                )}
              </div>
            </div>

            {(logError || runtimeError) && (
              <div className="log-error">
                {t.diagnostics.errorPrefix}: {logError || runtimeError}
              </div>
            )}
            {!logPath && !runtimeInfo && !logError && !runtimeError && (
              <p className="muted">{t.diagnostics.instructions}</p>
            )}
          </div>
        </div>
        {/* TODO(diagnostics): alimenter runtime_info avec les vraies données (webcam réelle, profil sélectionné, dernière capture). */}
      </section>
    </div>
  );
}

export default App;
