# Workflow de realisation

1) Cadrage fonctionnel
   - [x] User stories validees:
     - [x] Mono-page: capture simple avec recadrage manuel et export PDF/PNG/JPG 1 page.
     - [x] Multi-page: enchainement de captures, re-ordre, suppression/recapture, export PDF multi-page ou lots d'images.
     - [x] Favoris (destinations + profils): creer/editer/supprimer un favori (dossier, format, profil de filtre, nommage par defaut) et lancer un scan via un favori.
     - [x] Nommage auto: modeles ({date}/{heure}/{counter}/{profil}), previsualisation, eviter collisions par increment auto.
     - [x] Filtres/profils d'image: profils (texte/photo/contraste doux) appliques avec apercu, reset possible, reglages simples exposes.
     - [x] Offline seulement: aucune dependance reseau, traitement local et message de rassurance.
   - [x] Contraintes cibles:
     - OS: Windows + macOS + Linux des la v1.
     - Webcam: prompt natif Tauri; si refus -> ecran dedicace avec bouton reessayer (mock video a trancher plus tard).
     - Stockage: pages temporaires sur disque avec purge auto en fin de session; alerte espace faible a ajouter.
     - Perf de reference: cible i5 8e gen / 8 Go / SSD; preview <150 ms, detection/redressement <500 ms/page, export 5 pages 1080p <2 s.
     - Taille/qualite: 1080p par defaut; option "haute qualite" jusqu'a 1440p.
     - Profils image: "texte" = binarisation/threshold adaptatif; "photo" = couleur conservee.
2) Choix architecture et pile
   - [x] Architecture desktop Tauri: frontend React + backend Rust (commandes et traitement).
   - [x] Libs retenues: vision Rust native (`imageproc` + `image` + `fast_image_resize`), PDF (`pdf-writer`), config (`serde` + TOML/JSON + `directories`/`dirs`); fallback wasm/natif OpenCV seulement si indispensable. Licences permissives (MIT/Apache/BSD) uniquement.
3) Maquettes UX et parcours
   - [x] Capture: preview + cadre de detection, boutons Capturer / Qualite (1080p/1440p) / Profil (colonne laterale), Favori rapide; barre d'erreur si aucun document detecte.
   - [x] Permission/refus/absence camera: ecran dedie avec bouton Reessayer (pas de bandeau offline).
   - [x] Post-capture: recadrage manuel plein ecran, rotation 90°, appliquer/annuler, application directe d'un profil.
   - [x] Multi-page: rail de vignettes avec drag-and-drop, supprimer/recapturer par vignette, bouton Ajouter une page toujours visible.
   - [x] Favoris UI: selecteur compact sur capture, modal d'edition (nom, dossier, format, profil, nommage auto), gestion dossier manquant avec fallback/message.
   - [x] Nommage auto: champ modele avec variables suggerees, previsualisation en temps reel, badge collision (increment auto).
   - [x] Filtres/profils: toggle Texte/Photo + bouton Reinitialiser, mini apercu applique sur derniere capture.
   - [x] Export: dialog final (format, qualite 1080p/1440p, dossier, nom pre-rempli), estimation poids/duree.
   - [x] Etats systeme: alerte espace disque faible (<200 Mo) avant capture/export.
4) Mise en place projet
   - [x] Init repo + licence Apache-2.0 + scripts npm de base (lint). Tests/CI a rajouter.
   - [x] Scaffold Tauri + React (frontend) et commandes Rust, theming minimal.
5) Gestion webcam et permissions
   - [ ] Acces video, selection de camera, messages d'autorisation, mock video pour tests.
6) Detection et redressement
   - [ ] Pipeline auto: detection contours/document, correction de perspective, capture automatique.
   - [ ] Mode recadrage manuel comme secours.
7) Traitement d'image
   - [ ] Filtres: contraste/niveaux de gris/threshold adaptatif, denoising leger, nettete.
   - [ ] Parametrage par profil (ex: texte/photo) et presets rapides.
8) Flux multi-page
   - [ ] Capture iterative, liste des pages, re-ordre par glisser, suppression/retake.
   - [ ] Sauvegarde temporaire, gestion memoire/poids par page.
9) Export et nommage
   - [ ] Export PDF multi-page + PNG/JPG avec options (dpi/qualite).
   - [ ] Nommage auto (date, compteur), gestion collisions, metadata basique.
10) Favoris et configuration
    - [ ] Creation/edition/suppression de favoris (dossier + format + profil).
    - [ ] Stockage local des prefs, import/export de la config.
11) Robustesse et securite
    - [ ] Nettoyage fichiers temporaires, gestion faible espace disque.
    - [x] Logs debug (console + fichier) en place; tracer completement le pipeline capture/detection/export.
    - [ ] Garantir traitement local (pas d'envoi reseau), message sur vie privee.
12) Accessibilite et UX finale
    - [ ] Raccourcis clavier, focus visibles, feedback visuel/sonore lors de la capture.
    - [x] Internationalisation pretee (fichiers de traduction), theming basique.
13) Tests et QA
    - [ ] Tests unitaires (vision, filtres), tests d'integration sur flux multi-page.
    - [ ] Jeux d'images de reference; tests manuels avec webcams reelles.
14) Packaging et distribution
    - [ ] Build Tauri pour Windows/Linux/macOS; signature/code signing si necessaire; auto-update via Tauri si retenu.
    - [ ] Plus tard: remplacer `src-tauri/icons/icon.png` par l'identite visuelle finale puis lancer `npx tauri icon src-tauri/icons/icon.png` pour regenerer les icones multi-tailles.
15) Documentation developpeur (pas de guide utilisateur)
    - [x] Notes techniques pour les devs (logger, commandes Tauri, i18n) dans `DOCUMENTATION.md`.
    - [ ] Guide developpeur complet: install, pipeline image/architecture, checklists de regression, FAQ permissions webcam.
