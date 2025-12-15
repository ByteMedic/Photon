#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Commandes Rust -> frontend React. Ajouter ici les traitements image/exports.
#[tauri::command]
fn ping() -> &'static str {
    "pong"
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![ping])
        .setup(|_app| {
            // Initialisations (ex: verifier la presence webcam, config par defaut)
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
