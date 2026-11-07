export interface FestivalHeaderTemplate {
  id: string;
  name: string;
  teluguName: string;
  festivalTag: string;
  description: string;
  previewGradient: string;
  imageUrl: string;
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
    description: "Golden sunrise with soaring kites and festive harvest motifs",
    previewGradient: "linear-gradient(135deg, #FF6F00 0%, #FF8F00 50%, #FFA000 100%)",
    imageUrl: "https://images.unsplash.com/photo-1548625361-195fe578cb27?auto=format&fit=crop&w=1080&q=80",
    mediaType: "image",
    textColor: "#FFFFFF",
    accentColor: "#FFE082",
  },
  {
    id: "diwali",
    name: "Diwali Golden Diyas",
    teluguName: "దీపావళి దివ్య దీపాలు",
    festivalTag: "దీపావళి / Diwali",
    description: "Royal midnight blue with shimmering golden diyas and sparkle",
    previewGradient: "linear-gradient(135deg, #0D1B2A 0%, #1B263B 50%, #FFB703 100%)",
    imageUrl: "https://images.unsplash.com/photo-1510525009512-ab7522c36783?auto=format&fit=crop&w=1080&q=80",
    mediaType: "image",
    textColor: "#FFFFFF",
    accentColor: "#FFD166",
  },
  {
    id: "new_year",
    name: "New Year Celebration",
    teluguName: "నూతన సంవత్సర వేడుకలు",
    festivalTag: "New Year 2027",
    description: "Sparkling golden fireworks, champagne glow and celebration bokeh",
    previewGradient: "linear-gradient(135deg, #0A1128 0%, #1C2541 60%, #E0A96D 100%)",
    imageUrl: "https://images.unsplash.com/photo-1467810563316-b5476525c0f9?auto=format&fit=crop&w=1080&q=80",
    mediaType: "image",
    textColor: "#FFFFFF",
    accentColor: "#F4D06F",
  },
  {
    id: "ugadi",
    name: "Ugadi Telugu Toranam",
    teluguName: "ఉగాది పచ్చడి & మామిడి తోరణాలు",
    festivalTag: "ఉగాది / Telugu New Year",
    description: "Fresh neem flowers and mango leaf traditional Telugu toranam",
    previewGradient: "linear-gradient(135deg, #2D6A4F 0%, #52B788 60%, #D8F3DC 100%)",
    imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1080&q=80",
    mediaType: "image",
    textColor: "#FFFFFF",
    accentColor: "#B7E4C7",
  },
  {
    id: "dussehra",
    name: "Dussehra Royal Marigold",
    teluguName: "దసరా బంతిపూల తోరణాలు",
    festivalTag: "విజయదశమి / Dussehra",
    description: "Auspicious marigold flowers and royal crimson festive triumph",
    previewGradient: "linear-gradient(135deg, #9D0208 0%, #DC2F02 50%, #F48C06 100%)",
    imageUrl: "https://images.unsplash.com/photo-1508873696983-2df57046475a?auto=format&fit=crop&w=1080&q=80",
    mediaType: "image",
    textColor: "#FFFFFF",
    accentColor: "#FFBA08",
  },
  {
    id: "patriotic",
    name: "Independence / Republic Day",
    teluguName: "జాతీయ త్రివర్ణ శోభ",
    festivalTag: "15 August / 26 January",
    description: "Graceful Indian Tricolor aesthetic with saffron and emerald gradient",
    previewGradient: "linear-gradient(135deg, #FF671F 0%, #FFFFFF 50%, #046A38 100%)",
    imageUrl: "https://images.unsplash.com/photo-1532375810709-75b1da00537c?auto=format&fit=crop&w=1080&q=80",
    mediaType: "image",
    textColor: "#1F2937",
    accentColor: "#FF671F",
  },
  {
    id: "ramzan",
    name: "Ramzan Crescent Moon",
    teluguName: "రంజాన్ చంద్రవంక & దీపాలు",
    festivalTag: "రంజాన్ / Eid Mubarak",
    description: "Glowing crescent moon, emerald jade sky, and festive lanterns",
    previewGradient: "linear-gradient(135deg, #064E3B 0%, #047857 50%, #10B981 100%)",
    imageUrl: "https://images.unsplash.com/photo-1564769625905-50e93615e769?auto=format&fit=crop&w=1080&q=80",
    mediaType: "image",
    textColor: "#FFFFFF",
    accentColor: "#6EE7B7",
  },
  {
    id: "christmas",
    name: "Christmas Holiday Glow",
    teluguName: "క్రిస్మస్ వేడుకలు",
    festivalTag: "క్రిస్మస్ / Christmas",
    description: "Deep holly red, sparkling winter snow and evergreen pine",
    previewGradient: "linear-gradient(135deg, #7F1D1D 0%, #991B1B 50%, #B91C1C 100%)",
    imageUrl: "https://images.unsplash.com/photo-1512389142860-9c449e58a543?auto=format&fit=crop&w=1080&q=80",
    mediaType: "image",
    textColor: "#FFFFFF",
    accentColor: "#FECACA",
  },
];
