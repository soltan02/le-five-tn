import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const OWNER_PHONE = process.env.OWNER_PHONE || "+216 20 000 000";

function normalizePhone(phone) {
  return phone.replace(/\D/g, "");
}

const PITCHES = [
  { name: "Terrain A", players: "6 vs 6", perSide: 6, price: 80, surface: "Gazon synthétique", covered: true, image: null, tint: "#1F7A46" },
  { name: "Terrain B", players: "7 vs 7", perSide: 7, price: 100, surface: "Gazon synthétique", covered: false, image: null, tint: "#166b3c" },
  { name: "Grand Stade", players: "11 vs 11", perSide: 11, price: 180, surface: "Gazon naturel", covered: false, image: null, tint: "#0E5A34" },
];

async function main() {
  const existingPitches = await prisma.pitch.count();
  if (existingPitches === 0) {
    for (const p of PITCHES) {
      await prisma.pitch.create({ data: p });
    }
    console.log(`Seeded ${PITCHES.length} pitches.`);
  } else {
    console.log("Pitches already exist, skipping pitch seed.");
  }

  const ownerNormalized = normalizePhone(OWNER_PHONE);
  const existingOwner = await prisma.user.findUnique({ where: { phoneNormalized: ownerNormalized } });
  if (!existingOwner) {
    await prisma.user.create({
      data: { phone: OWNER_PHONE, phoneNormalized: ownerNormalized, name: "Propriétaire", role: "owner" },
    });
    console.log("Seeded owner user.");
  } else {
    console.log("Owner user already exists, skipping.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
