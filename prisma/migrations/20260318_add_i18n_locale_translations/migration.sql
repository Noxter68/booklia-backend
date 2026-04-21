-- AddColumn: User.locale (preferred language for emails and UI)
ALTER TABLE "User" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'fr';

-- AddColumn: Category.translations (JSON with translations per locale)
-- Format: { "en": "Hairdresser", "pt": "Cabeleireiro" }
-- The "name" column remains the default French name.
ALTER TABLE "Category" ADD COLUMN "translations" JSONB;

-- Seed: Populate category translations for EN and PT
UPDATE "Category" SET "translations" = '{"en": "Hairdresser", "pt": "Cabeleireiro"}'::jsonb WHERE "slug" = 'coiffeur';
UPDATE "Category" SET "translations" = '{"en": "Barber", "pt": "Barbeiro"}'::jsonb WHERE "slug" = 'barbier';
UPDATE "Category" SET "translations" = '{"en": "Manicure", "pt": "Manicure"}'::jsonb WHERE "slug" = 'manucure';
UPDATE "Category" SET "translations" = '{"en": "Beauty salon", "pt": "Salão de beleza"}'::jsonb WHERE "slug" = 'institut-de-beaute';
UPDATE "Category" SET "translations" = '{"en": "Wellness", "pt": "Bem-estar"}'::jsonb WHERE "slug" = 'bien-etre';
UPDATE "Category" SET "translations" = '{"en": "Hypnotherapists", "pt": "Hipnoterapeutas"}'::jsonb WHERE "slug" = 'hypnotherapeutes';
UPDATE "Category" SET "translations" = '{"en": "Massage", "pt": "Massagem"}'::jsonb WHERE "slug" = 'massage';
UPDATE "Category" SET "translations" = '{"en": "Naturopaths", "pt": "Naturopatas"}'::jsonb WHERE "slug" = 'naturopathes';
UPDATE "Category" SET "translations" = '{"en": "Reflexologists", "pt": "Reflexologistas"}'::jsonb WHERE "slug" = 'reflexologues';
UPDATE "Category" SET "translations" = '{"en": "Sophrologists", "pt": "Sofrologistas"}'::jsonb WHERE "slug" = 'sophrologues';
