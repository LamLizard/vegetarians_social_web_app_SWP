-- =====================================================================
-- 10/11/2026 · Hoàn nguyên: tạo lại meal_plan_status_enum + meal_plan_source_enum
-- và 2 cột meal_plan.status / meal_plan.source.
--
-- PHÁ GÌ / KHÔNG KHÔI PHỤC ĐƯỢC GÌ:
--   * Cột bị DROP nên giá trị từng dòng đã mất. Không thể biết dòng nào là
--     'draft'/'archived' hay do AI tạo. File này gán lại giá trị mặc định của
--     giai đoạn trước khi bỏ (mọi dòng đều là 'saved' + 'manual', đúng với
--     100% dữ liệu lúc bỏ) — nếu sau này đã ghi giá trị khác thì mất.
--   * Schema tạo lại giống bản gốc: DEFAULT 'draft' / DEFAULT 'ai', NOT NULL.
--   * BẮT BUỘC rollback code trước khi chạy: code mới không còn INSERT
--     status/source nên sau khi có cột, dòng mới sẽ nhận default 'draft'/'ai'
--     (khác hành vi cũ 'saved'/'manual') cho tới khi code cũ được deploy lại.
-- Chạy lại nhiều lần vẫn an toàn (idempotent).
-- =====================================================================
BEGIN;

-- 1) Tạo lại type nếu chưa có
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meal_plan_status_enum') THEN
    CREATE TYPE public.meal_plan_status_enum AS ENUM ('draft', 'saved', 'archived');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meal_plan_source_enum') THEN
    CREATE TYPE public.meal_plan_source_enum AS ENUM ('manual', 'ai');
  END IF;
END $$;

-- 2) Tạo lại cột với default như bản gốc
ALTER TABLE public.meal_plan
  ADD COLUMN IF NOT EXISTS status public.meal_plan_status_enum NOT NULL DEFAULT 'draft';

ALTER TABLE public.meal_plan
  ADD COLUMN IF NOT EXISTS source public.meal_plan_source_enum NOT NULL DEFAULT 'ai';

-- 3) Khôi phục giá trị mà code cũ luôn ghi (không phải giá trị gốc từng dòng)
UPDATE public.meal_plan SET status = 'saved' WHERE status = 'draft';
UPDATE public.meal_plan SET source = 'manual' WHERE source = 'ai';

COMMIT;

-- Kiểm tra: cả 4 dòng phải là "ok"
SELECT 'cột meal_plan.status đã có' AS item,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'meal_plan' AND column_name = 'status'
  ) THEN 'ok' ELSE 'MISSING' END AS result
UNION ALL
SELECT 'cột meal_plan.source đã có',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'meal_plan' AND column_name = 'source'
  ) THEN 'ok' ELSE 'MISSING' END
UNION ALL
SELECT 'default status = draft',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'meal_plan' AND column_name = 'status'
      AND column_default LIKE '%draft%'
  ) THEN 'ok' ELSE 'MISSING' END
UNION ALL
SELECT 'default source = ai',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'meal_plan' AND column_name = 'source'
      AND column_default LIKE '%ai%'
  ) THEN 'ok' ELSE 'MISSING' END;
