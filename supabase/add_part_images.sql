-- Migration: Add image_url column to parts table
-- Run this in Supabase SQL Editor ONCE
ALTER TABLE parts ADD COLUMN IF NOT EXISTS image_url text;

-- Also create a bucket for part images if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('part-images', 'part-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for part-images bucket
CREATE POLICY "Public read part-images" ON storage.objects
  FOR SELECT USING (bucket_id = 'part-images');

CREATE POLICY "Authenticated upload part-images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'part-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated update part-images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'part-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated delete part-images" ON storage.objects
  FOR DELETE USING (bucket_id = 'part-images' AND auth.role() = 'authenticated');
