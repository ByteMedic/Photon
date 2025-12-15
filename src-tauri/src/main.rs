#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
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
    log::debug!("capture_frame: TODO: ouvrir la webcam selectionnee et retourner un buffer d'image");
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

#[tauri::command]
fn runtime_info() -> Result<RuntimeInfo, String> {
    log::info!("runtime_info:fetch");
    log::debug!("runtime_info: TODO: retourner l'etat reel (webcam presente, profil actif)");
    // TODO(platform): interroger l'etat runtime (webcam detectee, profil/scene en cours).
    Ok(RuntimeInfo {
        webcam_detected: false,
        active_profile: Some("default".to_string()),
    })
}

fn log_file_path() -> anyhow::Result<PathBuf> {
    let project_dirs =
        directories::ProjectDirs::from("com", "Photon", "Photon").ok_or(anyhow::anyhow!("project dirs not found"))?;
    let log_dir: PathBuf = project_dirs.data_dir().to_path_buf();
    fs::create_dir_all(&log_dir)?;
    Ok(log_dir.join("photon.log"))
}

fn init_logger() -> anyhow::Result<()> {
    use simplelog::{
        ColorChoice, CombinedLogger, ConfigBuilder, LevelFilter, SharedLogger, TermLogger, TerminalMode, WriteLogger,
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
