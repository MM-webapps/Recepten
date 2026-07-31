// Gedeelde constanten: kenmerk-opties, dagen, en de kleur/iconenstijl per kenmerk.

export const BASIS_OPTIONS = [
  'Aardappel', 'Pasta', 'Rijst', 'Wraps/Tortilla', 'Brood',
  'Peulvruchten', 'Noedels', 'Couscous/Bulgur', 'Overig'
];

export const PROTEINE_OPTIONS = [
  'Kip', 'Rundvlees', 'Gehakt', 'Varkensvlees', 'Vis/Zeevruchten',
  'Ei', 'Tofu/Peulvruchten', 'Vegetarisch overig', 'Geen'
];

export const KEUKEN_OPTIONS = [
  'Nederlands', 'Italiaans', 'Mediterraans', 'Aziatisch',
  'Mexicaans', 'Indiaas', 'Midden-Oosters', 'Overig'
];

export const DAGEN = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

export const DAG_NAMEN = {
  Ma: 'Maandag', Di: 'Dinsdag', Wo: 'Woensdag', Do: 'Donderdag',
  Vr: 'Vrijdag', Za: 'Zaterdag', Zo: 'Zondag'
};

// Icoon = Lucide-icoonnaam als losse SVG-paden (zie icons.js), kleur/bg voor de kenmerk-pills.
export const KENMERK_STYLE = {
  basis:    { color: '#8A5F1F', bg: '#F3E3C4', icon: 'wheat' },
  proteine: { color: '#8A3624', bg: '#F3D9CF', icon: 'beef' },
  keuken:   { color: '#1F4F44', bg: '#D7E8E3', icon: 'globe' }
};
