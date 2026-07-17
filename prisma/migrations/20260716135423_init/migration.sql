-- CreateEnum
CREATE TYPE "Role" AS ENUM ('player', 'owner');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pending', 'confirmed', 'cancelled', 'declined');

-- CreateEnum
CREATE TYPE "Outcome" AS ENUM ('played', 'cancelled');

-- CreateEnum
CREATE TYPE "PitchStatus" AS ENUM ('active', 'maintenance', 'removed');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('open', 'resolved');

-- CreateEnum
CREATE TYPE "SmsKind" AS ENUM ('confirmation', 'reminder');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('rent', 'electricity', 'water', 'staff', 'maintenance', 'equipment', 'other');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneNormalized" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'player',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pitch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "players" TEXT NOT NULL,
    "perSide" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "surface" TEXT NOT NULL,
    "covered" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "tint" TEXT NOT NULL,
    "status" "PitchStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pitch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,
    "slotStart" TEXT NOT NULL,
    "slotEnd" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'pending',
    "byOwner" BOOLEAN NOT NULL DEFAULT false,
    "reminded" BOOLEAN NOT NULL DEFAULT false,
    "outcome" "Outcome",
    "amountPaid" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT,
    "bookingId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsOutbox" (
    "id" TEXT NOT NULL,
    "toPhone" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "kind" "SmsKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "expenseDate" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNormalized_key" ON "User"("phoneNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Booking_dayKey_pitchId_slotStart_idx" ON "Booking"("dayKey", "pitchId", "slotStart");

-- CreateIndex
CREATE INDEX "Booking_phone_idx" ON "Booking"("phone");

-- CreateIndex
CREATE INDEX "Booking_outcome_idx" ON "Booking"("outcome");

-- CreateIndex
CREATE INDEX "Expense_expenseDate_idx" ON "Expense"("expenseDate");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
