# Guide d'Installation et de Configuration de l'Imprimante Thermique Xprinter (80 mm)

**Application:** EDUPILOT DZ  
**Système d'Exploitation:** Windows 10 / Windows 11 (64-bit)  
**Type d'imprimante:** Imprimante de caisse thermique USB (Xprinter 80 mm / 58 mm)

---

## 1. Vue d'Ensemble du Problème Résolu

Lors de l'utilisation d'une imprimante thermique sous Windows avec une application de bureau, **le problème de caractères chinois ou de symboles aléatoires (charabia)** survient dans les cas suivants :
1. **Pilote générique incorrect :** L'imprimante est installée avec le pilote Windows *"Generic / Text Only"*. Ce pilote envoie le flux graphique raster sous forme de texte brut, ce qui fait basculer la puce de l'imprimante en mode texte chinois (GBK/Big5).
2. **Dimension de papier inadaptée :** L'impression est lancée avec un format bureau A4 standard au lieu d'un rouleau continu de 80 mm.
3. **Absence de sélection d'imprimante :** L'application envoyait les données à une imprimante de bureau (comme une Canon MF3010) ou à l'imprimante par défaut.

---

## 2. Procédure d'Installation Étape par Étape

Suivez rigoureusement ces 10 étapes pour garantir une impression nette et sans défaut :

### Étape 1 : Identifier le Modèle Exact de l'Imprimante
- Vérifiez l'étiquette sous ou à l'arrière de l'appareil.
- Modèles 80 mm courants : **Xprinter XP-N160II, XP-Q90EC, XP-80C, XP-D200N, XP-T80A, XP-C300H**.
- Modèles 58 mm courants : **XP-58IIH, XP-5870H, XP-V58M**.

### Étape 2 : Télécharger et Installer le Pilote Officiel Xprinter
> [!IMPORTANT]
> **NE JAMAIS UTILISER LE PILOTE WINDOWS "GENERIC / TEXT ONLY" !**  
> Le pilote *"Générique / Texte seul"* ne prend pas en charge le rendu graphique de Chromium et provoquera l'impression de kilomètres de hiéroglyphes/caractères chinois.

1. Téléchargez le pack de pilotes officiel : **Xprinter POS Printer Driver** (version 7.77 ou 8.0 pour Windows).
2. Exécutez le programme d'installation en tant qu'administrateur (`Setup.exe`).
3. Sélectionnez le système d'exploitation (**Windows 10 / 11**).
4. Choisissez le type d'imprimante :
   - **POS-80 Series** (pour les rouleaux 80 mm)
   - **POS-58 Series** (pour les rouleaux 58 mm)
5. Sélectionnez le port : **USB** (ou laissez le détecteur automatique USB).
6. Cliquez sur **Install** (Installer).

### Étape 3 : Raccordement Physique
1. Branchez le câble d'alimentation de l'imprimante sur secteur.
2. Raccordez le câble USB directement sur un port USB de l'ordinateur (évitez les hubs USB non alimentés).
3. Insérez un rouleau de papier thermique de 80 mm dans le bon sens (face thermosensible vers le haut / vers la tête d'impression).
4. Mettez l'imprimante sous tension (le voyant bleu/vert **POWER** doit être allumé fixe, pas de voyant d'erreur rouge clignotant).

### Étape 4 : Vérifier l'Imprimante dans Windows
1. Ouvrez le menu Démarrer de Windows > **Paramètres** > **Périphériques** > **Imprimantes et scanners** (ou `control printers`).
2. Confirmez la présence de l'imprimante, par exemple : `POS-80` ou `Xprinter POS-80C`.

### Étape 5 : Ouvrir les Propriétés du Matériel
1. Cliquez sur l'imprimante dans la liste > **Gérer** > **Propriétés de l'imprimante** (Printer properties).
2. Vérifiez que l'onglet **Ports** pointe bien sur le port `USB001` (ou `USB002` correspondant à l'imprimante connectée).

### Étape 6 : Imprimer une Page de Test Windows
Dans l'onglet **Général** des Propriétés de l'imprimante :
- Cliquez sur **Imprimer une page de test** (Print Test Page).

> [!CAUTION]
> **Règle de diagnostic essentielle :**
> - **Si la page de test Windows sort illisible ou avec du charabia :** Le problème vient du câble USB, du port sélectionné ou du pilote Windows. Ne continuez pas tant que la page de test Windows n'est pas parfaitement lisible.
> - **Si la page de test Windows est propre et nette :** Le pilote Windows fonctionne correctement et l'application Edupilot DZ peut désormais communiquer avec elle.

### Étape 7 : Définir la Taille de Papier à 80 mm
1. Toujours dans les Propriétés de l'imprimante > onglet **Options avancées** ou **Paramètres du périphérique**.
2. Définissez le format de papier par défaut sur :
   - `80 x Receipt` ou `80 x 297 mm` ou `Roll Paper 80 x 297 mm`.
3. Cliquez sur **Appliquer** puis **OK**.

### Étape 8 : Ouvrir Edupilot DZ > Paramètres > Impression
1. Démarrez l'application **Edupilot DZ**.
2. Connectez-vous avec votre compte administrateur.
3. Dans la barre latérale, cliquez sur **Paramètres** (ou l'icône d'engrenage).
4. Cliquez sur l'onglet **Impression** (avec l'icône de l'imprimante).

### Étape 9 : Sélectionner l'Imprimante Xprinter
1. Dans la liste déroulante **Sélectionner l'imprimante de reçus**, sélectionnez votre imprimante (ex: `POS-80` ou `Xprinter POS-80`).
2. Vérifiez que la largeur de papier est réglée sur **80 mm (Standard - Recommandé)**.
3. Conservez l'option **Afficher la boîte de dialogue d'impression** activée lors des premiers essais pour vérifier visuellement le choix de l'imprimante par Windows.
4. Cliquez sur **Enregistrer les paramètres**.

### Étape 10 : Lancer le Test d'Impression Edupilot
1. Dans la section **Test d'impression**, cliquez sur le bouton noir **[ Imprimer un ticket de test ]**.
2. Le ticket suivant doit être imprimé instantanément :
   ```
   --------------------------------
   EDUPILOT DZ
   Printer test

   Arabic: اختبار الطابعة
   Français: Test imprimante
   English: Printer test

   1234567890
   5,000 DZD
   ----------------
   PRINT OK
   --------------------------------
   ```
3. Vérifiez la netteté du texte arabe (connecté de droite à gauche), des montants et de la coupe de papier.

---

## 3. Matrice de Tests et Validation

| Test | Intitulé | Résultat Attendu |
| :--- | :--- | :--- |
| **A** | Page de test Windows | Texte Windows lisible et aligné |
| **B** | Test d'impression Edupilot | Ticket trilingue lisible, arabe RTL parfait |
| **C** | Reçu en Français | Logo / En-tête, détails élève et montant DZD |
| **D** | Reçu en Anglais | Alignement LTR et montants exacts |
| **E** | Reçu en Arabe | Police Amiri locale, lettres liées, RTL |
| **F** | Deux reçus consécutifs | Deux tickets séparés, aucun résidu ni charabia |
| **G** | Sauvegarde Reçu en PDF | Fichier PDF vectoriel parfait et consultable |

---

## 4. Dépannage et Résolution des Problèmes

### L'imprimante n'apparaît pas dans la liste des Paramètres
- Cliquez sur le bouton **Actualiser la liste des imprimantes** (icône circulaire à droite du titre).
- Vérifiez que le câble USB est branché et que l'imprimante est allumée.
- Vérifiez dans le Gestionnaire de périphériques Windows si un périphérique USB non reconnu apparaît.

### L'alerte "Imprimante non disponible" apparaît lors du paiement
- Edupilot DZ bloque intentionnellement l'impression si l'imprimante configurée a été débranchée ou renommée, afin d'éviter d'envoyer le reçu par erreur sur une imprimante A4 ou vers Microsoft Print to PDF.
- Rebranchez l'imprimante ou sélectionnez la nouvelle imprimante active dans **Paramètres > Impression**.

### Le texte arabe apparaît sous forme de rectangles ou points d'interrogation
- La police **Amiri** est directement embarquée dans l'application Edupilot DZ. Si cela se produit, vérifiez que le pilote n'est pas configuré en mode texte brut (Generic Text Only), mais bien en pilote graphique POS.
