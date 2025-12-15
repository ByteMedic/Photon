#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use nokhwa::query_devices;
use nokhwa::utils::ApiBackend;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

// Commandes Rust -> frontend React. Ajouter ici les traitements image/exports.
// TODO(scanner): remplacer les stubs par les implementations definitives (capture, detection, export).
#[tauri::command]
fn ping() -> &'static str {
    "pong"
}

#[tauri::command]
fn log_path() -> Result<String, String> {
    log_file_path()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| {
            log::error!("log_path: unable to compute log path: {e}");
            e.to_string()
        })
}

#[tauri::command]
fn capture_frame_stub() -> Result<(), String> {
    log::info!("capture_frame:start");
    log::debug!(
        "capture_frame: TODO: ouvrir la webcam selectionnee et retourner un buffer d'image"
    );
    Err("capture_frame not implemented".to_string())
}

#[tauri::command]
fn detect_document_stub() -> Result<(), String> {
    log::info!("detect_document:start");
    log::debug!("detect_document: TODO: analyser l'image, retourner coins + score de confiance");
    Err("detect_document not implemented".to_string())
}

#[tauri::command]
fn export_pdf_stub() -> Result<(), String> {
    log::info!("export_pdf:start");
    log::debug!("export_pdf: TODO: assembler les pages (ordre, dpi, profil) et ecrire le PDF");
    Err("export_pdf not implemented".to_string())
}

#[derive(Serialize)]
struct RuntimeInfo {
    webcam_detected: bool,
    active_profile: Option<String>,
}

/// Configuration applicative minimale pour exposer un profil actif.
/// Penser à étendre cette structure lorsque d'autres préférences seront ajoutées
/// (ex: dernier dossier utilisé, favoris de formats, etc.).
#[derive(Serialize, Deserialize, Default)]
struct AppConfig {
    active_profile: Option<String>,
}

#[tauri::command]
fn runtime_info() -> Result<RuntimeInfo, String> {
    log::info!("runtime_info:fetch");
    // Détection matérielle + lecture de configuration afin d'exposer un état réel au frontend.
    // Toute erreur est journalisée mais n'empêche pas le renvoi d'un état cohérent côté UI.

    let webcam_detected = match detect_webcam_presence() {
        Ok(presence) => presence,
        Err(err) => {
            log::error!("runtime_info:webcam_detection_failed: {err}");
            false
        }
    };

    let active_profile = match load_active_profile() {
        Ok(profile) => profile,
        Err(err) => {
            log::error!("runtime_info:profile_load_failed: {err}");
            None
        }
    };

    Ok(RuntimeInfo {
        webcam_detected,
        active_profile,
    })
}

fn log_file_path() -> anyhow::Result<PathBuf> {
    let data_dir = app_data_dir()?;
    fs::create_dir_all(&data_dir)?;
    Ok(data_dir.join("photon.log"))
}

fn init_logger() -> anyhow::Result<()> {
    use simplelog::{
        ColorChoice, CombinedLogger, ConfigBuilder, LevelFilter, SharedLogger, TermLogger,
        TerminalMode, WriteLogger,
    };

    // Stockage cross-plateforme dans le dossier de donnees applicatif.
    let log_path = log_file_path()?;

    let config = ConfigBuilder::new()
        .set_time_format_rfc3339()
        .set_thread_level(LevelFilter::Off) // Eviter le bruit des threads dans les logs.
        .build();

    let mut loggers: Vec<Box<dyn SharedLogger>> = Vec::new();

    // Console: niveau Info pour ne pas saturer.
    loggers.push(TermLogger::new(
        LevelFilter::Info,
        config.clone(),
        TerminalMode::Mixed,
        ColorChoice::Auto,
    ));

    // Fichier: niveau Debug pour diagnostiquer le pipeline.
    let file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)?;
    loggers.push(WriteLogger::new(LevelFilter::Debug, config, file));

    CombinedLogger::init(loggers)?;
    log::info!("Logger initialise, fichier {:?}", log_path);
    Ok(())
}

/// Retourne le dossier de données applicatif standard (OS-specific).
/// Centralisé pour réutiliser le même chemin pour les logs et la configuration.
fn app_data_dir() -> anyhow::Result<PathBuf> {
    let project_dirs = directories::ProjectDirs::from("com", "Photon", "Photon")
        .ok_or(anyhow::anyhow!("project dirs not found"))?;
    Ok(project_dirs.data_dir().to_path_buf())
}

/// Lecture de la configuration persistée (JSON) depuis le dossier applicatif.
/// - Si le fichier n'existe pas, on renvoie la configuration par défaut.
/// - Si le fichier est illisible ou invalide, on surface l'erreur pour log + UI.
fn load_app_config() -> anyhow::Result<AppConfig> {
    let config_path = app_data_dir()?.join("config.json");
    if !config_path.exists() {
        log::debug!(
            "load_app_config: aucune configuration trouvee, utilisation des valeurs par defaut ({:?})",
            config_path
        );
        return Ok(AppConfig::default());
    }

    let config_content = fs::read_to_string(&config_path)?;
    let parsed: AppConfig = serde_json::from_str(&config_content)?;
    Ok(parsed)
}

/// Détermine le profil actif en lisant la configuration JSON.
/// Par défaut, un profil "default" est retourné pour garder un comportement prévisible,
/// même si aucune préférence n'a encore été enregistrée.
fn load_active_profile() -> anyhow::Result<Option<String>> {
    let config = load_app_config()?;
    Ok(config
        .active_profile
        .or_else(|| Some("default".to_string())))
}

/// Détecte la présence d'au moins une webcam en interrogeant les périphériques.
/// On utilise `nokhwa` avec le backend automatique pour rester cross-plateforme.
fn detect_webcam_presence() -> anyhow::Result<bool> {
    // `query_devices` ne réserve pas la caméra : on peut l'appeler en toute sécurité
    // au démarrage pour exposer un état rapide au frontend.
    let cameras = query_devices(ApiBackend::Auto)?;
    Ok(!cameras.is_empty())
}

// TODO(scanner): exposer des commandes Rust pour la capture webcam et le pipeline image (detection, redressement, filtres, export PDF/PNG/JPG).
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            ping,
            log_path,
            capture_frame_stub,
            detect_document_stub,
            export_pdf_stub,
            runtime_info
        ])
        .setup(|_app| {
            if let Err(err) = init_logger() {
                eprintln!("Logger init error: {err}");
            }
            // TODO(platform): verifier la presence d'une webcam et charger la configuration/favoris au demarrage.
            // TODO(diagnostics): enrichir le logger avec contexte (session, device) et telemetry locale (sans reseau).
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
