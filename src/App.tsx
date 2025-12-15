import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import en from "./locales/en.json";
import fr from "./locales/fr.json";

// Shape of the translation JSON files so we keep both locales in sync at compile time.
type TranslationSchema = typeof en;
// Supported locale codes. The default must stay aligned with the product ask (English first).
type Locale = "en" | "fr";
// Simple enum-like union to drive the screen previewer without coupling to routing for now.
type ScreenKey = "capture" | "crop" | "pages" | "export";

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

// Tab button used by the screen playground to keep the DOM minimal.
function ScreenTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`tab ${active ? "tab-active" : ""}`} onClick={onClick}>
      {label}
    </button>
  );
}

// Skeleton of the capture screen: it mimics the live preview and the side rail of controls.
function CaptureScreen({
  t,
  profileNames,
}: {
  t: TranslationSchema["uiPlayground"]["capture"];
  profileNames: string[];
}) {
  return (
    <div className="workspace">
      <div className="preview-card">
        <div className="card-header">
          <div>
            <h3>{t.previewTitle}</h3>
            <p>{t.previewSubtitle}</p>
          </div>
          <div className="pill pill-info">{t.previewStatus}</div>
        </div>
        <div className="preview-body">
          <div className="placeholder-video">
            <div className="detect-overlay" />
            <span className="placeholder-label">{t.previewPlaceholder}</span>
          </div>
          <div className="capture-controls">
            <div className="control-row">
              <span className="label">{t.qualityLabel}</span>
              <div className="chip-group">
                <button className="chip chip-active">1080p</button>
                <button className="chip">1440p</button>
              </div>
            </div>
            <div className="control-row">
              <span className="label">{t.favoriteLabel}</span>
              <div className="chip-group">
                <button className="chip chip-outline">Workspace</button>
                <button className="chip chip-outline">Inbox</button>
                <button className="chip chip-outline">Receipts</button>
              </div>
            </div>
            <div className="primary-actions">
              <button className="primary">{t.captureAction}</button>
              <button className="ghost">{t.retakeAction}</button>
            </div>
          </div>
        </div>
      </div>

      <aside className="side-rail">
        <div className="side-card">
          <h4>{t.profileTitle}</h4>
          <p className="muted">{t.profileSubtitle}</p>
          <div className="profile-list">
            {profileNames.map((profile) => (
              <button key={profile} className="profile-item profile-active">
                <div>
                  <strong>{profile}</strong>
                  <span className="muted">{t.profileHint}</span>
                </div>
                <span className="pill pill-ok">{t.profileApply}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="side-card">
          <h4>{t.statusTitle}</h4>
          <ul className="status-list">
            <li>
              <span>{t.statusCamera}</span>
              <span className="pill pill-warn">{t.statusPending}</span>
            </li>
            <li>
              <span>{t.statusPermission}</span>
              <span className="pill pill-info">{t.statusInfo}</span>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

// Crop screen placeholder: demonstrates how manual handles + rotation could be placed.
function CropScreen({ t }: { t: TranslationSchema["uiPlayground"]["crop"] }) {
  return (
    <div className="workspace">
      <div className="cropper">
        <div className="cropper-toolbar">
          <div>
            <h3>{t.title}</h3>
            <p>{t.subtitle}</p>
          </div>
          <div className="chip-group">
            <button className="chip">{t.rotate}</button>
            <button className="chip">{t.profile}</button>
          </div>
        </div>
        <div className="cropper-area">
          <div className="crop-box">
            <div className="handle top-left" />
            <div className="handle top-right" />
            <div className="handle bottom-left" />
            <div className="handle bottom-right" />
            <span className="placeholder-label">{t.placeholder}</span>
          </div>
        </div>
        <div className="primary-actions">
          <button className="primary">{t.apply}</button>
          <button className="ghost">{t.cancel}</button>
        </div>
      </div>
    </div>
  );
}

// Multi-page rail shows how reordering and quick actions would surface.
function PageRail({
  t,
  pages,
}: {
  t: TranslationSchema["uiPlayground"]["pages"];
  pages: { id: number; label: string; size: string }[];
}) {
  return (
    <div className="workspace">
      <div className="rail-header">
        <div>
          <h3>{t.title}</h3>
          <p>{t.subtitle}</p>
        </div>
        <button className="primary">{t.addPage}</button>
      </div>
      <div className="rail-grid">
        {pages.map((page) => (
          <div key={page.id} className="rail-item">
            <div className="rail-thumb">
              <span className="placeholder-label">{page.label}</span>
            </div>
            <div className="rail-meta">
              <div>
                <strong>{page.label}</strong>
                <span className="muted">{page.size}</span>
              </div>
              <div className="chip-group">
                <button className="chip chip-outline">{t.retake}</button>
                <button className="chip chip-outline">{t.delete}</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="rail-footer">
        <span className="muted">{t.orderHint}</span>
        <span className="pill pill-info">{t.estimate}</span>
      </div>
    </div>
  );
}

// Export dialog mock: keeps the form layout and naming preview visible for devs.
function ExportPanel({
  t,
  namingPreview,
}: {
  t: TranslationSchema["uiPlayground"]["export"];
  namingPreview: string;
}) {
  return (
    <div className="workspace">
      <div className="export-card">
        <div>
          <h3>{t.title}</h3>
          <p className="muted">{t.subtitle}</p>
        </div>
        <div className="export-grid">
          <label className="field">
            <span className="label">{t.formatLabel}</span>
            <select>
              <option>PDF</option>
              <option>PNG</option>
              <option>JPG</option>
            </select>
          </label>
          <label className="field">
            <span className="label">{t.qualityLabel}</span>
            <select>
              <option>1080p</option>
              <option>1440p</option>
            </select>
          </label>
          <label className="field">
            <span className="label">{t.destinationLabel}</span>
            <input type="text" placeholder="~/Documents/Scans" />
          </label>
          <label className="field">
            <span className="label">{t.namingLabel}</span>
            <input type="text" defaultValue="{date}-{counter}-{profile}" />
          </label>
        </div>
        <div className="naming-preview">
          <span>{t.previewLabel}</span>
          <code>{namingPreview}</code>
        </div>
        <div className="primary-actions">
          <button className="primary">{t.export}</button>
          <button className="ghost">{t.cancel}</button>
        </div>
      </div>
    </div>
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
  // Track which UX mock screen is shown; this will later map to real routes/states.
  const [activeScreen, setActiveScreen] = useState<ScreenKey>("capture");

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

  // Stable placeholders for the screen mocks to keep the layout constant and avoid re-renders.
  const mockProfiles = useMemo(() => [t.uiPlayground.capture.profileDefault, t.uiPlayground.capture.profilePhoto], [t]);
  const mockPages = useMemo(
    () => [
      { id: 1, label: `${t.uiPlayground.pages.pageLabel} 1`, size: "1.2 MB" },
      { id: 2, label: `${t.uiPlayground.pages.pageLabel} 2`, size: "1.4 MB" },
      { id: 3, label: `${t.uiPlayground.pages.pageLabel} 3`, size: "0.9 MB" },
    ],
    [t],
  );
  const namingPreview = useMemo(() => `2024-05-04-1430-${t.uiPlayground.capture.profileDefault}-001.pdf`, [t]);

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
        <h2>{t.uiPlayground.title}</h2>
        <p className="muted">{t.uiPlayground.subtitle}</p>
        <div className="tablist">
          <ScreenTab
            label={t.uiPlayground.tabs.capture}
            active={activeScreen === "capture"}
            onClick={() => setActiveScreen("capture")}
          />
          <ScreenTab
            label={t.uiPlayground.tabs.crop}
            active={activeScreen === "crop"}
            onClick={() => setActiveScreen("crop")}
          />
          <ScreenTab
            label={t.uiPlayground.tabs.pages}
            active={activeScreen === "pages"}
            onClick={() => setActiveScreen("pages")}
          />
          <ScreenTab
            label={t.uiPlayground.tabs.export}
            active={activeScreen === "export"}
            onClick={() => setActiveScreen("export")}
          />
        </div>

        {activeScreen === "capture" && (
          <CaptureScreen t={t.uiPlayground.capture} profileNames={mockProfiles} />
        )}
        {activeScreen === "crop" && <CropScreen t={t.uiPlayground.crop} />}
        {activeScreen === "pages" && <PageRail t={t.uiPlayground.pages} pages={mockPages} />}
        {activeScreen === "export" && <ExportPanel t={t.uiPlayground.export} namingPreview={namingPreview} />}
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
