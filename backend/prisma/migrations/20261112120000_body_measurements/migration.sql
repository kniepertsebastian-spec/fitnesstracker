-- Tape measurements per body-composition entry (3.1): waist, neck, hip in cm, all optional.
ALTER TABLE "BodyCompositionEntry" ADD COLUMN "waistCm" DECIMAL(4,1);
ALTER TABLE "BodyCompositionEntry" ADD COLUMN "neckCm" DECIMAL(4,1);
ALTER TABLE "BodyCompositionEntry" ADD COLUMN "hipCm" DECIMAL(4,1);
