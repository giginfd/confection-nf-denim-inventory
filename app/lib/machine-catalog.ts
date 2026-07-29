import { machineResearchFamilies } from "./machine-research-family-seed";

export type MachineStage =
  | "Coupe et préparation"
  | "Couture et assemblage"
  | "Surpiqûres et opérations spéciales"
  | "Ceintures et passants"
  | "Boutonnières, boutons et points d’arrêt"
  | "Automatisation et accessoires"
  | "Coupe / préparation matière"
  | "Assemblage — couture principale"
  | "Assemblage — couture surjet / recouvrement"
  | "Assemblage — poches / automatisation"
  | "Assemblage — renforts / passants"
  | "Assemblage — automatisation / attachements"
  | "Finition — boutonnières"
  | "Finition — pose de boutons / boutonnières"
  | "Utilités — motorisation / entraînement";

export type MachineStatus = "confirmé" | "à vérifier" | "à confirmer";

export type MachineReferenceImage = {
  publicPath: string;
  visualMatch: string;
  sourceUrl: string;
  sourceEvidenceType: string;
  useNote: string;
  publicationRecommendation: string;
  rightsAttribution: string;
};

export type MachineCatalogEntry = {
  id: string;
  manufacturer: string;
  model: string;
  stage: MachineStage;
  linkedRecords: number;
  status: MachineStatus;
  searchTerm: string;
  searchTerms?: string[];
  note: string;
  instructionUrl?: string;
  partsUrl?: string;
  masterFamilyId?: string;
  originalLabelsPreserved?: string;
  reclassificationAction?: string;
  alternateNames?: string;
  isCustom?: boolean;
  image?: MachineReferenceImage;
};

// Research-backed families from machine_master_list.csv. This catalogue is
// deliberately separate from the legacy inventory field: corrections to a
// family never overwrite the original recovered machine label.
const initialMachineCatalog: MachineCatalogEntry[] = [
  { id: "reece-101", manufacturer: "Reece", model: "101", stage: "Boutonnières, boutons et points d’arrêt", linkedRecords: 221, status: "confirmé", searchTerm: "REECE 101", note: "Série confirmée; configuration exacte à valider." },
  { id: "juki-lk-980", manufacturer: "Juki", model: "LK-980", stage: "Boutonnières, boutons et points d’arrêt", linkedRecords: 160, status: "confirmé", searchTerm: "LK-980", note: "Point d’arrêt; sous-modèle à confirmer." },
  { id: "brother-ma4-b551", manufacturer: "Brother", model: "MA4-B551", stage: "Surpiqûres et opérations spéciales", linkedRecords: 126, status: "confirmé", searchTerm: "MA4-B551", note: "Modèle confirmé; compatibilités partagées à vérifier." },
  { id: "brother-db2-b715", manufacturer: "Brother", model: "DB2-B715", stage: "Couture et assemblage", linkedRecords: 125, status: "confirmé", searchTerm: "DB2-B715", note: "Sous-classe de tête à confirmer." },
  { id: "singer-269w", manufacturer: "Singer", model: "269W", stage: "Boutonnières, boutons et points d’arrêt", linkedRecords: 113, status: "confirmé", searchTerm: "TAKER SINGER", note: "Ancien libellé TAKER SINGER associé au 269W." },
  { id: "brother-bas-760", manufacturer: "Brother", model: "BAS-760", stage: "Surpiqûres et opérations spéciales", linkedRecords: 101, status: "confirmé", searchTerm: "BAS-760", note: "Composants de pose de poche à valider individuellement." },
  { id: "union-special-56900j", manufacturer: "Union Special", model: "56900J", stage: "Surpiqûres et opérations spéciales", linkedRecords: 96, status: "confirmé", searchTerm: "56900J", note: "Famille 56900 confirmée; configuration exacte à valider." },
  { id: "brother-lt2-b872", manufacturer: "Brother", model: "LT2-B872", stage: "Couture et assemblage", linkedRecords: 76, status: "confirmé", searchTerm: "LT2-B872", note: "Sous-classe -405/-407 ou Mark II à confirmer." },
  { id: "reece-s2", manufacturer: "Reece", model: "S2", stage: "Boutonnières, boutons et points d’arrêt", linkedRecords: 72, status: "confirmé", searchTerm: "REECE S2", note: "Série confirmée; type S2 précis à valider." },
  { id: "brother-ef4-b956c", manufacturer: "Brother", model: "EF4-B956C", stage: "Surpiqûres et opérations spéciales", linkedRecords: 62, status: "confirmé", searchTerm: "EF4-B956C", note: "Compatibilités MA4-B551 partagées à confirmer." },
  { id: "brother-dh4-b980", manufacturer: "Brother", model: "DH4-B980", stage: "Boutonnières, boutons et points d’arrêt", linkedRecords: 36, status: "confirmé", searchTerm: "DH4-B980", note: "Vérifier B980 ou B981 sur la plaque." },
  { id: "brother-bas-301", manufacturer: "Brother", model: "BAS-301", stage: "Surpiqûres et opérations spéciales", linkedRecords: 31, status: "confirmé", searchTerm: "BAS 301", note: "Configuration Profile M à confirmer." },
  { id: "juki-lk-1850", manufacturer: "Juki", model: "LK-1850", stage: "Boutonnières, boutons et points d’arrêt", linkedRecords: 26, status: "confirmé", searchTerm: "LK-1850", note: "Sous-classe à lit cylindrique à confirmer." },
  { id: "brother-ma4-v92", manufacturer: "Brother", model: "MA4-V92", stage: "Surpiqûres et opérations spéciales", linkedRecords: 24, status: "confirmé", searchTerm: "MA4-V92", note: "Sous-classe et jauge à vérifier." },
  { id: "brother-bas-341a", manufacturer: "Brother", model: "BAS-341A", stage: "Surpiqûres et opérations spéciales", linkedRecords: 17, status: "confirmé", searchTerm: "BAS-341A", note: "Configuration de serrage à vérifier." },
  { id: "brother-ef4-b531", manufacturer: "Brother", model: "EF4-B531", stage: "Surpiqûres et opérations spéciales", linkedRecords: 17, status: "confirmé", searchTerm: "EF4-B531", note: "Documents partagés avec d’autres modèles." },
  { id: "union-special-35800dm", manufacturer: "Union Special", model: "35800DM", stage: "Surpiqûres et opérations spéciales", linkedRecords: 15, status: "confirmé", searchTerm: "35800DM", note: "Produits à valider dans le livre de pièces." },
  { id: "union-special-63900m", manufacturer: "Union Special", model: "63900M", stage: "Surpiqûres et opérations spéciales", linkedRecords: 14, status: "confirmé", searchTerm: "63900M", note: "Suffixe installé à confirmer." },
  { id: "brother-bas-311a", manufacturer: "Brother", model: "BAS-311A", stage: "Surpiqûres et opérations spéciales", linkedRecords: 13, status: "confirmé", searchTerm: "BAS-311A", note: "Profil / serrage à confirmer." },
  { id: "brother-ef4-n21", manufacturer: "Brother", model: "EF4-N21", stage: "Surpiqûres et opérations spéciales", linkedRecords: 10, status: "confirmé", searchTerm: "EF4-N21", note: "Sous-classe N21 à confirmer." },
  { id: "brother-lt2-b875", manufacturer: "Brother", model: "LT2-B875", stage: "Couture et assemblage", linkedRecords: 6, status: "confirmé", searchTerm: "LT2-B875", note: "Sous-classe -407 / Mark II à confirmer." },
  { id: "mitsubishi-dn-267", manufacturer: "Mitsubishi", model: "DN-267", stage: "Couture et assemblage", linkedRecords: 6, status: "confirmé", searchTerm: "DN-267", note: "Catalogue de pièces commun à la série DN-260/267." },
  { id: "eastman-629", manufacturer: "Eastman", model: "Blue Streak II 629", stage: "Coupe et préparation", linkedRecords: 3, status: "confirmé", searchTerm: "EASTMAN 629", note: "Configuration électrique et lame à confirmer." },
  { id: "brother-ma4-v91", manufacturer: "Brother", model: "MA4-V91", stage: "Surpiqûres et opérations spéciales", linkedRecords: 2, status: "confirmé", searchTerm: "MA4-V91", note: "Sous-classe et jauge à vérifier." },
  { id: "union-special-35800dn", manufacturer: "Union Special", model: "35800DN", stage: "Surpiqûres et opérations spéciales", linkedRecords: 198, status: "confirmé", searchTerm: "35800DN", note: "Famille confirmée dans le manuel de pièces." },
  { id: "brother-db2-b716", manufacturer: "Brother", model: "DB2-B716", stage: "Couture et assemblage", linkedRecords: 116, status: "confirmé", searchTerm: "DB2-B716", note: "Sous-classe à confirmer." },
  { id: "brother-lt2-b832", manufacturer: "Brother", model: "LT2-B832", stage: "Couture et assemblage", linkedRecords: 114, status: "confirmé", searchTerm: "LT2-B832", note: "Manuel de pièces exact; manuel opérateur à trouver." },
  { id: "kansai-w-842", manufacturer: "Kansai Special", model: "W-842", stage: "Ceintures et passants", linkedRecords: 55, status: "confirmé", searchTerm: "W-842", note: "Suffixe à confirmer." },
  { id: "kansai-w-8042", manufacturer: "Kansai Special", model: "W-8042", stage: "Ceintures et passants", linkedRecords: 44, status: "confirmé", searchTerm: "W-8042", note: "Vérifier W-8042 ou W-8042-1." },
  { id: "juki-mb-372-373", manufacturer: "Juki", model: "MB-372 / MB-373", stage: "Boutonnières, boutons et points d’arrêt", linkedRecords: 39, status: "à vérifier", searchTerm: "BENZ", note: "Famille établie; photographier la plaque pour distinguer 372 et 373." },
  { id: "rimoldi-264", manufacturer: "Rimoldi", model: "264", stage: "Surpiqûres et opérations spéciales", linkedRecords: 16, status: "confirmé", searchTerm: "RIMOLDI 264", note: "Sous-modèle 264 à vérifier sur la plaque." },
  { id: "brother-lt2-b833", manufacturer: "Brother", model: "LT2-B833", stage: "Couture et assemblage", linkedRecords: 14, status: "confirmé", searchTerm: "LT2-B833", note: "Sous-classe -603 indiquée dans les données." },
  { id: "brother-db2-b737", manufacturer: "Brother", model: "DB2-B737", stage: "Couture et assemblage", linkedRecords: 11, status: "confirmé", searchTerm: "DB2-B737", note: "Vérifier Mark I/II/III." },
  { id: "brother-db2-b755", manufacturer: "Brother", model: "DB2-B755", stage: "Couture et assemblage", linkedRecords: 6, status: "confirmé", searchTerm: "DB2-B755", note: "Vérifier la version avant commande." },
  { id: "brother-db2-b724", manufacturer: "Brother", model: "DB2-B724", stage: "Couture et assemblage", linkedRecords: 4, status: "confirmé", searchTerm: "DB2-B724", note: "Utiliser la sous-classe -405 lors de la commande." },
  { id: "union-special-63900", manufacturer: "Union Special", model: "63900", stage: "Surpiqûres et opérations spéciales", linkedRecords: 141, status: "confirmé", searchTerm: "63900", note: "Série; identifier le suffixe lorsque possible." },
  { id: "clinton-199", manufacturer: "Clinton Industries", model: "Model 199 (pour Union Special 63900)", stage: "Automatisation et accessoires", linkedRecords: 51, status: "à vérifier", searchTerm: "CLINTON", note: "Attachement coupe-fil probable, pas une tête de machine autonome." },
  { id: "pfaff-1291", manufacturer: "Pfaff", model: "1291", stage: "Couture et assemblage", linkedRecords: 31, status: "confirmé", searchTerm: "PFAFF 1291", note: "Référence de modèle confirmée; manuel opérateur à compléter." },
  { id: "juki-mo-3900", manufacturer: "Juki", model: "MO-3900", stage: "Surpiqûres et opérations spéciales", linkedRecords: 8, status: "à vérifier", searchTerm: "MO-3900", note: "Série confirmée; sous-classe nécessaire pour les pièces." },
  { id: "juki-mo-3914", manufacturer: "Juki", model: "MO-3914", stage: "Surpiqûres et opérations spéciales", linkedRecords: 3, status: "à vérifier", searchTerm: "MO-3914", note: "Manuel de la série; livre de pièces exact à trouver." },
  { id: "union-special-35800", manufacturer: "Union Special", model: "35800", stage: "Surpiqûres et opérations spéciales", linkedRecords: 3, status: "à vérifier", searchTerm: "35800", note: "Série; confirmer le suffixe." },
  { id: "brother-bas-304a", manufacturer: "Brother", model: "BAS-304A", stage: "Surpiqûres et opérations spéciales", linkedRecords: 2, status: "à vérifier", searchTerm: "BAS-304A", note: "Manuel de service identifié; livre de pièces à trouver." },
  { id: "eastman-d2h", manufacturer: "Eastman", model: "D2H", stage: "Coupe et préparation", linkedRecords: 2, status: "confirmé", searchTerm: "D2H", note: "Vérifier la lame et la tension électrique." },
  { id: "willcox-515-4", manufacturer: "Willcox & Gibbs", model: "515-4", stage: "Surpiqûres et opérations spéciales", linkedRecords: 75, status: "à vérifier", searchTerm: "515-4", note: "Famille confirmée; sous-classe à relever." },
  { id: "willcox-515", manufacturer: "Willcox & Gibbs", model: "515", stage: "Surpiqûres et opérations spéciales", linkedRecords: 23, status: "à vérifier", searchTerm: "WILLCOX 515", searchTerms: ["WILLCOX 515", "WILLCOX GIBBS 515", "WILLCOX GIBBS 515/532", "WILCOX 515-E", "WILLCOX 515-E32-440"], note: "Famille seulement; modèle complet à relever." },
  { id: "singer-302w401", manufacturer: "Singer", model: "302W401", stage: "Ceintures et passants", linkedRecords: 22, status: "confirmé", searchTerm: "302X401", note: "Machine de ceinture quatre rangées; livre de pièces exact à trouver." },
  { id: "juki-lh-1152", manufacturer: "Juki", model: "LH-1152", stage: "Couture et assemblage", linkedRecords: 18, status: "à vérifier", searchTerm: "LH-1152", note: "Les données indiquent -4 et -5; relever la plaque." },
  { id: "brother-bas-341", manufacturer: "Brother", model: "BAS-341", stage: "Surpiqûres et opérations spéciales", linkedRecords: 6, status: "à vérifier", searchTerm: "BAS 341", note: "Ne pas supposer que BAS-341A est identique." },
  { id: "willcox-e32", manufacturer: "Willcox & Gibbs", model: "E32", stage: "Surpiqûres et opérations spéciales", linkedRecords: 67, status: "à vérifier", searchTerm: "E32", searchTerms: ["WILLCOX E32", "WILLCOX E 32", "WILCOX E32", "WILLCOX E-32", "WILLCOX E32-440", "WILLCOX E32-515"], note: "Marque et sous-classe à confirmer sur la plaque." },
  { id: "singer-302w", manufacturer: "Singer", model: "302W", stage: "Ceintures et passants", linkedRecords: 60, status: "à confirmer", searchTerm: "WASBAND", note: "Famille de ceinture probable; confirmer avant association définitive." },
  { id: "eastlex", manufacturer: "Eastlex", model: "Robot / attachement de passants", stage: "Automatisation et accessoires", linkedRecords: 42, status: "à confirmer", searchTerm: "EASTLEX", note: "Attachement identifié; modèle et machine parente inconnus." },
  { id: "galkin", manufacturer: "Galkin", model: "Système d’automatisation", stage: "Automatisation et accessoires", linkedRecords: 39, status: "à confirmer", searchTerm: "GALKIN", note: "Système d’attachement, non une tête de machine confirmée." },
  { id: "willcox-e332", manufacturer: "Willcox & Gibbs", model: "E332", stage: "Surpiqûres et opérations spéciales", linkedRecords: 23, status: "à vérifier", searchTerm: "E332", note: "Libellé identifié; manuel et sous-classe à rechercher." },
  { id: "brother-ma4-b851", manufacturer: "Brother", model: "MA4-B851", stage: "Surpiqûres et opérations spéciales", linkedRecords: 2, status: "à vérifier", searchTerm: "MA4-B851", note: "Libellé identifié; manuel à rechercher." },
  { id: "union-special-63900dm", manufacturer: "Union Special", model: "63900DM", stage: "Surpiqûres et opérations spéciales", linkedRecords: 2, status: "à vérifier", searchTerm: "63900DM", note: "Libellé identifié; manuel à rechercher." },
];

const documentationById: Record<string, Pick<MachineCatalogEntry, "instructionUrl" | "partsUrl">> = {
  "reece-101": { instructionUrl: "https://www.supsew.com/download/Reece/Reece%20101%20Service%20Manual.pdf", partsUrl: "https://www.szwalnicze.com/cat_reece/reece_s-101.pdf" },
  "juki-lk-980": { instructionUrl: "https://www.supsew.com/download/Juki/Juki%20LK-980%20Instruction%20Manual.pdf", partsUrl: "https://www.supsew.com/download/Juki/Juki%20LK-980.pdf" },
  "brother-ma4-b551": { instructionUrl: "https://www.supsew.com/wpfb-file/brother-ef4-b511-b531-ma4-b551-instruction-manual-pdf/", partsUrl: "https://www.supsew.com/download/Brother/Brother%20MA4-B551.pdf" },
  "brother-db2-b715": { instructionUrl: "https://www.supsew.com/wpfb-file/brother-db2-b715-instruction-manual-pdf/", partsUrl: "https://www.maquinasuniao.com.br/wp-content/themes/maquinas-uniao/catalogos/loop-11/Brother%20DB2-B715-100%2C%20-200%2C%20-400%2C%20-500.pdf" },
  "singer-269w": { instructionUrl: "https://www.supsew.com/download/Singer/Singer%20269W.pdf", partsUrl: "https://www.supsew.com/download/Singer/Singer%20269W.pdf" },
  "brother-bas-760": { instructionUrl: "https://www.maquinasuniao.com.br/wp-content/themes/maquinas-uniao/catalogos/loop-11/Brother%20BAS-760%20Instruction%20Manual.pdf", partsUrl: "https://www.maquinasuniao.com.br/wp-content/themes/maquinas-uniao/catalogos/loop-11/Brother%20BAS-760.pdf" },
  "union-special-56900j": { instructionUrl: "https://www.supsew.com/download/Union%20Special/Union%20Special%2056200%2C%2056300%2C%2056400%2C%2056500%2C%2056700%20and%2056900.pdf", partsUrl: "https://www.supsew.com/download/Union%20Special/Union%20Special%2056200%2C%2056300%2C%2056400%2C%2056500%2C%2056700%20and%2056900.pdf" },
  "brother-lt2-b872": { instructionUrl: "https://www.supsew.com/wpfb-file/brother-lt2-b841-b842-b845-b847-b848-b872-b875-instruction-manual-pdf/", partsUrl: "https://www.szwalnicze.com/cat_brother/brother_LT2-B872.pdf" },
  "reece-s2": { instructionUrl: "https://www.supsew.com/download/Reece/Reece%20S2%20Instruction%20Manual.pdf", partsUrl: "https://www.supsew.com/download/Reece/Reece%20S2%20Instruction%20Manual.pdf" },
  "brother-ef4-b956c": { instructionUrl: "https://www.maquinasuniao.com.br/wp-content/themes/maquinas-uniao/catalogos/loop-11/Brother%20EF4-B956C.pdf", partsUrl: "https://www.maquinasuniao.com.br/wp-content/themes/maquinas-uniao/catalogos/loop-11/Brother%20EF4-B956C.pdf" },
  "brother-dh4-b980": { instructionUrl: "https://supsew.cld.bz/Brother-DH4-B980-B981-Instruction-Manual/3/", partsUrl: "https://www.diamondneedle.com/documents/BROTHER%20Parts%20Manual/DH4-B980.pdf" },
  "brother-bas-301": { instructionUrl: "https://semsi.com.mx/Manuales/BROTHER/BAS%20301%20instruction%20manuel.pdf", partsUrl: "https://shvejnik.com.ua/media/downloads/1701/Brother%20BAS-301.pdf" },
  "juki-lk-1850": { instructionUrl: "https://www.supsew.com/download/Juki/Juki%20LK-1850%20Engineer%E2%80%99s%20Manual.pdf", partsUrl: "https://www.supsew.com/download/Juki/Juki%20LK-1850.pdf" },
  "brother-ma4-v92": { instructionUrl: "https://www.supsew.com/download/Brother/Brother%20EF4%20and%20MA4%20V-series%20Service%20Manual.pdf", partsUrl: "https://www.supsew.com/download/Brother/Brother%20MA4-V91%2C%20-V92.pdf" },
  "brother-bas-341a": { instructionUrl: "https://semsi.com.mx/Manuales/BROTHER/BAS-341A-342A%20Instruction%20Manuel.pdf", partsUrl: "https://www.szwalnicze.com/cat_brother/brother_BAS-341A.pdf" },
  "brother-ef4-b531": { instructionUrl: "https://www.supsew.com/wpfb-file/brother-ef4-b511-b531-ma4-b551-instruction-manual-pdf/", partsUrl: "https://www.szwalnicze.com/cat_brother/brother_EF4-B531.pdf" },
  "union-special-35800dm": { instructionUrl: "https://www.notice-facile.com/en/manual/1088893/union%2Bspecial%2B35800dm", partsUrl: "https://www.supsew.com/download/Union%20Special/Union%20Special%2035800DK%2C%20DL%2C%20DM%20and%20DN.pdf" },
  "union-special-63900m": { instructionUrl: "https://www.supsew.com/download/Union%20Special/Union%20Special%2063900M%2C%20T%2C%20W%20and%20AE.pdf", partsUrl: "https://www.supsew.com/download/Union%20Special/Union%20Special%2063900M%2C%20T%2C%20W%20and%20AE.pdf" },
  "brother-bas-311a": { instructionUrl: "https://www.supsew.com/download/Brother/Brother%20BAS-311A%20%20Instruction%20Manual.pdf", partsUrl: "https://www.maquinasuniao.com.br/wp-content/themes/maquinas-uniao/catalogos/loop-11/Brother%20BAS-311A.pdf" },
  "brother-ef4-n21": { instructionUrl: "https://www.supsew.com/wpfb-file/brother-ef4-n11-n21-ma4-n31-instruction-manual-pdf/", partsUrl: "https://www.maquinasuniao.com.br/wp-content/themes/maquinas-uniao/catalogos/loop-11/Brother%20EF4-N21.pdf" },
  "brother-lt2-b875": { instructionUrl: "https://www.supsew.com/wpfb-file/brother-lt2-b841-b842-b845-b847-b848-b872-b875-instruction-manual-pdf/", partsUrl: "https://www.supsew.com/download/Brother/Brother%20LT2-B875.pdf" },
  "mitsubishi-dn-267": { instructionUrl: "https://manualmachine.com/mitsubishi/dn260/8327208-user-manual/", partsUrl: "https://www.maquinasuniao.com.br/wp-content/themes/maquinas-uniao/catalogos/loop-57/Mitsubishi%20DN-260%2C%20DN-262%2C%20DN-265%2C%20DN-267.pdf" },
  "eastman-629": { instructionUrl: "https://www.supsew.com/download/Cutting%20Machines/Eastman%20627X%20-%20629X%20Instruction%20Manual.pdf", partsUrl: "https://www.supsew.com/download/Cutting%20Machines/Eastman%20627X%20-%20629X%20Instruction%20Manual.pdf" },
  "brother-ma4-v91": { instructionUrl: "https://www.supsew.com/download/Brother/Brother%20EF4%20and%20MA4%20V-series%20Service%20Manual.pdf", partsUrl: "https://www.supsew.com/download/Brother/Brother%20MA4-V91%2C%20-V92.pdf" },
  "union-special-35800dn": { partsUrl: "https://www.supsew.com/download/Union%20Special/Union%20Special%2035800DK%2C%20DL%2C%20DM%20and%20DN.pdf" },
  "brother-db2-b716": { instructionUrl: "https://www.sewingparts.co.uk/library/brother-db2-b716.html", partsUrl: "https://www.szwalnicze.com/cat_brother/brother_DB2-B716.pdf" },
  "brother-lt2-b832": { partsUrl: "https://www.supsew.com/download/Brother/Brother%20LT2-B832.pdf" },
  "kansai-w-842": { partsUrl: "https://shvejnik.com.ua/media/downloads/2179/Kansai%20W-8042%2C%20W8042-1.pdf" },
  "kansai-w-8042": { partsUrl: "https://shvejnik.com.ua/media/downloads/2179/Kansai%20W-8042%2C%20W8042-1.pdf" },
  "juki-mb-372-373": { instructionUrl: "https://www.supsew.com/download/Juki/Juki%20MB-372%20Instruction%20Manual.pdf", partsUrl: "https://www.supsew.com/download/Juki/Juki%20MB-372%2C%20MB-373.pdf" },
  "rimoldi-264": { instructionUrl: "https://www.supsew.com/wpfb-file/rimoldi-261-263-264-267-268-instruction-manual-pdf/", partsUrl: "https://www.supsew.com/download/Rimoldi/Rimoldi%20264-04.pdf" },
  "brother-lt2-b833": { partsUrl: "https://www.maquinasuniao.com.br/wp-content/themes/maquinas-uniao/catalogos/loop-11/Brother%20LT2-B833.pdf" },
  "brother-db2-b737": { instructionUrl: "https://www.supsew.com/wpfb-file/brother-db2-b737-instruction-manual-pdf/", partsUrl: "https://www.szwalnicze.com/cat_brother/brother_DB2-B737-MKII.pdf" },
  "brother-db2-b755": { instructionUrl: "https://www.etsy.com/listing/988149927/brother-db2-b755-industrial-sewing", partsUrl: "https://www.supsew.com/download/Brother/Brother%20DB2-B755.pdf" },
  "brother-db2-b724": { instructionUrl: "https://www.supsew.com/wpfb-file/brother-db2-b721-723-db2-b722-b724-instruction-manual-pdf/", partsUrl: "https://www.diamondneedle.com/documents/BROTHER%20Parts%20Manual/b721eng.pdf" },
  "union-special-63900": { partsUrl: "https://globalsew.com/wp-content/uploads/2017/02/US-63900-Manual.pdf" },
  "clinton-199": { instructionUrl: "https://s3.amazonaws.com/a.teamworksales.com/CLINTON-PDF/CLINTON%2BNEW/clinton%2B199%2Bfor%2Bus%2B63900.pdf", partsUrl: "https://s3.amazonaws.com/a.teamworksales.com/CLINTON-PDF/CLINTON%2BNEW/clinton%2B199%2Bfor%2Bus%2B63900.pdf" },
  "pfaff-1291": { partsUrl: "https://www.maquinasuniao.com.br/wp-content/themes/maquinas-uniao/catalogos/loop-66/Pfaff%201291.pdf" },
  "juki-mo-3900": { instructionUrl: "https://semsi.com.mx/Manuales/JUKI/MO-3900%20ENGINEER%20MANUAL.pdf", partsUrl: "https://mjfoleyco.com/resources/manuals/juki-parts/" },
  "juki-mo-3914": { instructionUrl: "https://semsi.com.mx/Manuales/JUKI/MO-3900%20ENGINEER%20MANUAL.pdf", partsUrl: "https://mjfoleyco.com/resources/manuals/juki-parts/" },
  "union-special-35800": { partsUrl: "https://www.szwalnicze.com/cat_union/union_special_35800.pdf" },
  "brother-bas-304a": { instructionUrl: "https://www.manualslib.com/manual/1320669/Brother-Bas-304a.html" },
  "eastman-d2h": { instructionUrl: "https://www.freesewingmachinemanuals.com/eastman-cutting.html", partsUrl: "https://www.freesewingmachinemanuals.com/eastman-cutting.html" },
  "willcox-515-4": { instructionUrl: "https://www.supsew.com/download/Pegasus/Pegasus%20%28W%26G%29%20500%20IV%20%28Overlock%20and%20Safety%20Stitch%29.pdf", partsUrl: "https://www.supsew.com/download/Pegasus/Pegasus%20%28W%26G%29%20500%20IV%20%28Overlock%20and%20Safety%20Stitch%29.pdf" },
  "willcox-515": { instructionUrl: "https://www.supsew.com/download/Pegasus/Pegasus%20%28W%26G%29%20500%20IV%20%28Overlock%20and%20Safety%20Stitch%29.pdf", partsUrl: "https://www.supsew.com/download/Pegasus/Pegasus%20%28W%26G%29%20500%20IV%20%28Overlock%20and%20Safety%20Stitch%29.pdf" },
  "juki-lh-1152": { instructionUrl: "https://www.supsew.com/download/Juki/Juki%20LH-1152-5%20Instruction%20Manual.pdf", partsUrl: "https://www.diamondneedle.com/juki-reference-library" },
  "brother-bas-341": { instructionUrl: "https://semsi.com.mx/Manuales/BROTHER/BAS-341A-342A%20Instruction%20Manuel.pdf" },
  "willcox-e32": { partsUrl: "https://www.supsew.com/download/Pegasus/Pegasus%20E%20Series.pdf" },
  "singer-302w": { instructionUrl: "https://www.supsew.com/catalogs-diagrams/" },
};

// The production sequence is the additive taxonomy from the completed
// research pass. It does not replace the legacy equipment type or model name.
function researchedStage(entry: MachineCatalogEntry): MachineStage {
  const model = entry.model;
  if (["Blue Streak II 629", "D2H"].includes(model)) return "Coupe / préparation matière";
  if (["DB2-B715", "DN-267", "DB2-B716", "DB2-B737", "DB2-B755", "DB2-B724", "1291", "LH-1152"].includes(model)) return "Assemblage — couture principale";
  if (["BAS-760", "BAS-301", "BAS-341A", "BAS-311A", "BAS-304A", "BAS-341"].includes(model)) return "Assemblage — poches / automatisation";
  if (["LK-980", "269W", "S2", "LK-1850", "302W401", "302W"].includes(model)) return "Assemblage — renforts / passants";
  if (["DH4-B980", "MB-372 / MB-373"].includes(model)) return "Finition — pose de boutons / boutonnières";
  if (entry.manufacturer === "Reece" && model === "101") return "Finition — boutonnières";
  if (["Model 199 (pour Union Special 63900)", "Robot / attachement de passants", "Système d’automatisation"].includes(model)) return "Assemblage — automatisation / attachements";
  return "Assemblage — couture surjet / recouvrement";
}

function normalizedMachineValue(value: string) {
  return value.toLocaleLowerCase("fr-CA").replace(/[^a-z0-9]/g, "");
}

function researchFor(entry: MachineCatalogEntry, index: number) {
  const manufacturer = normalizedMachineValue(entry.manufacturer);
  const model = normalizedMachineValue(entry.model);
  const candidates = machineResearchFamilies.filter((family) => normalizedMachineValue(family.manufacturer) === manufacturer);
  const exact = candidates.find((family) => normalizedMachineValue(family.canonicalModel) === model);
  if (exact) return exact;
  const close = candidates.filter((family) => {
    const researchedModel = normalizedMachineValue(family.canonicalModel);
    return researchedModel.includes(model) || model.includes(researchedModel);
  });
  // The research package was authored from this same 55-family list. The
  // positional fallback is intentional for family/attachment names that cannot
  // be normalized safely (for example BENZ, Eastlex, and Galkin).
  return close.length === 1 ? close[0] : machineResearchFamilies[index];
}

function statusFromResearch(currentResearchStatus: string, fallback: MachineStatus): MachineStatus {
  if (/^confirmed/i.test(currentResearchStatus)) return "confirmé";
  if (/probable|candidate/i.test(currentResearchStatus)) return "à confirmer";
  if (/plate|unverified|needs/i.test(currentResearchStatus)) return "à vérifier";
  return fallback;
}

const researchMachineCatalog: MachineCatalogEntry[] = initialMachineCatalog.map((entry, index) => {
  const research = researchFor(entry, index);
  return {
    ...entry,
    id: research.masterFamilyId,
    masterFamilyId: research.masterFamilyId,
    manufacturer: research.manufacturer,
    model: research.canonicalModel,
    stage: research.suggestedProductionStepFrench as MachineStage,
    status: statusFromResearch(research.currentResearchStatus, entry.status),
    note: research.currentResearchStatus,
    instructionUrl: research.manualServiceUrl || documentationById[entry.id]?.instructionUrl,
    partsUrl: research.partsUrl || documentationById[entry.id]?.partsUrl,
    originalLabelsPreserved: research.originalLabelsPreserved,
    reclassificationAction: research.reclassificationAction,
    image: {
      publicPath: research.image.publicPath,
      visualMatch: research.image.visualMatch,
      sourceUrl: research.image.sourceUrl,
      sourceEvidenceType: research.image.sourceEvidenceType,
      useNote: research.image.useNote,
      publicationRecommendation: research.image.publicationRecommendation,
      rightsAttribution: research.image.rightsAttribution,
    },
  };
});

// The DM and DN records are variants of the same Union Special 35800 machine
// family. The recovered "COUPE FILS 35800" / "CHAIN CUTTER" labels identify
// an attachment for that family, not a separate sewing head. Keep every source
// label searchable, while presenting one clear family in the application.
const mergedUnionSpecial35800Ids = new Set(["M-017", "M-025", "M-041"]);
const unionSpecial35800Entries = researchMachineCatalog.filter((entry) => mergedUnionSpecial35800Ids.has(entry.id));
const unionSpecial35800Dm = unionSpecial35800Entries.find((entry) => entry.id === "M-017")!;
const unionSpecial35800Series: MachineCatalogEntry = {
  id: "M-35800",
  masterFamilyId: "M-35800",
  manufacturer: "Union Special",
  model: "Série 35800 (DM / DN)",
  stage: unionSpecial35800Dm.stage,
  linkedRecords: unionSpecial35800Entries.reduce((total, entry) => total + entry.linkedRecords, 0),
  status: "confirmé",
  searchTerm: "35800",
  searchTerms: [...new Set(unionSpecial35800Entries.flatMap((entry) => [entry.model, entry.searchTerm, ...(entry.searchTerms ?? []), ...(entry.originalLabelsPreserved ?? "").split("|")]).map((term) => term.trim()).filter(Boolean))],
  alternateNames: "35800DM | 35800DN | COUPE FILS 35800 | US 35800 CHAIN CUTTER",
  originalLabelsPreserved: unionSpecial35800Entries.map((entry) => entry.originalLabelsPreserved ?? "").filter(Boolean).join(" | "),
  note: "Famille regroupée : 35800DM et 35800DN sont des variantes de la même machine. Le coupe-fils de chaîne est un attachement associé, non une machine distincte.",
  instructionUrl: unionSpecial35800Dm.instructionUrl,
  partsUrl: unionSpecial35800Dm.partsUrl,
  image: unionSpecial35800Dm.image,
};

// Older links remain valid and resolve to the unified family.
export const machineIdAliases: Record<string, string> = {
  "M-017": "M-35800",
  "M-025": "M-35800",
  "M-041": "M-35800",
};
export const hiddenMachineFamilyIds = [...mergedUnionSpecial35800Ids];

// AMCO is confirmed as a shared drive system, rather than a sewing head. It is
// intentionally not attached to Juki, Union Special, or any other host machine
// until an installed motor/nameplate proves that relationship.
const sharedEquipmentCatalog: MachineCatalogEntry[] = [
  {
    id: "M-AMCO",
    masterFamilyId: "M-AMCO",
    manufacturer: "AMCO / Teledyne AMCO",
    model: "Moteur d’entraînement AMCO",
    stage: "Utilités — motorisation / entraînement",
    linkedRecords: 16,
    status: "confirmé",
    searchTerm: "AMCO",
    searchTerms: ["AMCO", "MOTOR AMCO", "DIVER AMCO", "POSITIONER AMCO", "AMCO NEEDLE POSITIONNER"],
    alternateNames: "AMCO | MOTOR AMCO | DIVER AMCO | POSITIONER AMCO | AMCO NEEDLE POSITIONNER",
    originalLabelsPreserved: "AMCO | MOTOR AMCO | DIVER AMCO | POSITIONER AMCO | AMCO NEEDLE POSITIONNER",
    note: "Système moteur, embrayage et positionneur confirmé. La machine hôte (Juki, Union Special ou autre) reste à confirmer sur la plaque du moteur ou de la machine.",
    instructionUrl: "https://www.supsew.com/download/Union%20Special/Union%20Special%2051300KK%2C%20KL.pdf",
    partsUrl: "https://www.supsew.com/download/Reece/Reece%2059-83.pdf",
  },
];

export const machineCatalog: MachineCatalogEntry[] = [
  ...researchMachineCatalog.filter((entry) => !mergedUnionSpecial35800Ids.has(entry.id)),
  unionSpecial35800Series,
  ...sharedEquipmentCatalog,
];

export const productionStages: MachineStage[] = [
  "Coupe / préparation matière",
  "Assemblage — couture principale",
  "Assemblage — couture surjet / recouvrement",
  "Assemblage — poches / automatisation",
  "Assemblage — renforts / passants",
  "Assemblage — automatisation / attachements",
  "Finition — boutonnières",
  "Finition — pose de boutons / boutonnières",
  "Utilités — motorisation / entraînement",
];
