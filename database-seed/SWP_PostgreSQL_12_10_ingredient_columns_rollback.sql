-- Duy's Code : Hoàn tác các cột duyệt nguyên liệu mới, giữ nguyên schema ingredient ban đầu.
-- Chỉ xóa các hàng pending/rejected sinh từ luồng đề xuất; hàng approved vẫn được giữ làm nguyên liệu.
BEGIN;

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'ingredient' AND column_name = 'status'
    ) THEN
        DELETE FROM public.ingredient WHERE status IN ('pending', 'rejected');
    END IF;
END $$;

DROP INDEX IF EXISTS public.ingredient_pending_name_uq;
DROP INDEX IF EXISTS public.ingredient_pending_created_idx;
ALTER TABLE public.ingredient DROP CONSTRAINT IF EXISTS ingredient_status_check;
ALTER TABLE public.ingredient DROP CONSTRAINT IF EXISTS ingredient_submitted_by_fk;
ALTER TABLE public.ingredient DROP CONSTRAINT IF EXISTS ingredient_reviewed_by_fk;
ALTER TABLE public.ingredient
    DROP COLUMN IF EXISTS status,
    DROP COLUMN IF EXISTS submitted_by,
    DROP COLUMN IF EXISTS created_at,
    DROP COLUMN IF EXISTS reviewed_by,
    DROP COLUMN IF EXISTS reviewed_at,
    DROP COLUMN IF EXISTS review_note;

COMMIT;
