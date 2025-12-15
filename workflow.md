# Workflow de realisation

1) Cadrage fonctionnel
   - Finaliser user stories (mono/multi-page, favoris, nommage auto, filtres, offline).
   - Lister contraintes: OS cibles, acces webcam, limites de stockage, perf attendues.
2) Choix architecture et pile
   - Decider desktop (Electron/Tauri) ou PWA; valider impact sur acces fichiers et webcam.
   - Choisir libs: detection/vision (OpenCV wasm/natif), generation PDF, stockage local.
3) Maquettes UX et parcours
   - Flots: capture, recadrage manuel, multi-page (ajout, ordre, suppression), favoris/config.
   - Ecrans d'erreur/permission webcam et etat sans camera.
4) Mise en place projet
   - Init repo, tooling (format, lint, tests), CI basique.
   - Scaffold app (ex: Vite + React ou stack retenue), theming minimal.
5) Gestion webcam et permissions
   - Acces video, selection de camera, messages d'autorisation, mock video pour tests.
6) Detection et redressement
   - Pipeline auto: detection contours/document, correction de perspective.
   - Mode recadrage manuel comme secours.
7) Traitement d'image
   - Filtres: contraste/niveaux de gris/threshold adaptatif, denoising leger, nettete.
   - Parametrage par profil (ex: texte/photo) et presets rapides.
8) Flux multi-page
   - Capture iterative, liste des pages, re-ordre par glisser, suppression/retake.
   - Sauvegarde temporaire, gestion memoire/poids par page.
9) Export et nommage
   - Export PDF multi-page + PNG/JPG avec options (dpi/qualite).
   - Nommage auto (date, compteur), gestion collisions, metadata basique.
10) Favoris et configuration
    - Creation/edition/suppression de favoris (dossier + format + profil).
    - Stockage local des prefs, import/export de la config.
11) Robustesse et securite
    - Nettoyage fichiers temporaires, gestion faible espace disque, logs debug.
    - Garantir traitement local (pas d'envoi reseau), message sur vie privee.
12) Accessibilite et UX finale
    - Raccourcis clavier, focus visibles, feedback visuel/sonore lors de la capture.
    - Internationalisation pretee (fichiers de traduction), theming basique.
13) Tests et QA
    - Tests unitaires (vision, filtres), tests d'integration sur flux multi-page.
    - Jeux d'images de reference; tests manuels avec webcams reelles.
14) Packaging et distribution
    - Build pour OS cibles; signature si necessaire; configuration auto-update si retenu.
15) Documentation
    - Guide utilisateur (install, capture, export), FAQ permissions webcam.
    - Notes techniques (pipeline image, architecture) et checklists de regression.
