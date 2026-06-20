-- ============================================================
-- DietQ Food Database Schema (Fixed)
-- Drop if exists to ensure clean state
-- ============================================================

-- Drop existing objects first (if any)
DROP TABLE IF EXISTS food_favorites CASCADE;
DROP TABLE IF EXISTS foods CASCADE;
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS search_foods(TEXT, UUID, TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS cache_off_food(TEXT, TEXT, TEXT, INT, INT, DECIMAL, DECIMAL, DECIMAL, TEXT) CASCADE;
DROP FUNCTION IF EXISTS add_user_food(TEXT, TEXT, TEXT, INT, TEXT, INT, DECIMAL, DECIMAL, DECIMAL) CASCADE;

-- ============================================================
-- Foods table: umum (user_id = NULL) + user custom (user_id = set)
-- ============================================================
CREATE TABLE foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  name TEXT NOT NULL,
  name_lower TEXT GENERATED ALWAYS AS (lower(name)) STORED,
  category TEXT,
  serving_size_g INT NOT NULL DEFAULT 100,
  serving_size_text TEXT,
  calories_per_serving INT NOT NULL,
  protein_g DECIMAL(7,2) NOT NULL DEFAULT 0,
  carbs_g DECIMAL(7,2) NOT NULL DEFAULT 0,
  fat_g DECIMAL(7,2) NOT NULL DEFAULT 0,
  fiber_g DECIMAL(7,2) DEFAULT 0,
  sodium_mg DECIMAL(9,2) DEFAULT 0,
  source TEXT DEFAULT 'seed',
  off_code TEXT,
  is_verified BOOLEAN DEFAULT false,
  usage_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add FK after table creation
ALTER TABLE foods DROP CONSTRAINT IF EXISTS foods_user_id_fkey;
ALTER TABLE foods ADD CONSTRAINT foods_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Index untuk search cepat
CREATE INDEX foods_name_idx ON foods USING gin(to_tsvector('indonesian', name));
CREATE INDEX foods_category_idx ON foods (category);
CREATE INDEX foods_user_idx ON foods (user_id);
CREATE INDEX foods_source_idx ON foods (source);
CREATE INDEX foods_off_code_idx ON foods (off_code) WHERE off_code IS NOT NULL;

-- Foods favorites (untuk track makanan favorit)
CREATE TABLE food_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  food_id UUID NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, food_id)
);

-- ============================================================
-- Trigger: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER foods_updated_at
  BEFORE UPDATE ON foods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Function: Search foods (gabungan public + user custom)
-- ============================================================
CREATE OR REPLACE FUNCTION search_foods(
  p_query TEXT,
  p_user_id UUID DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  category TEXT,
  serving_size_g INT,
  serving_size_text TEXT,
  calories_per_serving INT,
  protein_g DECIMAL,
  carbs_g DECIMAL,
  fat_g DECIMAL,
  source TEXT,
  is_user_food BOOLEAN,
  is_verified BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id,
    f.name,
    f.category,
    f.serving_size_g,
    f.serving_size_text,
    f.calories_per_serving,
    f.protein_g,
    f.carbs_g,
    f.fat_g,
    f.source,
    (f.user_id IS NOT NULL) AS is_user_food,
    f.is_verified
  FROM foods f
  WHERE (
    -- Public foods
    (f.user_id IS NULL AND (
      p_query IS NULL OR p_query = '' OR
      to_tsvector('indonesian', f.name) @@ plainto_tsquery('indonesian', COALESCE(p_query, '')) OR
      f.name_lower % p_query  -- fuzzy match using pg_trgm
    ))
    OR
    -- User's custom foods
    (f.user_id = p_user_id AND p_user_id IS NOT NULL)
  )
  AND (p_category IS NULL OR p_category = '' OR f.category = p_category)
  ORDER BY
    f.usage_count DESC NULLS LAST,
    f.name ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable pg_trgm extension for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create trgm index for fuzzy search
DROP INDEX IF EXISTS foods_name_trgm_idx;
CREATE INDEX foods_name_trgm_idx ON foods USING gin (name_lower gin_trgm_ops);

-- ============================================================
-- Function: Cache OFF product to foods table
-- ============================================================
CREATE OR REPLACE FUNCTION cache_off_food(
  p_code TEXT,
  p_name TEXT,
  p_category TEXT,
  p_serving_g INT,
  p_calories INT,
  p_protein DECIMAL,
  p_carbs DECIMAL,
  p_fat DECIMAL,
  p_serving_text TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Check if already exists
  SELECT id INTO v_id FROM foods WHERE off_code = p_code;

  IF v_id IS NOT NULL THEN
    -- Update existing
    UPDATE foods SET
      name = p_name,
      category = p_category,
      serving_size_g = p_serving_g,
      serving_size_text = p_serving_text,
      calories_per_serving = p_calories,
      protein_g = p_protein,
      carbs_g = p_carbs,
      fat_g = p_fat,
      updated_at = now()
    WHERE id = v_id;
  ELSE
    -- Insert new
    INSERT INTO foods (
      name, category, serving_size_g, serving_size_text,
      calories_per_serving, protein_g, carbs_g, fat_g,
      source, off_code, is_verified
    )
    VALUES (
      p_name, p_category, p_serving_g, p_serving_text,
      p_calories, p_protein, p_carbs, p_fat,
      'off', p_code, false
    )
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Function: Add user custom food
-- ============================================================
CREATE OR REPLACE FUNCTION add_user_food(
  p_user_id UUID,
  p_name TEXT,
  p_category TEXT,
  p_serving_g INT,
  p_serving_text TEXT,
  p_calories INT,
  p_protein DECIMAL,
  p_carbs DECIMAL,
  p_fat DECIMAL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO foods (
    user_id, name, category, serving_size_g, serving_size_text,
    calories_per_serving, protein_g, carbs_g, fat_g, source
  )
  VALUES (
    p_user_id, p_name, p_category, p_serving_g, p_serving_text,
    p_calories, p_protein, p_carbs, p_fat, 'user'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RLS Policies
-- ============================================================
ALTER TABLE foods ENABLE ROW LEVEL SECURITY;

-- Public foods: anyone can read
DROP POLICY IF EXISTS "Public foods readable by everyone" ON foods;
CREATE POLICY "Public foods readable by everyone" ON foods
  FOR SELECT USING (user_id IS NULL);

-- User's own foods: can do anything
DROP POLICY IF EXISTS "Users manage own foods" ON foods;
CREATE POLICY "Users manage own foods" ON foods
  FOR ALL USING (user_id = auth.uid());

-- Favorites: users manage their own
ALTER TABLE food_favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own favorites" ON food_favorites;
CREATE POLICY "Users manage own favorites" ON food_favorites
  FOR ALL USING (user_id = auth.uid());
