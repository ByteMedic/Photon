import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, RefObject } from "react";
import { invoke } from "@tauri-apps/api/core";
import en from "./locales/en.json";
import fr from "./locales/fr.json";

// Shape of the translation JSON files so we keep both locales in sync at compile time.
type TranslationSchema = typeof en;
// Supported locale codes. The default must stay aligned with the product ask (English first).
type Locale = "en" | "fr";
// Simple enum-like union to drive the screen previewer without coupling to routing for now.
type ScreenKey = "capture" | "crop" | "pages" | "export";
// Export formats supported by the UX mock; wiring will later delegate to Rust commands.
type ExportFormat = "pdf" | "png" | "jpg";

// A favorite bundles where and how to export (folder + format) with an image profile alias.
type Favorite = {
  id: number;
  name: string;
  folder: string;
  format: "PDF" | "PNG" | "JPG";
  profile: string;
};

// Global preferences kept next to favorites to mimic the future configuration file.
type Preferences = {
  defaultFormat: Favorite["format"];
  defaultProfile: string;
  namingPattern: string;
};

// Persisted configuration blob shared between the UI and the Tauri backend later on.
type UserConfig = {
  favorites: Favorite[];
  preferences: Preferences;
};

// Local-storage key kept explicit so it can be reused from the backend when bridged.
const CONFIG_STORAGE_KEY = "photon.favorites.config";

// Default configuration gives new contributors a concrete example to tweak.
const DEFAULT_CONFIG: UserConfig = {
  favorites: [
    {
      id: 1,
      name: "Workspace PDF",
      folder: "~/Documents/Scans",
      format: "PDF",
      profile: "Text profile",
    },
  ],
  preferences: {
    defaultFormat: "PDF",
    defaultProfile: "Text profile",
    namingPattern: "{date}-{counter}-{profile}",
  },
};
// Track the local permission and stream lifecycle in a readable manner.
type PermissionState = "idle" | "prompt" | "granted" | "denied" | "error";

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

// Safely validate a config object, falling back to a provided default when values are missing.
function sanitizeConfig(raw: Partial<UserConfig> | null | undefined, fallback: UserConfig): UserConfig {
  const favoritesSource = Array.isArray(raw?.favorites) ? raw.favorites : null;
  const favorites = favoritesSource
    ? favoritesSource
        .map((fav, index) => {
          if (
            !fav ||
            typeof fav !== "object" ||
            typeof fav.name !== "string" ||
            typeof fav.folder !== "string" ||
            (fav.format !== "PDF" && fav.format !== "PNG" && fav.format !== "JPG") ||
            typeof fav.profile !== "string"
          ) {
            return null;
          }

          return {
            id: typeof fav.id === "number" ? fav.id : index + 1,
            name: fav.name,
            folder: fav.folder,
            format: fav.format,
            profile: fav.profile,
          } satisfies Favorite;
        })
        .filter(Boolean) as Favorite[]
    : fallback.favorites;

  const prefs = raw?.preferences;
  const preferences: Preferences = prefs && typeof prefs === "object"
    ? {
        defaultFormat:
          prefs.defaultFormat === "PDF" || prefs.defaultFormat === "PNG" || prefs.defaultFormat === "JPG"
            ? prefs.defaultFormat
            : fallback.preferences.defaultFormat,
        defaultProfile:
          typeof prefs.defaultProfile === "string"
            ? prefs.defaultProfile
            : fallback.preferences.defaultProfile,
        namingPattern:
          typeof prefs.namingPattern === "string"
            ? prefs.namingPattern
            : fallback.preferences.namingPattern,
      }
    : fallback.preferences;

  return { favorites, preferences };
}

// Extract a strongly-typed configuration from localStorage, falling back to defaults if missing.
function readStoredConfig(): UserConfig {
  // Guard against SSR/build time where `localStorage` is undefined.
  if (typeof localStorage === "undefined") {
    return DEFAULT_CONFIG;
  }

  const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
  if (!saved) {
    return DEFAULT_CONFIG;
  }

  try {
    const parsed = JSON.parse(saved) as Partial<UserConfig>;
    return sanitizeConfig(parsed, DEFAULT_CONFIG);
  } catch (error) {
    console.warn("Failed to parse stored config", error);
    return DEFAULT_CONFIG;
  }
}

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
  videoRef,
  permissionState,
  permissionError,
  availableCameras,
  selectedCameraId,
  onSelectCamera,
  onRequestAccess,
  onToggleMock,
  useMockVideo,
  isStreamActive,
  onRefreshDevices,
}: {
  t: TranslationSchema["uiPlayground"]["capture"];
  profileNames: string[];
  videoRef: RefObject<HTMLVideoElement>;
  permissionState: PermissionState;
  permissionError: string | null;
  availableCameras: MediaDeviceInfo[];
  selectedCameraId: string | null;
  onSelectCamera: (id: string | null) => void;
  onRequestAccess: () => void;
  onToggleMock: (enabled: boolean) => void;
  useMockVideo: boolean;
  isStreamActive: boolean;
  onRefreshDevices: () => void;
}) {
  // Human-friendly label to surface the current permission state to the user.
  const permissionLabel = (() => {
    if (permissionState === "granted") return t.permission.granted;
    if (permissionState === "denied") return t.permission.denied;
    if (permissionState === "error") return t.permission.error;
    if (permissionState === "prompt") return t.permission.prompt;
    return t.permission.idle;
  })();

  // Choose the pill color according to the risk level (green = OK, orange = needs attention, purple = info/default).
  const permissionPillClass = (() => {
    if (permissionState === "granted") return "pill-ok";
    if (permissionState === "denied" || permissionState === "error") return "pill-warn";
    return "pill-info";
  })();

  return (
    <div className="workspace">
      <div className="preview-card">
        <div className="card-header">
          <div>
            <h3>{t.previewTitle}</h3>
            <p>{t.previewSubtitle}</p>
          </div>
          <div className={`pill ${permissionPillClass}`}>{permissionLabel}</div>
        </div>
        <div className="preview-body">
          <div className="placeholder-video">
            {/* Real video element reused across states (real webcam stream or mocked media file). */}
            <video
              ref={videoRef}
              className="webcam-preview"
              autoPlay
              playsInline
              muted
              aria-label={t.previewPlaceholder}
            />
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
              <span className="label">{t.cameraLabel}</span>
              <div className="camera-select-row">
                <select
                  value={selectedCameraId ?? ""}
                  onChange={(event) => onSelectCamera(event.target.value || null)}
                >
                  {availableCameras.length === 0 && <option value="">{t.cameraMissing}</option>}
                  {availableCameras.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || t.cameraPlaceholder}
                    </option>
                  ))}
                </select>
                <button className="ghost" onClick={onRefreshDevices}>
                  {t.refreshCameras}
                </button>
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
            <div className="control-row">
              <span className="label">{t.permission.title}</span>
              <div className="chip-group">
                <button className="chip chip-active" onClick={onRequestAccess}>
                  {t.permission.request}
                </button>
                <button
                  className={`chip ${useMockVideo ? "chip-active" : ""}`}
                  onClick={() => onToggleMock(!useMockVideo)}
                >
                  {t.permission.useMock}
                </button>
              </div>
              <p className="muted">{t.permission.hint}</p>
              {permissionError && <p className="permission-error">{permissionError}</p>}
            </div>
            <div className="primary-actions">
              <button className="primary">{t.captureAction}</button>
              <button className="ghost">{t.retakeAction}</button>
            </div>
            <div className="stream-status">
              <span className="pill pill-info">{isStreamActive ? t.stream.active : t.stream.idle}</span>
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
              <span className={`pill ${isStreamActive ? "pill-ok" : "pill-warn"}`}>
                {isStreamActive ? t.statusReady : t.statusPending}
              </span>
            </li>
            <li>
              <span>{t.statusPermission}</span>
              <span className={`pill ${permissionPillClass}`}>{permissionLabel}</span>
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
  format,
  dpi,
  jpgQuality,
  destination,
  namingModel,
  counter,
  namingPreview,
  collision,
  resolvedCounter,
  includePageCountTag,
  includeQualityTag,
  includeTimestamp,
  pageCount,
  onFormatChange,
  onDpiChange,
  onJpgQualityChange,
  onDestinationChange,
  onNamingModelChange,
  onCounterChange,
  onTogglePageCountTag,
  onToggleQualityTag,
  onToggleTimestamp,
}: {
  t: TranslationSchema["uiPlayground"]["export"];
  format: ExportFormat;
  dpi: number;
  jpgQuality: number;
  destination: string;
  namingModel: string;
  counter: number;
  namingPreview: string;
  collision: boolean;
  resolvedCounter: number;
  includePageCountTag: boolean;
  includeQualityTag: boolean;
  includeTimestamp: boolean;
  pageCount: number;
  onFormatChange: (value: ExportFormat) => void;
  onDpiChange: (value: number) => void;
  onJpgQualityChange: (value: number) => void;
  onDestinationChange: (value: string) => void;
  onNamingModelChange: (value: string) => void;
  onCounterChange: (value: number) => void;
  onTogglePageCountTag: (value: boolean) => void;
  onToggleQualityTag: (value: boolean) => void;
  onToggleTimestamp: (value: boolean) => void;
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
            <select value={format} onChange={(event) => onFormatChange(event.target.value as ExportFormat)}>
              <option value="pdf">{t.formatPdf}</option>
              <option value="png">{t.formatPng}</option>
              <option value="jpg">{t.formatJpg}</option>
            </select>
            <p className="muted hint">{t.formatHint}</p>
          </label>
          <label className="field">
            <span className="label">{t.qualityLabel}</span>
            <div className="inline-field">
              <select
                value={dpi}
                onChange={(event) => onDpiChange(Number(event.target.value))}
                aria-label={t.qualityLabel}
              >
                <option value={200}>{t.qualityOptionMedium}</option>
                <option value={300}>{t.qualityOptionHigh}</option>
                <option value={450}>{t.qualityOptionMax}</option>
              </select>
              {format !== "pdf" && (
                <label className="field compact-field">
                  <span className="label">{t.jpgQualityLabel}</span>
                  <input
                    type="number"
                    min={60}
                    max={100}
                    value={jpgQuality}
                    onChange={(event) => onJpgQualityChange(Number(event.target.value))}
                  />
                </label>
              )}
            </div>
            <p className="muted hint">{t.qualityHint}</p>
          </label>
          <label className="field">
            <span className="label">{t.destinationLabel}</span>
            <input
              type="text"
              value={destination}
              onChange={(event) => onDestinationChange(event.target.value)}
              placeholder="~/Documents/Scans"
            />
            <p className="muted hint">{t.destinationHint}</p>
          </label>
          <label className="field">
            <span className="label">{t.namingLabel}</span>
            <input
              type="text"
              value={namingModel}
              onChange={(event) => onNamingModelChange(event.target.value)}
            />
            <p className="muted hint">{t.namingHint}</p>
          </label>
        </div>
        <div className="naming-section">
          <div className="naming-preview">
            <span>{t.previewLabel}</span>
            <code>{namingPreview}</code>
          </div>
          <div className="naming-meta">
            <div className="meta-row">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={includeTimestamp}
                  onChange={(event) => onToggleTimestamp(event.target.checked)}
                />
                <span>{t.timestampLabel}</span>
              </label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={includePageCountTag}
                  onChange={(event) => onTogglePageCountTag(event.target.checked)}
                />
                <span>{t.pageCountLabel.replace("{count}", String(pageCount))}</span>
              </label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={includeQualityTag}
                  onChange={(event) => onToggleQualityTag(event.target.checked)}
                />
                <span>{t.qualityTagLabel.replace("{dpi}", String(dpi))}</span>
              </label>
            </div>
            <div className="counter-row">
              <label className="field compact-field">
                <span className="label">{t.counterLabel}</span>
                <input
                  type="number"
                  min={1}
                  value={counter}
                  onChange={(event) => onCounterChange(Number(event.target.value))}
                />
              </label>
              <p className="muted">
                {collision
                  ? t.collisionResolved.replace("{counter}", String(resolvedCounter))
                  : t.collisionFree}
              </p>
            </div>
          </div>
        </div>
        <div className="primary-actions">
          <button className="primary">{t.export}</button>
          <button className="ghost">{t.cancel}</button>
        </div>
      </div>
    </div>
  );
}

// Favorites/configuration panel: handles CRUD locally and exposes import/export hooks.
function FavoritesConfigPanel({
  t,
  config,
  onConfigChange,
}: {
  t: TranslationSchema["favorites"];
  config: UserConfig;
  onConfigChange: (config: UserConfig) => void;
}) {
  // Local draft state keeps the form controlled and ready for edits.
  const [favoriteName, setFavoriteName] = useState("");
  const [favoriteFolder, setFavoriteFolder] = useState("");
  const [favoriteFormat, setFavoriteFormat] = useState<Favorite["format"]>("PDF");
  const [favoriteProfile, setFavoriteProfile] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  // Hidden file input to drive JSON import without exposing native UI elsewhere.
  const importInputRef = useRef<HTMLInputElement>(null);

  // Helper to reset the form after a save/delete.
  const resetForm = () => {
    setFavoriteName("");
    setFavoriteFolder("");
    setFavoriteFormat("PDF");
    setFavoriteProfile("");
    setEditingId(null);
  };

  // Fill the form with the selected favorite to ease edition.
  const handleEdit = (fav: Favorite) => {
    setFavoriteName(fav.name);
    setFavoriteFolder(fav.folder);
    setFavoriteFormat(fav.format);
    setFavoriteProfile(fav.profile);
    setEditingId(fav.id);
    setStatus(t.editingNotice.replace("{name}", fav.name));
  };

  // Remove a favorite and persist immediately.
  const handleDelete = (id: number) => {
    const updated = { ...config, favorites: config.favorites.filter((fav) => fav.id !== id) };
    onConfigChange(updated);
    setStatus(t.deletedNotice);
    if (editingId === id) {
      resetForm();
    }
  };

  // Insert or update a favorite with simple validation (no empty fields allowed).
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!favoriteName.trim() || !favoriteFolder.trim() || !favoriteProfile.trim()) {
      setStatus(t.validationError);
      return;
    }

    const nextFavorite: Favorite = {
      id: editingId ?? Date.now(),
      name: favoriteName.trim(),
      folder: favoriteFolder.trim(),
      format: favoriteFormat,
      profile: favoriteProfile.trim(),
    };

    const favorites = editingId
      ? config.favorites.map((fav) => (fav.id === editingId ? nextFavorite : fav))
      : [...config.favorites, nextFavorite];

    onConfigChange({ ...config, favorites });
    setStatus(editingId ? t.updatedNotice : t.savedNotice);
    resetForm();
  };

  // Update preferences inline with live persistence.
  const updatePreferences = (partial: Partial<Preferences>) => {
    onConfigChange({ ...config, preferences: { ...config.preferences, ...partial } });
    setStatus(t.preferenceSaved);
  };

  // Trigger the hidden file input to start an import flow.
  const startImport = () => {
    importInputRef.current?.click();
  };

  // Parse and validate a JSON file dropped into the import control.
  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const parsed = JSON.parse(content) as Partial<UserConfig>;
      if (!parsed || typeof parsed !== "object") {
        setStatus(t.importError);
        return;
      }

      // Sanitize against the current config so missing keys are inherited instead of dropped.
      onConfigChange(sanitizeConfig(parsed, config));
      setStatus(t.importOk);
    } catch (error) {
      console.error("Import failed", error);
      setStatus(t.importError);
    } finally {
      // Reset the input to allow re-importing the same file later.
      event.target.value = "";
    }
  };

  // Download the current config as a JSON file for easy sharing or backups.
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "photon-config.json";
    link.click();
    URL.revokeObjectURL(url);
    setStatus(t.exportedNotice);
  };

  return (
    <section>
      <h2>{t.title}</h2>
      <p className="muted">{t.subtitle}</p>

      <div className="favorites-grid">
        <div className="card">
          <div className="card-header">
            <div>
              <h3>{t.formTitle}</h3>
              <p className="muted">{t.formSubtitle}</p>
            </div>
          </div>
          <div className="card-body">
            <form className="favorites-form" onSubmit={handleSubmit}>
              <label className="field">
                <span className="label">{t.nameLabel}</span>
                <input
                  type="text"
                  value={favoriteName}
                  onChange={(event) => setFavoriteName(event.target.value)}
                  placeholder={t.namePlaceholder}
                />
              </label>
              <label className="field">
                <span className="label">{t.folderLabel}</span>
                <input
                  type="text"
                  value={favoriteFolder}
                  onChange={(event) => setFavoriteFolder(event.target.value)}
                  placeholder="~/Documents/Scans"
                />
              </label>
              <div className="favorites-row">
                <label className="field">
                  <span className="label">{t.formatLabel}</span>
                  <select value={favoriteFormat} onChange={(event) => setFavoriteFormat(event.target.value as Favorite["format"])}>
                    <option value="PDF">PDF</option>
                    <option value="PNG">PNG</option>
                    <option value="JPG">JPG</option>
                  </select>
                </label>
                <label className="field">
                  <span className="label">{t.profileLabel}</span>
                  <input
                    type="text"
                    value={favoriteProfile}
                    onChange={(event) => setFavoriteProfile(event.target.value)}
                    placeholder={t.profilePlaceholder}
                  />
                </label>
              </div>
              <div className="favorites-actions">
                <button className="primary" type="submit">
                  {editingId ? t.updateButton : t.saveButton}
                </button>
                <button className="ghost" type="button" onClick={resetForm}>
                  {t.resetButton}
                </button>
              </div>
            </form>

            <div className="favorites-status">{status ?? t.statusIdle}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h3>{t.listTitle}</h3>
              <p className="muted">{t.listSubtitle}</p>
            </div>
            <div className="chip-group">
              <button className="chip" type="button" onClick={handleExport}>
                {t.exportButton}
              </button>
              <button className="chip" type="button" onClick={startImport}>
                {t.importButton}
              </button>
              <input
                type="file"
                ref={importInputRef}
                accept="application/json"
                className="hidden-input"
                onChange={handleImport}
              />
            </div>
          </div>

          <div className="card-body">
            {config.favorites.length === 0 ? (
              <p className="muted">{t.empty}</p>
            ) : (
              <ul className="favorites-list">
                {config.favorites.map((fav) => (
                  <li key={fav.id} className="favorites-item">
                    <div>
                      <strong>{fav.name}</strong>
                      <p className="muted">{fav.folder}</p>
                      <div className="pill pill-info">{fav.format}</div>
                      <div className="pill pill-ok">{fav.profile}</div>
                    </div>
                    <div className="chip-group">
                      <button className="chip chip-outline" type="button" onClick={() => handleEdit(fav)}>
                        {t.editButton}
                      </button>
                      <button className="chip chip-outline" type="button" onClick={() => handleDelete(fav.id)}>
                        {t.deleteButton}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h3>{t.preferencesTitle}</h3>
            <p className="muted">{t.preferencesSubtitle}</p>
          </div>
        </div>
        <div className="card-body">
          <div className="favorites-row">
            <label className="field">
              <span className="label">{t.defaultFormatLabel}</span>
              <select
                value={config.preferences.defaultFormat}
                onChange={(event) => updatePreferences({ defaultFormat: event.target.value as Favorite["format"] })}
              >
                <option value="PDF">PDF</option>
                <option value="PNG">PNG</option>
                <option value="JPG">JPG</option>
              </select>
            </label>
            <label className="field">
              <span className="label">{t.defaultProfileLabel}</span>
              <input
                type="text"
                value={config.preferences.defaultProfile}
                onChange={(event) => updatePreferences({ defaultProfile: event.target.value })}
                placeholder={t.profilePlaceholder}
              />
            </label>
            <label className="field">
              <span className="label">{t.namingPatternLabel}</span>
              <input
                type="text"
                value={config.preferences.namingPattern}
                onChange={(event) => updatePreferences({ namingPattern: event.target.value })}
                placeholder="{date}-{counter}-{profile}"
              />
            </label>
          </div>
          <p className="muted">{t.persistenceHint}</p>
        </div>
      </div>
    </section>
  );
}

function App() {
  // Track the real preview readiness instead of a static placeholder.
  const [deviceReady, setDeviceReady] = useState(false);
  // Track the current UI language (default English as requested).
  const [locale, setLocale] = useState<Locale>("en");
  // Export options kept as state to let the playground demonstrate the expected UX.
  const [exportFormat, setExportFormat] = useState<ExportFormat>("pdf");
  const [dpi, setDpi] = useState(300);
  const [jpgQuality, setJpgQuality] = useState(92);
  const [destination, setDestination] = useState("~/Documents/Scans/Reports");
  const [namingModel, setNamingModel] = useState("{date}-{time}-{profile}-{counter}");
  const [counter, setCounter] = useState(1);
  const [includePageCountTag, setIncludePageCountTag] = useState(true);
  const [includeQualityTag, setIncludeQualityTag] = useState(true);
  const [includeTimestamp, setIncludeTimestamp] = useState(true);
  // Store diagnostic data fetched from the backend.
  const [logPath, setLogPath] = useState<string | null>(null);
  const [logError, setLogError] = useState<string | null>(null);
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);
  // Config (favorites + preferences) persisted locally to mimic the future Rust storage.
  const [userConfig, setUserConfig] = useState<UserConfig>(readStoredConfig);
  // Track which UX mock screen is shown; this will later map to real routes/states.
  const [activeScreen, setActiveScreen] = useState<ScreenKey>("capture");
  // Keep the media stream in React state to clean it up between camera switches.
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  // Cache the list of available cameras as soon as the browser exposes them.
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  // Surface the chosen camera so the selection dropdown stays controlled.
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  // Track permission state and errors to inform the user on the capture screen.
  const [permissionState, setPermissionState] = useState<PermissionState>("idle");
  const [permissionError, setPermissionError] = useState<string | null>(null);
  // Opt-in flag: when enabled we play a demo clip instead of reserving a real webcam.
  const [useMockVideo, setUseMockVideo] = useState(false);
  // Video element ref reused across renders to attach the MediaStream.
  const videoRef = useRef<HTMLVideoElement>(null);
  // Keep an imperative ref to the last stream so the unmount cleanup always has the latest value.
  const webcamStreamRef = useRef<MediaStream | null>(null);

  // Convenience accessor so the JSX reads like a server-rendered template.
  const t = translations[locale];

  // Helper to stop every active track on the current stream to avoid leaks/crashes when switching devices.
  const stopStream = (stream?: MediaStream | null) => {
    const targetStream = stream ?? webcamStreamRef.current;
    if (!targetStream) return;
    targetStream.getTracks().forEach((track) => track.stop());
  };

  // Ask the browser for available cameras to populate the select dropdown.
  const refreshCameras = async () => {
    try {
      // Some browsers require an initial getUserMedia call to reveal device labels; we rely on the permission flow for that.
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((device) => device.kind === "videoinput");
      setAvailableCameras(videoDevices);
      // Select the first camera only when no explicit choice exists yet.
      if (!selectedCameraId && videoDevices[0]) {
        setSelectedCameraId(videoDevices[0].deviceId);
      }
    } catch (err) {
      setPermissionState("error");
      setPermissionError(String(err));
    }
  };

  // Central function to request webcam access or fall back to the mock video clip.
  const requestWebcamAccess = async (cameraId?: string) => {
    // Reset transient error so a later success clears the message.
    setPermissionError(null);
    if (useMockVideo) {
      // When mocking, we simply load a video URL and mark the stream as usable for UI purposes.
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = t.uiPlayground.capture.permission.mockUrl;
        await videoRef.current.play();
      }
      setPermissionState("granted");
      setDeviceReady(true);
      stopStream();
      setWebcamStream(null);
      webcamStreamRef.current = null;
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setPermissionState("error");
      setPermissionError(t.uiPlayground.capture.permission.unsupported);
      return;
    }

    setPermissionState("prompt");
    try {
      // Always stop previous tracks to avoid multiple cameras fighting for resources.
      stopStream();
      const constraints: MediaStreamConstraints = {
        video: cameraId ? { deviceId: { exact: cameraId } } : { facingMode: "environment" },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.src = "";
        await videoRef.current.play();
      }
      setWebcamStream(stream);
      webcamStreamRef.current = stream;
      setPermissionState("granted");
      setDeviceReady(true);
      await refreshCameras();
    } catch (err) {
      // Explicitly differentiate denied permission from generic failures to guide troubleshooting.
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setPermissionState("denied");
        setPermissionError(t.uiPlayground.capture.permission.blocked);
      } else {
        setPermissionState("error");
        setPermissionError(String(err));
      }
      setDeviceReady(false);
      // Keep the previous stream cleared so the UI reflects the failure.
      stopStream();
      setWebcamStream(null);
      webcamStreamRef.current = null;
    }
  };

  // React to camera selection changes by restarting the stream only when a camera is selected.
  useEffect(() => {
    if (selectedCameraId) {
      requestWebcamAccess(selectedCameraId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCameraId]);

  // Refresh the device list on first render so the dropdown is immediately populated.
  useEffect(() => {
    refreshCameras();
    // Stop tracks on unmount to avoid leaving the webcam ON when navigating away.
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // Keep the timestamp stable across renders to avoid a flickering preview while typing.
  const stableNow = useMemo(() => new Date("2024-05-04T14:30:00Z"), []);
  // Minimal set used to surface a collision and demonstrate the auto-increment behavior.
  const existingExports = useMemo(() => {
    // Keep a short list in both locales so the collision indicator works regardless of language.
    const englishProfile = translations.en.uiPlayground.capture.profileDefault;
    const frenchProfile = translations.fr.uiPlayground.capture.profileDefault;
    return new Set([
      `2024-05-04-1430-${englishProfile}-001.pdf`,
      `2024-05-04-1430-${englishProfile}-002.pdf`,
      `2024-05-04-1430-${frenchProfile}-001.pdf`,
    ]);
  }, []);

  // Helper that turns a naming model into an actual file name while avoiding collisions.
  const computeAutoName = useMemo(() => {
    // Padding helper kept inline for readability.
    const pad = (value: number) => String(value).padStart(2, "0");

    return (params: {
      model: string;
      counter: number;
      format: ExportFormat;
      profile: string;
      includePageCount: boolean;
      includeQuality: boolean;
      includeTimestampParts: boolean;
      pageCount: number;
      dpi: number;
      now: Date;
      collisions: Set<string>;
    }) => {
      const { model, counter, format, profile, includePageCount, includeQuality, includeTimestampParts, pageCount, dpi, now, collisions } =
        params;

      // Render the core name without extension, allowing tokens for date/time/profile/counter.
      const renderName = (counterValue: number) => {
        const datePart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}`;

        // Replace tokens with user-friendly values; we keep replacements simple for readability.
        let name = model
          .replace("{date}", datePart)
          .replace("{time}", includeTimestampParts ? timePart : "")
          .replace("{counter}", String(counterValue).padStart(3, "0"))
          .replace("{profile}", profile)
          .replace("{format}", format.toUpperCase())
          .replace("{dpi}", `${dpi}dpi`);

        if (includePageCount) {
          name += `-${pageCount}p`;
        }
        if (includeQuality) {
          name += `-${dpi}dpi`;
        }

        return name;
      };

      // Apply the extension the exporter will use.
      const extension = format === "pdf" ? "pdf" : format;
      let resolvedCounter = Math.max(1, counter);
      let candidate = `${renderName(resolvedCounter)}.${extension}`;
      let collisionDetected = collisions.has(candidate);

      // When a collision is found, increment the counter until a free slot is available.
      while (collisions.has(candidate)) {
        resolvedCounter += 1;
        candidate = `${renderName(resolvedCounter)}.${extension}`;
      }

      return { name: candidate, collisionDetected, resolvedCounter };
    };
  }, []);

  const namingPreviewState = useMemo(() => {
    return computeAutoName({
      model: namingModel,
      counter,
      format: exportFormat,
      profile: t.uiPlayground.capture.profileDefault,
      includePageCount: includePageCountTag,
      includeQuality: includeQualityTag,
      includeTimestampParts: includeTimestamp,
      pageCount: mockPages.length,
      dpi,
      now: stableNow,
      collisions: existingExports,
    });
  }, [
    computeAutoName,
    counter,
    dpi,
    exportFormat,
    existingExports,
    includePageCountTag,
    includeQualityTag,
    includeTimestamp,
    mockPages.length,
    namingModel,
    stableNow,
    t.uiPlayground.capture.profileDefault,
  ]);

  // Persist configuration anytime it changes to keep the UI and localStorage aligned.
  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(userConfig));
  }, [userConfig]);

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
          <CaptureScreen
            t={t.uiPlayground.capture}
            profileNames={mockProfiles}
            videoRef={videoRef}
            permissionState={permissionState}
            permissionError={permissionError}
            availableCameras={availableCameras}
            selectedCameraId={selectedCameraId}
            onSelectCamera={(id) => setSelectedCameraId(id)}
            onRequestAccess={() => requestWebcamAccess(selectedCameraId ?? undefined)}
            onToggleMock={(enabled) => {
              setUseMockVideo(enabled);
              // Restart preview immediately with the chosen mode.
              requestWebcamAccess(selectedCameraId ?? undefined);
            }}
            useMockVideo={useMockVideo}
            isStreamActive={Boolean(webcamStream) || useMockVideo}
            onRefreshDevices={refreshCameras}
          />
        )}
        {activeScreen === "crop" && <CropScreen t={t.uiPlayground.crop} />}
        {activeScreen === "pages" && <PageRail t={t.uiPlayground.pages} pages={mockPages} />}
        {activeScreen === "export" && (
          <ExportPanel
            t={t.uiPlayground.export}
            format={exportFormat}
            dpi={dpi}
            jpgQuality={jpgQuality}
            destination={destination}
            namingModel={namingModel}
            counter={counter}
            namingPreview={namingPreviewState.name}
            collision={namingPreviewState.collisionDetected}
            resolvedCounter={namingPreviewState.resolvedCounter}
            includePageCountTag={includePageCountTag}
            includeQualityTag={includeQualityTag}
            includeTimestamp={includeTimestamp}
            pageCount={mockPages.length}
            onFormatChange={setExportFormat}
            onDpiChange={setDpi}
            onJpgQualityChange={setJpgQuality}
            onDestinationChange={setDestination}
            onNamingModelChange={setNamingModel}
            onCounterChange={setCounter}
            onTogglePageCountTag={setIncludePageCountTag}
            onToggleQualityTag={setIncludeQualityTag}
            onToggleTimestamp={setIncludeTimestamp}
          />
        )}
      </section>

      <FavoritesConfigPanel t={t.favorites} config={userConfig} onConfigChange={setUserConfig} />

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
