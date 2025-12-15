#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Commandes Rust -> frontend React. Ajouter ici les traitements image/exports.
#[tauri::command]
fn ping() -> &'static str {
    "pong"
}

// TODO(scanner): exposer des commandes Rust pour la capture webcam et le pipeline image (detection, redressement, filtres, export PDF/PNG/JPG).
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![ping])
        .setup(|_app| {
            // TODO(platform): verifier la presence d'une webcam et charger la configuration/favoris au demarrage.
            // TODO(diagnostics): initialiser un logger basique pour diagnostiquer le flux de scan.
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
