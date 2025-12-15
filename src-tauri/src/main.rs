#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;

// Commandes Rust -> frontend React. Ajouter ici les traitements image/exports.
#[tauri::command]
fn ping() -> &'static str {
    "pong"
}

fn init_logger() -> anyhow::Result<()> {
    use simplelog::{
        ColorChoice, CombinedLogger, ConfigBuilder, LevelFilter, SharedLogger, TermLogger, TerminalMode, WriteLogger,
    };

    // Stockage cross-plateforme dans le dossier de donnees applicatif.
    let project_dirs =
        directories::ProjectDirs::from("com", "Photon", "Photon").ok_or(anyhow::anyhow!("project dirs not found"))?;
    let log_dir: PathBuf = project_dirs.data_dir().to_path_buf();
    fs::create_dir_all(&log_dir)?;
    let log_path = log_dir.join("photon.log");

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
        .invoke_handler(tauri::generate_handler![ping])
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
