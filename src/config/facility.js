// Single-facility configuration. This site belongs to ONE owner who may run
// SEVERAL stadiums (pitches). The owner defines each stadium here — name, the
// match format (6v6 / 7v7 / 11v11), price, and a photo. Players see these when
// choosing which stadium to book.
export const FACILITY = {
  name: "Le Five",
  city: "Tunis",
  phone: "+216 71 000 000",
  openHour: 9,
  closeHour: 24, // midnight
  slotMinutes: 90, // 1h30 games
  currency: "TND",

  // Each stadium the owner operates. `image` is a photo URL (null → a stylized
  // pitch illustration stands in). `tint` colors that illustration.
  pitches: [
    { id: "a", name: "Terrain A", players: "6 vs 6", perSide: 6, price: 80, surface: "Gazon synthétique", covered: true, image: null, tint: "#1F7A46" },
    { id: "b", name: "Terrain B", players: "7 vs 7", perSide: 7, price: 100, surface: "Gazon synthétique", covered: false, image: null, tint: "#166b3c" },
    { id: "c", name: "Grand Stade", players: "11 vs 11", perSide: 11, price: 180, surface: "Gazon naturel", covered: false, image: null, tint: "#0E5A34" },
  ],

  // Anti-fake rule: how many upcoming (pending+confirmed) bookings one phone
  // may hold at once.
  maxActiveBookingsPerUser: 2,
  // The owner's phone — logging in with it unlocks the owner dashboard.
  ownerPhone: "+216 20 000 000",
};

export const pitchById = (id) => FACILITY.pitches.find((p) => p.id === id);
