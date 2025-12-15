# Documentation Photon

Ce document resume les pratiques de commentaires/TODO et les chantiers en cours. Il doit etre tenu a jour des que de nouveaux TODO sont ajoutes ou resolus.

## Commentaires et TODO dans le code
- Ajouter des TODO explicites aux zones non implementees ou a risques; format conseille: `TODO(scope): action attendue` (ex: `TODO(scanner): plug capture webcam et redressement`).
- Utiliser `NOTE:` pour un contexte utile et `FIXME:` pour un bug avere a corriger rapidement.
- Placer les TODO au plus pres du code concerne afin de guider un nouveau developpeur.
- Lorsqu'un TODO est traite, le supprimer et, si besoin, consigner la decision dans ce fichier.

## Backlog cible a materialiser dans le code
- [ ] Rust backend: commandes de capture webcam, detection/redressement, filtres, export PDF/PNG/JPG (stubs exposes pour le moment).
- [ ] Frontend React: UI de capture (etat sans camera, selection camera + mock video OK), recadrage manuel, flux multi-page.
- [x] Maquette UX statique (React) pour les ecrans capture/recadrage/multi-page/export avec bascule par onglets.
- [x] Configuration/persistance: chargement/sauvegarde des favoris, dossiers et profils (stockage local + import/export JSON).
- [x] Observabilite: logger minimal en place (console + fichier). Reste a tracer le pipeline (capture/detection/export) avec contexte (session, device).
- [ ] Tests: golden images pour detection/redressement, mocks video pour tests d'integration.
- [ ] Packaging: regeneration des icones multi-tailles (voir section ci-dessous).
- [x] Robustesse: commande `housekeeping` pour nettoyer les fichiers temporaires et surveiller l'espace disque.
- [x] Export/nommage: maquette export PDF/PNG/JPG avec options de qualite (dpi/JPG) et previsualisation de nommage auto.

## Logger minimal (Rust backend)
- Initialisation dans `src-tauri/src/main.rs` (`init_logger`), lancee au startup Tauri.
- Sorties:
  - Console: niveau `INFO` pour ne pas saturer le dev server.
  - Fichier: niveau `DEBUG` dans le dossier donnees applicatif (`~/.local/share/com.photon/Photon/photon.log` sous Linux; chemin equivalent selon l'OS).
- Usage:
  - Cote Rust: `log::info!("message")`, `log::debug!("details {:?}", data)`, `log::error!("message {}", err)`.
  - Inspecter en dev: `tail -f ~/.local/share/com.photon/Photon/photon.log`.
- TODO: ajouter un identifiant de session et les infos device/webcam dans les logs du pipeline.

## Instrumentation du pipeline (stubs)
- Commandes Tauri exposees (stubs pour cadrer l'instrumentation): `capture_frame_stub`, `detect_document_stub`, `export_pdf_stub`.
- Chaque stub trace `info` (debut) et `debug` (details/TODO) puis retourne `Err("... not implemented")` tant que l'implementation n'est pas faite.
- Quand les vraies commandes seront implantees, conserver cette granularite de logs:
  - `info!` au debut/fin de chaque etape (capture, detection, export).
  - `debug!` pour les parametres (device, resolution, profil, dpi), stats (temps, score detection), tailles fichiers.
- Commande utilitaire `log_path` (Tauri) pour exposer le chemin du log a l'UI de diagnostic (frontend peut appeler `invoke("log_path")`).
- Commande `runtime_info` interroge maintenant `nokhwa` (`ApiBackend::Auto`) pour detecter la presence d'au moins une webcam **sans la reserver** et lit le profil actif depuis le fichier de configuration JSON. En cas d'erreur, un etat degrade est renvoye (webcam_detected=false, profil `None`) mais les logs sont renseignes.
- Implementation: `nokhwa` expose `query_devices` via le module `nokhwa::query` (version 0.10). Pensez a conserver cet import explicite si vous mettez a jour la dependance afin d'eviter les regressions de compilation.
- Fichier de configuration runtime: `config.json` dans le dossier donnees applicatif (ex: `~/.local/share/com.photon/Photon/config.json`). Structure minimale: `{ "active_profile": "default" }`. Si le fichier est absent, le profil `default` est renvoye par defaut.
- UI frontend: panneau "Diagnostic developpeur" (voir `src/App.tsx`) appelle `invoke("log_path")` + `invoke("runtime_info")` et affiche le chemin du fichier de log, l'etat webcam et le profil actif. Bouton a re-utiliser plus tard pour d'autres diagnostics (ex: device courant).

## Robustesse / nettoyage disque
- Commande Tauri `housekeeping` (Rust, `src-tauri/src/main.rs`) executant deux actions :
  - purge des fichiers temporaires ages de plus de 24h dans le sous-dossier `tmp` du dossier applicatif ;
  - mesure de l'espace disque disponible sur le volume cible et alerte si l'espace est inferieur a 200 Mo (alignement avec la contrainte produit).
- La commande retourne une structure `HousekeepingStatus` (JSON) contenant `available_bytes`, `threshold_bytes`, `low_space`, `temp_dir` et un rapport `cleanup` (`cleaned_entries`, `reclaimed_bytes`).
- Le nettoyage est invoque automatiquement au startup Tauri (voir `setup` dans `main.rs`) et peut etre declenche a la demande via `invoke("housekeeping")` depuis le frontend ou des tests.
## Flux webcam (frontend)
- La maquette capture integre maintenant un **vrai lecteur video**. Le composant `CaptureScreen` recupere le `videoRef` et les callbacks pour:
  - lister les cameras (`refreshCameras` via `enumerateDevices`),
  - lancer un flux reel (`requestWebcamAccess` via `getUserMedia`),
  - activer un **mock video** (clip `flower.mp4` MDN) si l'environnement bloque la webcam.
- Etats exposes dans `App`:
  - `permissionState` (`idle | prompt | granted | denied | error`) et `permissionError` pour piloter les pills et messages d'erreur utilisateurs,
  - `availableCameras` + `selectedCameraId` pour le selecteur de camera,
  - `useMockVideo` pour switcher entre flux reel et clip de test sans reserver la webcam.
- Nettoyage: `stopStream` ferme toutes les pistes actives (utilise `webcamStreamRef` pour garantir un cleanup meme sur unmount).
- UX: le panneau lateral affiche l'etat permission/camera en direct et le bandeau haut de la page passe en "Webcam ready" quand la permission est accordee ou quand le mock est actif.

## Internationalisation (frontend)
- Langues supportees : **anglais (par defaut)** et **francais**, via des fichiers JSON dans `src/locales/en.json` et `src/locales/fr.json`.
- Les clefs doivent rester strictement synchronisees entre les deux fichiers; `src/App.tsx` typage les utilise pour empecher les oublis.
- Le composant `App` expose un selecteur de langue dans l'en-tete. Toute nouvelle chaine d'UI doit etre ajoutee dans les deux JSON puis referencee depuis `App` (ou un composant dedie) sans texte en dur.
- Penser a commenter les usages sensibles (ex: textes dynamiques lies aux diagnostics) pour guider les nouveaux contributeurs sur l'emplacement des traductions.

## Maquette d'ecrans (React)
- Les ecrans capture/recadrage/multi-page/export sont maquettes dans `src/App.tsx` via un mini tab-switcher (`ScreenTab`) et des composants dedies (`CaptureScreen`, `CropScreen`, `PageRail`, `ExportPanel`).
- Les traductions de cette maquette sont sous la clef `uiPlayground` dans `src/locales/en.json` et `src/locales/fr.json`; ajouter/mettre a jour les chaines dans les deux fichiers avant d'etendre la maquette.
- Les donnees affichees sont des placeholders stables (useMemo) afin de conserver le layout et guider le cablage futur (webcam Tauri, recadrage reel, rail multi-page). Remplacer progressivement ces mocks par l'etat applicatif reel.
- Le panneau d'export couvre: choix de format (PDF multi-page ou lots PNG/JPG), DPI, qualite JPG, destination texte libre et nommage auto. Les tokens disponibles sont `{date}`, `{time}`, `{counter}`, `{profile}`, `{format}`, `{dpi}` et une previsualisation controle les collisions via un compteur incremente automatiquement.

## Gestion des favoris et configuration (React)
- Le panneau `FavoritesConfigPanel` dans `src/App.tsx` gere les favoris (dossier + format + profil) et les preferences globales (format/profil/nommage par defaut). Il est volontairement tres commente pour guider les nouveaux devs.
- Stockage local: tout est sauvegarde automatiquement dans `localStorage` sous la clef `photon.favorites.config` via le hook `useEffect`. En environnement non navigateur (SSR/build), la lecture est protegee.
- Import/export: boutons JSON declenchent un `input[type=file]` cache et un export Blob pour partager la configuration. Les imports passent par `sanitizeConfig` qui valide les champs et comble les valeurs manquantes a partir de la config courante ou des defaults.
- Typage: `Favorite`, `Preferences` et `UserConfig` centralisent la structure partagee (frontend/back). Pour reutilisation cote Rust/Tauri, conserver ce schema.

## Icônes de l'application
- Source actuelle: `src-tauri/icons/icon.png` (placeholder genere).
- Pour appliquer une identite visuelle: remplacer ce PNG puis lancer `npx tauri icon src-tauri/icons/icon.png` pour regenerer les icones multi-tailles utilisees par Tauri.

## Rappels developpeur
- Lancement dev: `npm run tauri:dev` (frontend Vite sur 5173, app Tauri).
- Build desktop: `npm run tauri:build` (sorties dans `src-tauri/target/release/bundle`).
- Pensez a nettoyer les TODO obsoletes et a synchroniser ce fichier avant de pousser des changements.
