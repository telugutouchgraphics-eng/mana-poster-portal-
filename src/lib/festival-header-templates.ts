export interface FestivalHeaderTemplate {
  id: string;
  name: string;
  teluguName: string;
  festivalTag: string;
  description: string;
  previewGradient: string;
  imageUrl: string;
  videoUrl: string;
  mediaType: "image" | "video";
  textColor: string;
  accentColor: string;
}

export const FESTIVAL_HEADER_TEMPLATES: FestivalHeaderTemplate[] = [
  {
    id: "sankranthi",
    name: "Sankranthi Kites",
    teluguName: "సంక్రాంతి పతంగులు",
    festivalTag: "సంక్రాంతి / Pongal",
    description: "Realistic soaring kites swaying gracefully in bright sunrise sky",
    previewGradient: "linear-gradient(135deg, #FF6F00 0%, #FF8F00 50%, #FFA000 100%)",
    imageUrl: "https://images.unsplash.com/photo-1516796181074-bf453fbfa3e6?auto=format&fit=crop&w=1080&q=80",
    videoUrl: "https://upload.wikimedia.org/wikipedia/commons/transcoded/a/a7/Charlieville_savannah_Trinidad_kite_flying_1.mpg/Charlieville_savannah_Trinidad_kite_flying_1.mpg.480p.vp9.webm",
    mediaType: "video",
    textColor: "#FFFFFF",
    accentColor: "#FFE082",
  },
  {
    id: "diwali",
    name: "Diwali Golden Diyas",
    teluguName: "దీపావళి దివ్య దీపాలు",
    festivalTag: "దీపావళి / Diwali",
    description: "Realistic flickering sacred oil flame with golden radiant glow",
    previewGradient: "linear-gradient(135deg, #0D1B2A 0%, #1B263B 50%, #FFB703 100%)",
    imageUrl: "https://images.unsplash.com/photo-1605647540924-852290f6b0d5?auto=format&fit=crop&w=1080&q=80",
    videoUrl: "https://upload.wikimedia.org/wikipedia/commons/transcoded/f/f6/Visible_light_spectrum_of_a_candle_flame.webm/Visible_light_spectrum_of_a_candle_flame.webm.480p.vp9.webm",
    mediaType: "video",
    textColor: "#FFFFFF",
    accentColor: "#FFD166",
  },
  {
    id: "new_year",
    name: "New Year Fireworks",
    teluguName: "నూతన సంవత్సర వేడుకలు",
    festivalTag: "New Year 2027",
    description: "Spectacular realistic golden fireworks exploding in midnight sky",
    previewGradient: "linear-gradient(135deg, #0A1128 0%, #1C2541 60%, #E0A96D 100%)",
    imageUrl: "https://images.unsplash.com/photo-1467810563316-b5476525c0f9?auto=format&fit=crop&w=1080&q=80",
    videoUrl: "https://upload.wikimedia.org/wikipedia/commons/transcoded/4/4c/Fireworks_Naperville_2022.webm/Fireworks_Naperville_2022.webm.480p.vp9.webm",
    mediaType: "video",
    textColor: "#FFFFFF",
    accentColor: "#F4D06F",
  },
  {
    id: "ugadi",
    name: "Ugadi Mango Toranam",
    teluguName: "ఉగాది పచ్చడి & మామిడి తోరణాలు",
    festivalTag: "ఉగాది / Telugu New Year",
    description: "Fresh green mango leaves rustling gently in fresh spring morning breeze",
    previewGradient: "linear-gradient(135deg, #2D6A4F 0%, #52B788 60%, #D8F3DC 100%)",
    imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1080&q=80",
    videoUrl: "https://upload.wikimedia.org/wikipedia/commons/transcoded/a/ab/Wind_in_tree_AppletonFarms_Massachusetts_2024-10.webm/Wind_in_tree_AppletonFarms_Massachusetts_2024-10.webm.480p.vp9.webm",
    mediaType: "video",
    textColor: "#FFFFFF",
    accentColor: "#B7E4C7",
  },
  {
    id: "dussehra",
    name: "Dussehra Royal Sparkle",
    teluguName: "దసరా బంతిపూల కాంతులు",
    festivalTag: "విజయదశమి / Dussehra",
    description: "Golden festive sparklers and glowing auspicious celebration embers",
    previewGradient: "linear-gradient(135deg, #9D0208 0%, #DC2F02 50%, #F48C06 100%)",
    imageUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1080&q=80",
    videoUrl: "https://upload.wikimedia.org/wikipedia/commons/transcoded/3/31/Sparklers_-_tokyo_-_2020_8_11.webm/Sparklers_-_tokyo_-_2020_8_11.webm.480p.vp9.webm",
    mediaType: "video",
    textColor: "#FFFFFF",
    accentColor: "#FFBA08",
  },
  {
    id: "patriotic",
    name: "Independence / Republic Day",
    teluguName: "జాతీయ త్రివర్ణ శోభ",
    festivalTag: "15 August / 26 January",
    description: "Gracefully waving satin Indian Tricolor in azure open sky",
    previewGradient: "linear-gradient(135deg, #FF671F 0%, #FFFFFF 50%, #046A38 100%)",
    imageUrl: "https://images.unsplash.com/photo-1532375810709-75b1da00537c?auto=format&fit=crop&w=1080&q=80",
    videoUrl: "https://upload.wikimedia.org/wikipedia/commons/transcoded/5/51/Flag_Of_India.webm/Flag_Of_India.webm.480p.vp9.webm",
    mediaType: "video",
    textColor: "#1F2937",
    accentColor: "#FF671F",
  },
  {
    id: "ramzan",
    name: "Ramzan Crescent Moon",
    teluguName: "రంజాన్ చంద్రవంక & తారలు",
    festivalTag: "రంజాన్ / Eid Mubarak",
    description: "Peaceful golden crescent moon glowing in twilight emerald sky",
    previewGradient: "linear-gradient(135deg, #064E3B 0%, #047857 50%, #10B981 100%)",
    imageUrl: "https://images.unsplash.com/photo-1564769625905-50e93615e769?auto=format&fit=crop&w=1080&q=80",
    videoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/b5/Crescent_Moon_Sails_By_the_Earth_%28CIRA_2025-03-27_-_nolabels%29.webm",
    mediaType: "video",
    textColor: "#FFFFFF",
    accentColor: "#6EE7B7",
  },
  {
    id: "christmas",
    name: "Christmas Gentle Snowfall",
    teluguName: "క్రిస్మస్ మంచు వేడుకలు",
    festivalTag: "క్రిస్మస్ / Christmas",
    description: "Serene realistic falling winter snow with warm festive ambience",
    previewGradient: "linear-gradient(135deg, #7F1D1D 0%, #991B1B 50%, #B91C1C 100%)",
    imageUrl: "https://images.unsplash.com/photo-1512389142860-9c449e58a543?auto=format&fit=crop&w=1080&q=80",
    videoUrl: "https://upload.wikimedia.org/wikipedia/commons/transcoded/3/36/Snowfall-240fps.webm/Snowfall-240fps.webm.480p.vp9.webm",
    mediaType: "video",
    textColor: "#FFFFFF",
    accentColor: "#FECACA",
  },
];
