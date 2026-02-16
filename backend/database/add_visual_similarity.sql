-- Migration: Add Visual Similarity Support
-- Adds image URLs and embeddings for visual similarity matching
-- Run this in DBeaver while connected to your postgres database

-- ============================================================================
-- 1. ADD COLUMNS TO SCANS TABLE
-- ============================================================================

-- Add image storage columns to scans
ALTER TABLE scans
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS image_embedding JSONB;

-- Add index for faster queries on scans with images
CREATE INDEX IF NOT EXISTS idx_scans_has_image ON scans(image_url) WHERE image_url IS NOT NULL;

-- Add comment
COMMENT ON COLUMN scans.image_embedding IS '512-dimensional CLIP embedding stored as JSON array';

-- ============================================================================
-- 2. ADD COLUMNS TO PRODUCT_RECOMMENDATIONS TABLE
-- ============================================================================

-- Add embedding and thumbnail columns (image_url already exists)
ALTER TABLE product_recommendations
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS image_embedding JSONB;

-- Add index for faster queries on recommendations with embeddings
CREATE INDEX IF NOT EXISTS idx_recommendations_has_embedding ON product_recommendations(image_embedding) WHERE image_embedding IS NOT NULL;

-- Add comment
COMMENT ON COLUMN product_recommendations.image_embedding IS '512-dimensional CLIP embedding stored as JSON array';

-- ============================================================================
-- 3. UPDATE SCAN_TYPE ENUM (if needed)
-- ============================================================================

-- Visual scans don't have fiber data, so environmental_score can be NULL for them
ALTER TABLE scans ALTER COLUMN environmental_score DROP NOT NULL;
ALTER TABLE scans ALTER COLUMN environmental_grade DROP NOT NULL;
ALTER TABLE scans ALTER COLUMN fibers DROP NOT NULL;

-- Add check to ensure visual scans have images
-- (We'll enforce this in the application layer)

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'scans'
  AND column_name IN ('image_url', 'thumbnail_url', 'image_embedding')
ORDER BY column_name;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'product_recommendations'
  AND column_name IN ('image_url', 'thumbnail_url', 'image_embedding')
ORDER BY column_name;

-- Check existing scans count
SELECT COUNT(*) as total_scans,
       COUNT(image_url) as scans_with_images,
       COUNT(image_embedding) as scans_with_embeddings
FROM scans;

-- Check existing recommendations
SELECT COUNT(*) as total_recommendations,
       COUNT(image_url) as recs_with_images,
       COUNT(image_embedding) as recs_with_embeddings
FROM product_recommendations;

COMMIT;
