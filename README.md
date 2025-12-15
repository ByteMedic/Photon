# Photon - Scanner via webcam

Application de scan par webcam qui detecte automatiquement le document, redresse l'image, rogne les bords et exporte en PDF, PNG ou JPG. L'utilisateur peut choisir un dossier d'export, definir des favoris (chemin + format) et beneficier d'un traitement d'image automatique pour ameliore contraste et lisibilite. Les scans peuvent contenir plusieurs pages.

## Fonctionnalites ciblees
- Acquisition par webcam avec apercu en temps reel, detection du document et redressement automatique.
- Recadrage manuel en cas d'echec ou pour ajuster finement la zone.
- Traitement d'image automatique (contraste, nettete, suppression du bruit, binarisation optionnelle).
- Gestion multi-pages: capture, re-ordre, suppression, reprise d'une page.
- Export en PDF (multi-page), PNG ou JPG avec parametres de resolution/qualite.
- Favoris de destinations: chaque favori associe dossier, format et nommage par defaut.
- Configuration des formats par defaut, dossier courant, et profils de scan (ex: "texte", "photo").
- Historique recent (optionnel) pour retrouver les derniers exports.

## Points a anticiper
- Securite/vie privee: traitement local uniquement, pas d'envoi reseau; clarifier permissions webcam.
- Compatibilite peripheriques: selection de camera, bascule avant/arriere sur portable, detection absence camera.
- Accessibilite: navigation clavier, contraste de l'UI, feedback voix/son optionnel lors de la capture.
- UX de capture: indicateur de stabilite/cadrage, timer de prise de vue optionnel, mode auto-capture quand le document est stable.
- Ajustements post-capture: rotation, recadrage manuel, filtres predefinis (noir et blanc, niveaux de gris, couleur).
- Nommage automatique: modeles avec variables (date, heure, index, titre), eviter les collisions de fichiers.
- Robustesse: reprises apres erreur, fichiers temporaires nettoyes, avertissement si espace disque faible.
- Internationalisation: textes previsibles pour traduction si besoin.
- OCR (optionnel): export avec texte extrait pour recherche; a cadrer selon perimetre.

## Choix techniques a arbitrer
- Cible: application desktop (Electron/Tauri) pour acces fichiers natif et webcam; ou web app (PWA) si l'usage navigateur suffit.
- Traitement d'image: OpenCV (WASM ou natif), ou pipelines maison pour detection de contours + perspective + filtres (threshold adaptatif, CLAHE).
- Generation PDF: moteur cote client (pdf-lib, pdfkit) ou via binding natif si besoin de compression plus fine.
- Stockage local: fichiers config JSON + chemin utilisateur; ou base locale (SQLite/IndexedDB selon la plateforme).
- Tests: mocks de camera (videos d'exemple), golden images pour verifier redressement et filtres.

## Flux utilisateur cible
1) Lancer l'appli et choisir un profil/favori ou un format et dossier manuels.  
2) Presenter le document; l'appli detecte les bords et affiche un cadre.  
3) Capturer; l'image est redressee et amelioree, avec option de recadrage manuel.  
4) Refaire/ajouter des pages, re-ordonner si besoin.  
5) Exporter via favori ou choix manuel; confirmer le nom et le dossier.

## Livrables attendus pour la v1
- Capture et detection de document stable avec recadrage manuel.
- Pipeline de traitement (redressement, filtre lisibilite) robuste sur documents courants.
- Export PDF multi-page + PNG/JPG avec controle qualite.
- Systemes de favoris et de profils simples (format + dossier + nommage auto).
- Tests basiques sur detection/traitement et sur le flux multi-pages.
- Documentation utilisateur succincte et guide de configuration.
