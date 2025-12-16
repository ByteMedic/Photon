#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use nokhwa::utils::ApiBackend;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};
use sysinfo::Disks;

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

/// Rapport de nettoyage pour tracer ce qui a ete supprime dans le dossier temporaire.
#[derive(Default, Serialize)]
struct CleanupReport {
    cleaned_entries: usize,
    reclaimed_bytes: u64,
}

/// Etat de robustesse global expose au frontend pour alerter l'utilisateur en cas de faible espace disque.
#[derive(Serialize)]
struct HousekeepingStatus {
    available_bytes: u64,
    threshold_bytes: u64,
    low_space: bool,
    temp_dir: String,
    cleanup: CleanupReport,
}

// Espace disque minimal recommande avant capture/export pour respecter la spec (<200 Mo => alerte).
const MIN_DISK_SPACE_BYTES: u64 = 200 * 1024 * 1024;
// Durée maximale de retention des fichiers temporaires generes pendant une session.
const TEMP_RETENTION_HOURS: u64 = 24;

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

/// Retourne le dossier temporaire dedie a l'application. Il est separe du dossier
/// de configuration pour eviter de laisser des artefacts volumineux a cote des
/// preferences utilisateur.
fn temporary_workspace_dir() -> anyhow::Result<PathBuf> {
    let temp_dir = app_data_dir()?.join("tmp");
    fs::create_dir_all(&temp_dir)?;
    Ok(temp_dir)
}

/// Calcule la taille totale d'un dossier (fichiers + sous-dossiers) pour tracer ce que
/// le nettoyage permet de liberer. Cette fonction reste volontairement iterative pour
/// eviter un dépassement de pile en cas d'arborescences profondes.
fn compute_dir_size(root: &Path) -> anyhow::Result<u64> {
    let mut total = 0u64;
    let mut stack = vec![root.to_path_buf()];

    while let Some(path) = stack.pop() {
        for entry in fs::read_dir(&path)? {
            let entry = entry?;
            let metadata = entry.metadata()?;
            if metadata.is_dir() {
                stack.push(entry.path());
            } else {
                total = total.saturating_add(metadata.len());
            }
        }
    }

    Ok(total)
}

/// Supprime les fichiers temporaires plus anciens que `TEMP_RETENTION_HOURS` afin de ne
/// pas saturer le disque. Les erreurs sont loggees mais l'execution se poursuit pour
/// nettoyer un maximum d'entrees.
fn cleanup_temporary_files() -> anyhow::Result<CleanupReport> {
    let temp_dir = temporary_workspace_dir()?;
    let cutoff = SystemTime::now()
        .checked_sub(Duration::from_secs(TEMP_RETENTION_HOURS * 3600))
        .ok_or_else(|| anyhow::anyhow!("system time overflow when computing cutoff"))?;

    let mut report = CleanupReport::default();

    for entry in fs::read_dir(&temp_dir)? {
        let entry = match entry {
            Ok(item) => item,
            Err(err) => {
                log::error!("cleanup: unable to read entry in {:?}: {err}", temp_dir);
                continue;
            }
        };

        let path = entry.path();
        let metadata = match entry.metadata() {
            Ok(meta) => meta,
            Err(err) => {
                log::error!("cleanup: unable to read metadata for {:?}: {err}", path);
                continue;
            }
        };

        // En cas d'absence d'info de modification, on prefere purger pour rester safe.
        let modified = metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH);
        if modified > cutoff {
            continue;
        }

        let size = if metadata.is_dir() {
            match compute_dir_size(&path) {
                Ok(value) => value,
                Err(err) => {
                    log::error!("cleanup: unable to measure dir {:?}: {err}", path);
                    0
                }
            }
        } else {
            metadata.len()
        };

        let removal_result = if metadata.is_dir() {
            fs::remove_dir_all(&path)
        } else {
            fs::remove_file(&path)
        };

        match removal_result {
            Ok(_) => {
                report.cleaned_entries += 1;
                report.reclaimed_bytes = report.reclaimed_bytes.saturating_add(size);
                log::info!("cleanup: removed {:?} ({} bytes)", path, size);
            }
            Err(err) => log::error!("cleanup: unable to remove {:?}: {err}", path),
        }
    }

    Ok(report)
}

/// Mesure l'espace disque disponible sur le volume qui contient `path`. En cas d'absence
/// de correspondance, on renvoie une erreur explicite pour faciliter le debuggage.
fn available_disk_space(path: &Path) -> anyhow::Result<u64> {
    let mut disks = Disks::new_with_refreshed_list();
    // Rafraichir les statistiques sans reconstruire la liste.
    disks.refresh();

    let mount = path
        .ancestors()
        .find_map(|ancestor| {
            disks
                .list()
                .iter()
                .find(|disk| ancestor.starts_with(disk.mount_point()))
        })
        .ok_or_else(|| anyhow::anyhow!("no disk found for path {:?}", path))?;

    Ok(mount.available_space())
}

/// Execute le nettoyage des fichiers temporaires et retourne un etat global sur l'espace disque
/// afin d'alimenter l'UI et les logs. Cette commande pourra etre appelee au startup et a la demande.
#[tauri::command]
fn housekeeping() -> Result<HousekeepingStatus, String> {
    log::info!("housekeeping:start");

    temporary_workspace_dir()
        .map_err(|err| {
            log::error!("housekeeping:init_temp_dir_failed: {err}");
            err.to_string()
        })
        .and_then(|temp_dir| {
            let cleanup = cleanup_temporary_files().map_err(|err| {
                log::error!("housekeeping:cleanup_failed: {err}");
                err.to_string()
            })?;

            let available_bytes = available_disk_space(&temp_dir).map_err(|err| {
                log::error!("housekeeping:disk_probe_failed: {err}");
                err.to_string()
            })?;

            let low_space = available_bytes <= MIN_DISK_SPACE_BYTES;
            if low_space {
                log::warn!(
                    "housekeeping: low disk space detected: available {} bytes, threshold {} bytes",
                    available_bytes, MIN_DISK_SPACE_BYTES
                );
            } else {
                log::info!(
                    "housekeeping: available space {} bytes on temp volume (threshold {})",
                    available_bytes, MIN_DISK_SPACE_BYTES
                );
            }

            Ok(HousekeepingStatus {
                available_bytes,
                threshold_bytes: MIN_DISK_SPACE_BYTES,
                low_space,
                temp_dir: temp_dir.to_string_lossy().to_string(),
                cleanup,
            })
        })
}

/// Détecte la présence d'au moins une webcam en interrogeant les périphériques.
/// On utilise `nokhwa` avec le backend automatique pour rester cross-plateforme.
fn detect_webcam_presence() -> anyhow::Result<bool> {
    // `nokhwa::query` ne réserve pas la caméra : on peut l'appeler en toute sécurité
    // au démarrage pour exposer un état rapide au frontend.
    let backend = preferred_backend();
    let cameras = nokhwa::query(backend)?;
    Ok(!cameras.is_empty())
}

/// Selectionne le backend webcam preferé par OS. Sous Linux, on force V4L pour
/// éviter les warnings PipeWire/GStreamer; ailleurs on reste sur les backends natifs.
fn preferred_backend() -> ApiBackend {
    #[cfg(target_os = "linux")]
    {
        ApiBackend::Video4Linux
    }
    #[cfg(target_os = "windows")]
    {
        ApiBackend::MediaFoundation
    }
    #[cfg(target_os = "macos")]
    {
        ApiBackend::AVFoundation
    }
    #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
    {
        ApiBackend::Auto
    }
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
            runtime_info,
            housekeeping
        ])
        .setup(|_app| {
            if let Err(err) = init_logger() {
                eprintln!("Logger init error: {err}");
            }
            // Lancer un nettoyage proactif au demarrage afin de ne pas laisser l'espace disque
            // se degrader entre deux sessions d'utilisation.
            if let Err(err) = housekeeping() {
                log::error!("startup: housekeeping failed: {err}");
            }
            // TODO(platform): verifier la presence d'une webcam et charger la configuration/favoris au demarrage.
            // TODO(diagnostics): enrichir le logger avec contexte (session, device) et telemetry locale (sans reseau).
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
