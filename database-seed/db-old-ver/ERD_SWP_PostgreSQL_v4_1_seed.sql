-- ERD_SWP PostgreSQL v4.1 - Demo Seed Data
-- Target: PostgreSQL 13+ / Neon PostgreSQL
-- Generated for FE/demo usage. Intended for a CLEAN application database after running ERD_SWP_PostgreSQL_v4_1.sql.
-- Demo login password for every seeded account: Seed@123456
-- Password hash generated with bcrypt cost 10. Change/remove demo accounts before any production use.

BEGIN;
SET LOCAL TIME ZONE 'Asia/Ho_Chi_Minh';

-- 0) PRE-FLIGHT: schema + clean-database guard
INSERT INTO role (name) VALUES ('member'), ('admin') ON CONFLICT (name) DO NOTHING;
DO $$
DECLARE
    v_missing text;
    v_existing bigint;
BEGIN
    SELECT string_agg(t, ', ')
      INTO v_missing
      FROM (VALUES ('account'),('profile'),('post'),('category'),('dish'),('recipe'),('ingredient'),('meal_plan'),('shop')) AS req(t)
     WHERE to_regclass('public.' || t) IS NULL;
    IF v_missing IS NOT NULL THEN
        RAISE EXCEPTION 'Seed aborted: missing required tables: %', v_missing;
    END IF;

    SELECT (SELECT count(*) FROM account)
         + (SELECT count(*) FROM category)
         + (SELECT count(*) FROM ingredient)
         + (SELECT count(*) FROM dish)
         + (SELECT count(*) FROM post)
      INTO v_existing;
    IF v_existing <> 0 THEN
        RAISE EXCEPTION 'Seed aborted: application data already exists (account/category/ingredient/dish/post). Use a clean DB to keep this demo seed deterministic.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM role WHERE name='admin') OR NOT EXISTS (SELECT 1 FROM role WHERE name='member') THEN
        RAISE EXCEPTION 'Seed aborted: required roles admin/member are unavailable.';
    END IF;
END $$;

-- 1) ACCOUNTS: 3 admins + 12 members
INSERT INTO account (email,password_hash,role_id,status,full_name,avatar_url,bio,last_login_at,created_at,updated_at) VALUES
    ('admin.quan@seed.erdswp.local', '$2b$10$orJGoiVAYx.qcmf2a6U9TesVc6aNUuoqTXV0xR51uc08sAsFxPKOu', (SELECT role_id FROM role WHERE name='admin'), 'active', 'Nguyễn Minh Quân', 'https://i.pravatar.cc/300?img=1', 'Quản trị hệ thống và kiểm duyệt nội dung.', '2026-09-24 20:00:00+07', '2026-07-01 09:00:00+07', '2026-09-24 20:00:00+07'),
    ('admin.ha@seed.erdswp.local', '$2b$10$orJGoiVAYx.qcmf2a6U9TesVc6aNUuoqTXV0xR51uc08sAsFxPKOu', (SELECT role_id FROM role WHERE name='admin'), 'active', 'Trần Thu Hà', 'https://i.pravatar.cc/300?img=2', 'Phụ trách nội dung công thức và dinh dưỡng.', '2026-09-24 20:00:00+07', '2026-07-01 09:00:00+07', '2026-09-24 20:00:00+07'),
    ('admin.nam@seed.erdswp.local', '$2b$10$orJGoiVAYx.qcmf2a6U9TesVc6aNUuoqTXV0xR51uc08sAsFxPKOu', (SELECT role_id FROM role WHERE name='admin'), 'active', 'Lê Hoàng Nam', 'https://i.pravatar.cc/300?img=3', 'Phụ trách vận hành, cửa hàng và báo cáo.', '2026-09-24 20:00:00+07', '2026-07-01 09:00:00+07', '2026-09-24 20:00:00+07'),
    ('linh.nguyen@seed.erdswp.local', '$2b$10$orJGoiVAYx.qcmf2a6U9TesVc6aNUuoqTXV0xR51uc08sAsFxPKOu', (SELECT role_id FROM role WHERE name='member'), 'active', 'Nguyễn Thảo Linh', 'https://i.pravatar.cc/300?img=4', 'Ăn chay lành mạnh, thích meal prep.', '2026-09-14 12:15:00+07', '2026-07-05 10:00:00+07', '2026-09-20 10:00:00+07'),
    ('minh.anh@seed.erdswp.local', '$2b$10$orJGoiVAYx.qcmf2a6U9TesVc6aNUuoqTXV0xR51uc08sAsFxPKOu', (SELECT role_id FROM role WHERE name='member'), 'active', 'Trần Minh Anh', 'https://i.pravatar.cc/300?img=5', 'Tập gym và ưu tiên món chay giàu protein.', '2026-09-15 13:15:00+07', '2026-07-05 10:00:00+07', '2026-09-20 10:00:00+07'),
    ('hoang.pham@seed.erdswp.local', '$2b$10$orJGoiVAYx.qcmf2a6U9TesVc6aNUuoqTXV0xR51uc08sAsFxPKOu', (SELECT role_id FROM role WHERE name='member'), 'active', 'Phạm Gia Hoàng', 'https://i.pravatar.cc/300?img=6', 'Thích món Việt chay và nấu ăn tại nhà.', '2026-09-16 14:15:00+07', '2026-07-05 10:00:00+07', '2026-09-20 10:00:00+07'),
    ('mai.le@seed.erdswp.local', '$2b$10$orJGoiVAYx.qcmf2a6U9TesVc6aNUuoqTXV0xR51uc08sAsFxPKOu', (SELECT role_id FROM role WHERE name='member'), 'active', 'Lê Ngọc Mai', 'https://i.pravatar.cc/300?img=7', 'Quan tâm dinh dưỡng và kiểm soát calories.', '2026-09-17 15:15:00+07', '2026-07-05 10:00:00+07', '2026-09-20 10:00:00+07'),
    ('khanh.vo@seed.erdswp.local', '$2b$10$orJGoiVAYx.qcmf2a6U9TesVc6aNUuoqTXV0xR51uc08sAsFxPKOu', (SELECT role_id FROM role WHERE name='member'), 'active', 'Võ Quốc Khánh', 'https://i.pravatar.cc/300?img=8', 'Thích khám phá quán chay cuối tuần.', '2026-09-18 16:15:00+07', '2026-07-05 10:00:00+07', '2026-09-20 10:00:00+07'),
    ('yen.tran@seed.erdswp.local', '$2b$10$orJGoiVAYx.qcmf2a6U9TesVc6aNUuoqTXV0xR51uc08sAsFxPKOu', (SELECT role_id FROM role WHERE name='member'), 'active', 'Trần Hải Yến', 'https://i.pravatar.cc/300?img=9', 'Ưu tiên món nhanh gọn cho dân văn phòng.', '2026-09-19 17:15:00+07', '2026-07-05 10:00:00+07', '2026-09-20 10:00:00+07'),
    ('tuan.nguyen@seed.erdswp.local', '$2b$10$orJGoiVAYx.qcmf2a6U9TesVc6aNUuoqTXV0xR51uc08sAsFxPKOu', (SELECT role_id FROM role WHERE name='member'), 'active', 'Nguyễn Anh Tuấn', 'https://i.pravatar.cc/300?img=10', 'Đang học nấu các món thuần chay cơ bản.', '2026-09-20 08:15:00+07', '2026-07-05 10:00:00+07', '2026-09-20 10:00:00+07'),
    ('thu.do@seed.erdswp.local', '$2b$10$orJGoiVAYx.qcmf2a6U9TesVc6aNUuoqTXV0xR51uc08sAsFxPKOu', (SELECT role_id FROM role WHERE name='member'), 'active', 'Đỗ Thanh Thu', 'https://i.pravatar.cc/300?img=11', 'Thích salad, smoothie và món nhẹ.', '2026-09-21 09:15:00+07', '2026-07-05 10:00:00+07', '2026-09-20 10:00:00+07'),
    ('bao.huynh@seed.erdswp.local', '$2b$10$orJGoiVAYx.qcmf2a6U9TesVc6aNUuoqTXV0xR51uc08sAsFxPKOu', (SELECT role_id FROM role WHERE name='member'), 'active', 'Huỳnh Gia Bảo', 'https://i.pravatar.cc/300?img=12', 'Hay chia sẻ trải nghiệm ăn chay.', '2026-09-22 10:15:00+07', '2026-07-05 10:00:00+07', '2026-09-20 10:00:00+07'),
    ('ngoc.bui@seed.erdswp.local', '$2b$10$orJGoiVAYx.qcmf2a6U9TesVc6aNUuoqTXV0xR51uc08sAsFxPKOu', (SELECT role_id FROM role WHERE name='member'), 'locked', 'Bùi Hồng Ngọc', 'https://i.pravatar.cc/300?img=13', 'Tài khoản mẫu để test trạng thái locked.', '2026-09-23 11:15:00+07', '2026-07-05 10:00:00+07', '2026-09-20 10:00:00+07'),
    ('duc.tran@seed.erdswp.local', '$2b$10$orJGoiVAYx.qcmf2a6U9TesVc6aNUuoqTXV0xR51uc08sAsFxPKOu', (SELECT role_id FROM role WHERE name='member'), 'reported', 'Trần Minh Đức', 'https://i.pravatar.cc/300?img=14', 'Tài khoản mẫu để test trạng thái reported.', '2026-09-10 12:15:00+07', '2026-07-05 10:00:00+07', '2026-09-20 10:00:00+07'),
    ('vy.pham@seed.erdswp.local', '$2b$10$orJGoiVAYx.qcmf2a6U9TesVc6aNUuoqTXV0xR51uc08sAsFxPKOu', (SELECT role_id FROM role WHERE name='member'), 'deleted', 'Phạm Thảo Vy', 'https://i.pravatar.cc/300?img=15', 'Tài khoản mẫu soft-delete để test FE.', NULL, '2026-07-05 10:00:00+07', '2026-09-20 10:00:00+07');

-- 2) PROFILES + ALLERGIES
INSERT INTO profile (account_id,gender,date_of_birth,height_cm,weight_kg,bmi,bmi_category,activity_level,health_goal,tdee_kcal,target_calories_kcal) VALUES
    ((SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local'), 'female', '1999-04-18', 160.00, 52.00, 20.3, 'normal', 'moderate', 'maintain', 1850, 1850),
    ((SELECT account_id FROM account WHERE email='minh.anh@seed.erdswp.local'), 'female', '2000-11-09', 165.00, 58.00, 21.3, 'normal', 'active', 'gain_muscle', 2150, 2300),
    ((SELECT account_id FROM account WHERE email='hoang.pham@seed.erdswp.local'), 'male', '1997-02-21', 174.00, 68.00, 22.5, 'normal', 'moderate', 'maintain', 2450, 2450),
    ((SELECT account_id FROM account WHERE email='mai.le@seed.erdswp.local'), 'female', '1998-08-14', 158.00, 61.00, 24.4, 'normal', 'light', 'lose_weight', 1750, 1500),
    ((SELECT account_id FROM account WHERE email='khanh.vo@seed.erdswp.local'), 'male', '1996-06-03', 178.00, 76.00, 24.0, 'normal', 'active', 'maintain', 2750, 2750),
    ((SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local'), 'female', '2001-01-27', 162.00, 49.00, 18.7, 'normal', 'sedentary', 'maintain', 1600, 1600),
    ((SELECT account_id FROM account WHERE email='tuan.nguyen@seed.erdswp.local'), 'male', '2002-09-12', 170.00, 59.00, 20.4, 'normal', 'light', 'gain_muscle', 2200, 2400),
    ((SELECT account_id FROM account WHERE email='thu.do@seed.erdswp.local'), 'female', '1999-12-30', 155.00, 47.00, 19.6, 'normal', 'moderate', 'maintain', 1750, 1750),
    ((SELECT account_id FROM account WHERE email='bao.huynh@seed.erdswp.local'), 'male', '1995-05-16', 172.00, 82.00, 27.7, 'overweight', 'light', 'lose_weight', 2350, 1900),
    ((SELECT account_id FROM account WHERE email='ngoc.bui@seed.erdswp.local'), 'female', '2000-03-08', 164.00, 54.00, 20.1, 'normal', 'light', 'maintain', 1800, 1800),
    ((SELECT account_id FROM account WHERE email='duc.tran@seed.erdswp.local'), 'male', '1998-10-25', 176.00, 70.00, 22.6, 'normal', 'moderate', 'maintain', 2500, 2500),
    ((SELECT account_id FROM account WHERE email='vy.pham@seed.erdswp.local'), 'other', '2001-07-19', 168.00, 57.00, 20.2, 'normal', 'sedentary', 'maintain', 1700, 1700);
INSERT INTO allergy (profile_id,name) VALUES
    ((SELECT profile_id FROM profile WHERE account_id=(SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local')), 'Đậu phộng'),
    ((SELECT profile_id FROM profile WHERE account_id=(SELECT account_id FROM account WHERE email='minh.anh@seed.erdswp.local')), 'Hạt điều'),
    ((SELECT profile_id FROM profile WHERE account_id=(SELECT account_id FROM account WHERE email='mai.le@seed.erdswp.local')), 'Mè'),
    ((SELECT profile_id FROM profile WHERE account_id=(SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local')), 'Đậu nành'),
    ((SELECT profile_id FROM profile WHERE account_id=(SELECT account_id FROM account WHERE email='thu.do@seed.erdswp.local')), 'Hạnh nhân'),
    ((SELECT profile_id FROM profile WHERE account_id=(SELECT account_id FROM account WHERE email='bao.huynh@seed.erdswp.local')), 'Gluten'),
    ((SELECT profile_id FROM profile WHERE account_id=(SELECT account_id FROM account WHERE email='ngoc.bui@seed.erdswp.local')), 'Đậu phộng'),
    ((SELECT profile_id FROM profile WHERE account_id=(SELECT account_id FROM account WHERE email='duc.tran@seed.erdswp.local')), 'Mè'),
    ((SELECT profile_id FROM profile WHERE account_id=(SELECT account_id FROM account WHERE email='vy.pham@seed.erdswp.local')), 'Hạt điều'),
    ((SELECT profile_id FROM profile WHERE account_id=(SELECT account_id FROM account WHERE email='vy.pham@seed.erdswp.local')), 'Đậu nành');

-- 3) CATEGORIES + INGREDIENTS
INSERT INTO category (name,is_active) VALUES
    ('Ăn sáng', true),
    ('Món chính', true),
    ('Món nước', true),
    ('Salad', true),
    ('Món nhẹ', true),
    ('Đồ uống', true),
    ('Tráng miệng', true),
    ('Dinh dưỡng', true),
    ('Kinh nghiệm', true),
    ('Meal Prep', true);
INSERT INTO ingredient (name,is_animal_derived,is_ngu_vi_tan,is_common_allergen) VALUES
    ('Gạo trắng', false, false, false),
    ('Gạo lứt', false, false, false),
    ('Bún gạo', false, false, false),
    ('Bánh phở', false, false, false),
    ('Mì sợi', false, false, true),
    ('Miến', false, false, false),
    ('Bánh mì', false, false, true),
    ('Yến mạch', false, false, false),
    ('Quinoa', false, false, false),
    ('Bột gạo', false, false, false),
    ('Đậu hũ', false, false, true),
    ('Tàu hũ ky', false, false, true),
    ('Tempeh', false, false, true),
    ('Đậu gà', false, false, false),
    ('Đậu lăng', false, false, false),
    ('Đậu đỏ', false, false, false),
    ('Trứng gà', true, false, true),
    ('Đậu xanh', false, false, false),
    ('Đậu nành', false, false, true),
    ('Đậu phộng', false, false, true),
    ('Nấm rơm', false, false, false),
    ('Nấm đông cô', false, false, false),
    ('Nấm bào ngư', false, false, false),
    ('Nấm đùi gà', false, false, false),
    ('Cà rốt', false, false, false),
    ('Khoai tây', false, false, false),
    ('Khoai lang', false, false, false),
    ('Bí đỏ', false, false, false),
    ('Cà chua', false, false, false),
    ('Dưa leo', false, false, false),
    ('Bông cải xanh', false, false, false),
    ('Súp lơ trắng', false, false, false),
    ('Cải thìa', false, false, false),
    ('Cải bó xôi', false, false, false),
    ('Sữa bò', true, false, true),
    ('Mật ong', true, false, false),
    ('Nước mắm', true, false, false),
    ('Xà lách', false, false, false),
    ('Giá đỗ', false, false, false),
    ('Bắp ngô', false, false, false),
    ('Đậu que', false, false, false),
    ('Ớt chuông', false, false, false),
    ('Hành boa-rô', false, true, false),
    ('Hành tím', false, true, false),
    ('Tỏi', false, true, false),
    ('Hẹ', false, true, false),
    ('Gừng', false, false, false),
    ('Sả', false, false, false),
    ('Nghệ', false, false, false),
    ('Ớt', false, false, false),
    ('Rau thơm', false, false, false),
    ('Ngò rí', false, false, false),
    ('Húng quế', false, false, false),
    ('Rong biển', false, false, false),
    ('Chanh', false, false, false),
    ('Xoài', false, false, false),
    ('Chuối', false, false, false),
    ('Bơ sữa', true, false, true),
    ('Dừa', false, false, false),
    ('Bơ', false, false, false),
    ('Mè trắng', false, false, true),
    ('Hạt điều', false, false, true),
    ('Hạnh nhân', false, false, true),
    ('Hạt chia', false, false, false),
    ('Hạt bí', false, false, false),
    ('Bơ đậu phộng', false, false, true),
    ('Nước tương', false, false, true),
    ('Tương miso', false, false, true),
    ('Tương ớt', false, false, false),
    ('Sốt cà chua', false, false, false),
    ('Nước cốt dừa', false, false, false),
    ('Sữa đậu nành', false, false, true),
    ('Sữa yến mạch', false, false, false),
    ('Dầu ô liu', false, false, false),
    ('Dầu mè', false, false, true),
    ('Đường thốt nốt', false, false, false),
    ('Cacao', false, false, false),
    ('Bột cà ri', false, false, false),
    ('Tiêu đen', false, false, false),
    ('Muối', false, false, false);

-- 4) 50 DISHES + CATEGORIES
INSERT INTO dish (name,description,thumbnail_url,est_calories_kcal,status,moderation_note,moderated_by,moderated_at,created_by,created_at,updated_at) VALUES
    ('Phở chay nấm', 'Nước dùng thanh từ rau củ, ăn cùng nấm và đậu hũ.', 'https://picsum.photos/seed/erd-swp-dish-01/800/600', 420, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-08-02 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-07-02 09:00:00+07', '2026-08-02 14:00:00+07'),
    ('Bún bò Huế chay', 'Bún Huế thuần chay thơm sả, vị đậm vừa phải.', 'https://picsum.photos/seed/erd-swp-dish-02/800/600', 480, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-08-03 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-07-03 09:00:00+07', '2026-08-03 14:00:00+07'),
    ('Bún riêu chay', 'Bún riêu với riêu đậu hũ và cà chua.', 'https://picsum.photos/seed/erd-swp-dish-03/800/600', 430, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-08-04 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-07-04 09:00:00+07', '2026-08-04 14:00:00+07'),
    ('Mì Quảng chay', 'Mì Quảng rau nấm, đậu hũ và nước dùng sánh nhẹ.', 'https://picsum.photos/seed/erd-swp-dish-04/800/600', 510, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-08-05 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-07-05 09:00:00+07', '2026-08-05 14:00:00+07'),
    ('Hủ tiếu chay', 'Hủ tiếu rau củ nấm theo phong cách miền Nam.', 'https://picsum.photos/seed/erd-swp-dish-05/800/600', 440, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-08-06 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-07-06 09:00:00+07', '2026-08-06 14:00:00+07'),
    ('Bánh canh nấm', 'Bánh canh nấm nóng, nước dùng rau củ ngọt tự nhiên.', 'https://picsum.photos/seed/erd-swp-dish-06/800/600', 460, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-08-07 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-07-07 09:00:00+07', '2026-08-07 14:00:00+07'),
    ('Cơm gạo lứt đậu hũ', 'Cơm gạo lứt ăn cùng đậu hũ và rau củ.', 'https://picsum.photos/seed/erd-swp-dish-07/800/600', 520, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-08-08 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-07-08 09:00:00+07', '2026-08-08 14:00:00+07'),
    ('Cơm chiên rau củ', 'Cơm chiên ít dầu với rau củ nhiều màu sắc.', 'https://picsum.photos/seed/erd-swp-dish-08/800/600', 540, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-08-09 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-07-09 09:00:00+07', '2026-08-09 14:00:00+07'),
    ('Cơm cà ri chay', 'Cà ri rau củ béo nhẹ dùng với cơm nóng.', 'https://picsum.photos/seed/erd-swp-dish-09/800/600', 590, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-08-10 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-07-10 09:00:00+07', '2026-08-10 14:00:00+07'),
    ('Cơm nấm sốt tiêu', 'Nấm áp chảo sốt tiêu đen ăn cùng cơm.', 'https://picsum.photos/seed/erd-swp-dish-10/800/600', 560, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-08-11 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-07-11 09:00:00+07', '2026-08-11 14:00:00+07'),
    ('Đậu hũ sốt cà chua', 'Đậu hũ mềm sốt cà chua chua ngọt.', 'https://picsum.photos/seed/erd-swp-dish-11/800/600', 360, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-08-12 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-07-12 09:00:00+07', '2026-08-12 14:00:00+07'),
    ('Đậu hũ kho nấm', 'Đậu hũ kho nấm đậm vị, phù hợp ăn với cơm.', 'https://picsum.photos/seed/erd-swp-dish-12/800/600', 390, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-08-13 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-07-13 09:00:00+07', '2026-08-13 14:00:00+07'),
    ('Đậu hũ xào sả ớt', 'Đậu hũ vàng giòn, thơm sả và cay nhẹ.', 'https://picsum.photos/seed/erd-swp-dish-13/800/600', 410, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-08-14 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-07-14 09:00:00+07', '2026-08-14 14:00:00+07'),
    ('Đậu hũ áp chảo sốt mè', 'Đậu hũ áp chảo với sốt mè thơm béo.', 'https://picsum.photos/seed/erd-swp-dish-14/800/600', 430, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-08-15 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-07-15 09:00:00+07', '2026-08-15 14:00:00+07'),
    ('Tempeh sốt teriyaki', 'Tempeh giàu đạm với sốt tương ngọt mặn.', 'https://picsum.photos/seed/erd-swp-dish-15/800/600', 470, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-08-16 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-07-16 09:00:00+07', '2026-08-16 14:00:00+07'),
    ('Nấm kho tiêu', 'Các loại nấm kho tiêu, vị đậm và thơm.', 'https://picsum.photos/seed/erd-swp-dish-16/800/600', 330, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-08-17 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-07-17 09:00:00+07', '2026-08-17 14:00:00+07'),
    ('Nấm xào rau củ', 'Nấm xào nhanh cùng bông cải và ớt chuông.', 'https://picsum.photos/seed/erd-swp-dish-17/800/600', 350, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-08-18 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-07-18 09:00:00+07', '2026-08-18 14:00:00+07'),
    ('Rau củ kho thập cẩm', 'Rau củ kho mềm, thích hợp cho bữa cơm gia đình.', 'https://picsum.photos/seed/erd-swp-dish-18/800/600', 380, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-08-19 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-07-19 09:00:00+07', '2026-08-19 14:00:00+07'),
    ('Cà ri khoai lang đậu gà', 'Cà ri béo nhẹ từ nước cốt dừa, khoai lang và đậu gà.', 'https://picsum.photos/seed/erd-swp-dish-19/800/600', 520, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-08-20 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-07-20 09:00:00+07', '2026-08-20 14:00:00+07'),
    ('Đậu lăng hầm cà chua', 'Đậu lăng hầm cà chua giàu chất xơ và protein.', 'https://picsum.photos/seed/erd-swp-dish-20/800/600', 450, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-08-01 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-07-01 09:00:00+07', '2026-08-01 14:00:00+07'),
    ('Canh chua chay', 'Canh chua rau củ thanh mát kiểu Việt.', 'https://picsum.photos/seed/erd-swp-dish-21/800/600', 180, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-08-02 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-07-02 09:00:00+07', '2026-08-02 14:00:00+07'),
    ('Canh bí đỏ đậu hũ', 'Canh bí đỏ ngọt tự nhiên với đậu hũ.', 'https://picsum.photos/seed/erd-swp-dish-22/800/600', 210, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-08-03 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-07-03 09:00:00+07', '2026-08-03 14:00:00+07'),
    ('Súp bí đỏ', 'Súp bí đỏ mịn, dùng sữa yến mạch.', 'https://picsum.photos/seed/erd-swp-dish-23/800/600', 260, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-08-04 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-07-04 09:00:00+07', '2026-08-04 14:00:00+07'),
    ('Súp nấm kem yến mạch', 'Súp nấm béo nhẹ không dùng sữa động vật.', 'https://picsum.photos/seed/erd-swp-dish-24/800/600', 290, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-08-05 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-07-05 09:00:00+07', '2026-08-05 14:00:00+07'),
    ('Salad đậu gà', 'Salad tươi với đậu gà, rau xanh và chanh.', 'https://picsum.photos/seed/erd-swp-dish-25/800/600', 340, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-08-06 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-07-06 09:00:00+07', '2026-08-06 14:00:00+07'),
    ('Salad quinoa rau củ', 'Quinoa trộn rau củ, phù hợp meal prep.', 'https://picsum.photos/seed/erd-swp-dish-26/800/600', 390, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-08-07 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-07-07 09:00:00+07', '2026-08-07 14:00:00+07'),
    ('Salad đậu hũ mè rang', 'Đậu hũ, rau xanh và sốt mè thơm.', 'https://picsum.photos/seed/erd-swp-dish-27/800/600', 370, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-08-08 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-07-08 09:00:00+07', '2026-08-08 14:00:00+07'),
    ('Gỏi cuốn chay', 'Gỏi cuốn rau, đậu hũ và bún gạo.', 'https://picsum.photos/seed/erd-swp-dish-28/800/600', 310, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-08-09 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-07-09 09:00:00+07', '2026-08-09 14:00:00+07'),
    ('Bì cuốn chay', 'Cuốn rau và bì chay từ đậu hũ, khoai củ.', 'https://picsum.photos/seed/erd-swp-dish-29/800/600', 330, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-08-10 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-07-10 09:00:00+07', '2026-08-10 14:00:00+07'),
    ('Bánh mì đậu hũ', 'Bánh mì giòn kẹp đậu hũ và rau tươi.', 'https://picsum.photos/seed/erd-swp-dish-30/800/600', 450, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-08-11 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-07-11 09:00:00+07', '2026-08-11 14:00:00+07'),
    ('Bánh mì nấm', 'Bánh mì kẹp nấm xào và rau chua ngọt.', 'https://picsum.photos/seed/erd-swp-dish-31/800/600', 430, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-08-12 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-07-12 09:00:00+07', '2026-08-12 14:00:00+07'),
    ('Bánh xèo chay', 'Bánh xèo giòn với nấm, giá và rau.', 'https://picsum.photos/seed/erd-swp-dish-32/800/600', 520, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-08-13 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-07-13 09:00:00+07', '2026-08-13 14:00:00+07'),
    ('Bánh cuốn chay', 'Bánh cuốn mềm nhân nấm và đậu hũ.', 'https://picsum.photos/seed/erd-swp-dish-33/800/600', 410, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-08-14 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-07-14 09:00:00+07', '2026-08-14 14:00:00+07'),
    ('Cháo nấm', 'Cháo nấm nhẹ bụng, phù hợp bữa sáng.', 'https://picsum.photos/seed/erd-swp-dish-34/800/600', 300, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-08-15 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-07-15 09:00:00+07', '2026-08-15 14:00:00+07'),
    ('Cháo yến mạch bí đỏ', 'Yến mạch nấu bí đỏ nhanh gọn.', 'https://picsum.photos/seed/erd-swp-dish-35/800/600', 320, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-08-16 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-07-16 09:00:00+07', '2026-08-16 14:00:00+07'),
    ('Yến mạch qua đêm chuối', 'Overnight oats với chuối và hạt chia.', 'https://picsum.photos/seed/erd-swp-dish-36/800/600', 380, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-08-17 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-07-17 09:00:00+07', '2026-08-17 14:00:00+07'),
    ('Granola hạt', 'Granola yến mạch và các loại hạt nướng giòn.', 'https://picsum.photos/seed/erd-swp-dish-37/800/600', 420, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-08-18 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-07-18 09:00:00+07', '2026-08-18 14:00:00+07'),
    ('Smoothie chuối yến mạch', 'Sinh tố chuối yến mạch no lâu.', 'https://picsum.photos/seed/erd-swp-dish-38/800/600', 330, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-08-19 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-07-19 09:00:00+07', '2026-08-19 14:00:00+07'),
    ('Smoothie xoài dừa', 'Sinh tố xoài dừa mát và thơm.', 'https://picsum.photos/seed/erd-swp-dish-39/800/600', 300, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-08-20 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-07-20 09:00:00+07', '2026-08-20 14:00:00+07'),
    ('Sữa hạt điều cacao', 'Đồ uống cacao từ hạt điều xay.', 'https://picsum.photos/seed/erd-swp-dish-40/800/600', 280, 'pending', NULL, NULL, NULL, (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-07-01 09:00:00+07', '2026-08-01 14:00:00+07'),
    ('Chè đậu xanh', 'Chè đậu xanh ngọt vừa với nước cốt dừa.', 'https://picsum.photos/seed/erd-swp-dish-41/800/600', 360, 'pending', NULL, NULL, NULL, (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-07-02 09:00:00+07', '2026-08-02 14:00:00+07'),
    ('Chè đậu đỏ', 'Chè đậu đỏ mềm bùi, dùng nóng hoặc lạnh.', 'https://picsum.photos/seed/erd-swp-dish-42/800/600', 380, 'pending', NULL, NULL, NULL, (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-07-03 09:00:00+07', '2026-08-03 14:00:00+07'),
    ('Khoai lang nướng mè', 'Khoai lang nướng rắc mè, món nhẹ đơn giản.', 'https://picsum.photos/seed/erd-swp-dish-43/800/600', 250, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-08-04 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-07-04 09:00:00+07', '2026-08-04 14:00:00+07'),
    ('Bánh chuối yến mạch', 'Bánh chuối yến mạch không trứng, ít đường.', 'https://picsum.photos/seed/erd-swp-dish-44/800/600', 340, 'rejected', 'Công thức mẫu bị từ chối để test moderation.', (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-08-05 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-07-05 09:00:00+07', '2026-08-05 14:00:00+07'),
    ('Pasta sốt cà chua nấm', 'Pasta sốt cà chua và nấm kiểu đơn giản.', 'https://picsum.photos/seed/erd-swp-dish-45/800/600', 510, 'rejected', 'Công thức mẫu bị từ chối để test moderation.', (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-08-06 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-07-06 09:00:00+07', '2026-08-06 14:00:00+07'),
    ('Mì xào rau củ', 'Mì xào nhanh với rau củ giòn.', 'https://picsum.photos/seed/erd-swp-dish-46/800/600', 480, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-08-07 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-07-07 09:00:00+07', '2026-08-07 14:00:00+07'),
    ('Miến xào nấm', 'Miến xào nấm và rau củ, vị thanh.', 'https://picsum.photos/seed/erd-swp-dish-47/800/600', 430, 'hidden', 'Món mẫu tạm ẩn để test trạng thái hidden.', (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-08-08 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-07-08 09:00:00+07', '2026-08-08 14:00:00+07'),
    ('Cơm cuộn rong biển chay', 'Cơm cuộn rong biển với đậu hũ và rau củ.', 'https://picsum.photos/seed/erd-swp-dish-48/800/600', 460, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-08-09 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-07-09 09:00:00+07', '2026-08-09 14:00:00+07'),
    ('Bibimbap chay', 'Cơm trộn Hàn Quốc với rau, nấm và đậu hũ.', 'https://picsum.photos/seed/erd-swp-dish-49/800/600', 560, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-08-10 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-07-10 09:00:00+07', '2026-08-10 14:00:00+07'),
    ('Buddha bowl đậu hũ', 'Bowl cân bằng với ngũ cốc, đậu hũ và rau củ.', 'https://picsum.photos/seed/erd-swp-dish-50/800/600', 530, 'active', NULL, (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-08-11 14:00:00+07', (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-07-11 09:00:00+07', '2026-08-11 14:00:00+07');
INSERT INTO dish_category (dish_id,category_id)
SELECT d.dish_id, c.category_id
FROM (VALUES
    ('Phở chay nấm', 'Món nước'),
    ('Bún bò Huế chay', 'Món nước'),
    ('Bún riêu chay', 'Món nước'),
    ('Mì Quảng chay', 'Món nước'),
    ('Hủ tiếu chay', 'Món nước'),
    ('Bánh canh nấm', 'Món nước'),
    ('Cơm gạo lứt đậu hũ', 'Món chính'),
    ('Cơm chiên rau củ', 'Món chính'),
    ('Cơm cà ri chay', 'Món chính'),
    ('Cơm nấm sốt tiêu', 'Món chính'),
    ('Đậu hũ sốt cà chua', 'Món chính'),
    ('Đậu hũ kho nấm', 'Món chính'),
    ('Đậu hũ xào sả ớt', 'Món chính'),
    ('Đậu hũ áp chảo sốt mè', 'Món chính'),
    ('Tempeh sốt teriyaki', 'Món chính'),
    ('Nấm kho tiêu', 'Món chính'),
    ('Nấm xào rau củ', 'Món chính'),
    ('Rau củ kho thập cẩm', 'Món chính'),
    ('Cà ri khoai lang đậu gà', 'Món chính'),
    ('Đậu lăng hầm cà chua', 'Món chính'),
    ('Canh chua chay', 'Món nhẹ'),
    ('Canh bí đỏ đậu hũ', 'Món nhẹ'),
    ('Súp bí đỏ', 'Món nhẹ'),
    ('Súp nấm kem yến mạch', 'Món nhẹ'),
    ('Salad đậu gà', 'Salad'),
    ('Salad quinoa rau củ', 'Salad'),
    ('Salad đậu hũ mè rang', 'Salad'),
    ('Gỏi cuốn chay', 'Món nhẹ'),
    ('Bì cuốn chay', 'Món nhẹ'),
    ('Bánh mì đậu hũ', 'Ăn sáng'),
    ('Bánh mì nấm', 'Ăn sáng'),
    ('Bánh xèo chay', 'Món chính'),
    ('Bánh cuốn chay', 'Ăn sáng'),
    ('Cháo nấm', 'Ăn sáng'),
    ('Cháo yến mạch bí đỏ', 'Ăn sáng'),
    ('Yến mạch qua đêm chuối', 'Ăn sáng'),
    ('Granola hạt', 'Ăn sáng'),
    ('Smoothie chuối yến mạch', 'Đồ uống'),
    ('Smoothie xoài dừa', 'Đồ uống'),
    ('Sữa hạt điều cacao', 'Đồ uống'),
    ('Chè đậu xanh', 'Tráng miệng'),
    ('Chè đậu đỏ', 'Tráng miệng'),
    ('Khoai lang nướng mè', 'Món nhẹ'),
    ('Bánh chuối yến mạch', 'Tráng miệng'),
    ('Pasta sốt cà chua nấm', 'Món chính'),
    ('Mì xào rau củ', 'Món chính'),
    ('Miến xào nấm', 'Món chính'),
    ('Cơm cuộn rong biển chay', 'Món nhẹ'),
    ('Bibimbap chay', 'Món chính'),
    ('Buddha bowl đậu hũ', 'Meal Prep')
) AS x(dish_name, category_name)
JOIN dish d ON d.name=x.dish_name
JOIN category c ON c.name=x.category_name;

-- 5) 50 RECIPES + RECIPE_INGREDIENT
INSERT INTO recipe (dish_id,author_id,title,description,thumbnail_url,youtube_url,servings,prep_time_minutes,cook_time_minutes,calories_kcal,instructions) VALUES
    ((SELECT dish_id FROM dish WHERE name='Phở chay nấm'), (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), 'Cách làm Phở chay nấm', 'Nước dùng thanh từ rau củ, ăn cùng nấm và đậu hũ.', 'https://picsum.photos/seed/erd-swp-dish-01/800/600', NULL, 2, 15, 20, 420, '1. Sơ chế rau củ, nấm và phần đạm thực vật.
2. Chuẩn bị nước dùng hoặc nền súp, nêm nhẹ.
3. Nấu các nguyên liệu theo thứ tự từ lâu chín đến nhanh chín.
4. Hoàn thiện với rau thơm, nêm lại và dùng nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Bún bò Huế chay'), (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), 'Cách làm Bún bò Huế chay', 'Bún Huế thuần chay thơm sả, vị đậm vừa phải.', 'https://picsum.photos/seed/erd-swp-dish-02/800/600', NULL, 2, 20, 25, 480, '1. Sơ chế rau củ, nấm và phần đạm thực vật.
2. Chuẩn bị nước dùng hoặc nền súp, nêm nhẹ.
3. Nấu các nguyên liệu theo thứ tự từ lâu chín đến nhanh chín.
4. Hoàn thiện với rau thơm, nêm lại và dùng nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Bún riêu chay'), (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), 'Cách làm Bún riêu chay', 'Bún riêu với riêu đậu hũ và cà chua.', 'https://picsum.photos/seed/erd-swp-dish-03/800/600', NULL, 2, 25, 30, 430, '1. Sơ chế rau củ, nấm và phần đạm thực vật.
2. Chuẩn bị nước dùng hoặc nền súp, nêm nhẹ.
3. Nấu các nguyên liệu theo thứ tự từ lâu chín đến nhanh chín.
4. Hoàn thiện với rau thơm, nêm lại và dùng nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Mì Quảng chay'), (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), 'Cách làm Mì Quảng chay', 'Mì Quảng rau nấm, đậu hũ và nước dùng sánh nhẹ.', 'https://picsum.photos/seed/erd-swp-dish-04/800/600', NULL, 3, 10, 35, 510, '1. Sơ chế rau củ, nấm và phần đạm thực vật.
2. Chuẩn bị nước dùng hoặc nền súp, nêm nhẹ.
3. Nấu các nguyên liệu theo thứ tự từ lâu chín đến nhanh chín.
4. Hoàn thiện với rau thơm, nêm lại và dùng nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Hủ tiếu chay'), (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), 'Cách làm Hủ tiếu chay', 'Hủ tiếu rau củ nấm theo phong cách miền Nam.', 'https://picsum.photos/seed/erd-swp-dish-05/800/600', NULL, 2, 15, 40, 440, '1. Sơ chế rau củ, nấm và phần đạm thực vật.
2. Chuẩn bị nước dùng hoặc nền súp, nêm nhẹ.
3. Nấu các nguyên liệu theo thứ tự từ lâu chín đến nhanh chín.
4. Hoàn thiện với rau thơm, nêm lại và dùng nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Bánh canh nấm'), (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), 'Cách làm Bánh canh nấm', 'Bánh canh nấm nóng, nước dùng rau củ ngọt tự nhiên.', 'https://picsum.photos/seed/erd-swp-dish-06/800/600', NULL, 2, 20, 15, 460, '1. Sơ chế rau củ, nấm và phần đạm thực vật.
2. Chuẩn bị nước dùng hoặc nền súp, nêm nhẹ.
3. Nấu các nguyên liệu theo thứ tự từ lâu chín đến nhanh chín.
4. Hoàn thiện với rau thơm, nêm lại và dùng nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Cơm gạo lứt đậu hũ'), (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), 'Cách làm Cơm gạo lứt đậu hũ', 'Cơm gạo lứt ăn cùng đậu hũ và rau củ.', 'https://picsum.photos/seed/erd-swp-dish-07/800/600', NULL, 3, 25, 20, 520, '1. Sơ chế và cân nguyên liệu theo định lượng.
2. Làm nóng nồi hoặc chảo, chế biến phần chính trước.
3. Thêm rau củ và gia vị, nấu đến độ chín mong muốn.
4. Nêm lại, trình bày và dùng khi còn nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Cơm chiên rau củ'), (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), 'Cách làm Cơm chiên rau củ', 'Cơm chiên ít dầu với rau củ nhiều màu sắc.', 'https://picsum.photos/seed/erd-swp-dish-08/800/600', NULL, 3, 10, 25, 540, '1. Sơ chế và cân nguyên liệu theo định lượng.
2. Làm nóng nồi hoặc chảo, chế biến phần chính trước.
3. Thêm rau củ và gia vị, nấu đến độ chín mong muốn.
4. Nêm lại, trình bày và dùng khi còn nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Cơm cà ri chay'), (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), 'Cách làm Cơm cà ri chay', 'Cà ri rau củ béo nhẹ dùng với cơm nóng.', 'https://picsum.photos/seed/erd-swp-dish-09/800/600', NULL, 3, 15, 30, 590, '1. Sơ chế và cân nguyên liệu theo định lượng.
2. Làm nóng nồi hoặc chảo, chế biến phần chính trước.
3. Thêm rau củ và gia vị, nấu đến độ chín mong muốn.
4. Nêm lại, trình bày và dùng khi còn nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Cơm nấm sốt tiêu'), (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), 'Cách làm Cơm nấm sốt tiêu', 'Nấm áp chảo sốt tiêu đen ăn cùng cơm.', 'https://picsum.photos/seed/erd-swp-dish-10/800/600', NULL, 3, 20, 35, 560, '1. Sơ chế và cân nguyên liệu theo định lượng.
2. Làm nóng nồi hoặc chảo, chế biến phần chính trước.
3. Thêm rau củ và gia vị, nấu đến độ chín mong muốn.
4. Nêm lại, trình bày và dùng khi còn nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Đậu hũ sốt cà chua'), (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), 'Cách làm Đậu hũ sốt cà chua', 'Đậu hũ mềm sốt cà chua chua ngọt.', 'https://picsum.photos/seed/erd-swp-dish-11/800/600', NULL, 2, 25, 40, 360, '1. Sơ chế và cân nguyên liệu theo định lượng.
2. Làm nóng nồi hoặc chảo, chế biến phần chính trước.
3. Thêm rau củ và gia vị, nấu đến độ chín mong muốn.
4. Nêm lại, trình bày và dùng khi còn nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Đậu hũ kho nấm'), (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), 'Cách làm Đậu hũ kho nấm', 'Đậu hũ kho nấm đậm vị, phù hợp ăn với cơm.', 'https://picsum.photos/seed/erd-swp-dish-12/800/600', NULL, 2, 10, 15, 390, '1. Sơ chế và cân nguyên liệu theo định lượng.
2. Làm nóng nồi hoặc chảo, chế biến phần chính trước.
3. Thêm rau củ và gia vị, nấu đến độ chín mong muốn.
4. Nêm lại, trình bày và dùng khi còn nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Đậu hũ xào sả ớt'), (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), 'Cách làm Đậu hũ xào sả ớt', 'Đậu hũ vàng giòn, thơm sả và cay nhẹ.', 'https://picsum.photos/seed/erd-swp-dish-13/800/600', NULL, 2, 15, 20, 410, '1. Sơ chế và cân nguyên liệu theo định lượng.
2. Làm nóng nồi hoặc chảo, chế biến phần chính trước.
3. Thêm rau củ và gia vị, nấu đến độ chín mong muốn.
4. Nêm lại, trình bày và dùng khi còn nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Đậu hũ áp chảo sốt mè'), (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), 'Cách làm Đậu hũ áp chảo sốt mè', 'Đậu hũ áp chảo với sốt mè thơm béo.', 'https://picsum.photos/seed/erd-swp-dish-14/800/600', NULL, 2, 20, 25, 430, '1. Sơ chế và cân nguyên liệu theo định lượng.
2. Làm nóng nồi hoặc chảo, chế biến phần chính trước.
3. Thêm rau củ và gia vị, nấu đến độ chín mong muốn.
4. Nêm lại, trình bày và dùng khi còn nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Tempeh sốt teriyaki'), (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), 'Cách làm Tempeh sốt teriyaki', 'Tempeh giàu đạm với sốt tương ngọt mặn.', 'https://picsum.photos/seed/erd-swp-dish-15/800/600', NULL, 2, 25, 30, 470, '1. Sơ chế và cân nguyên liệu theo định lượng.
2. Làm nóng nồi hoặc chảo, chế biến phần chính trước.
3. Thêm rau củ và gia vị, nấu đến độ chín mong muốn.
4. Nêm lại, trình bày và dùng khi còn nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Nấm kho tiêu'), (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), 'Cách làm Nấm kho tiêu', 'Các loại nấm kho tiêu, vị đậm và thơm.', 'https://picsum.photos/seed/erd-swp-dish-16/800/600', NULL, 2, 10, 35, 330, '1. Sơ chế và cân nguyên liệu theo định lượng.
2. Làm nóng nồi hoặc chảo, chế biến phần chính trước.
3. Thêm rau củ và gia vị, nấu đến độ chín mong muốn.
4. Nêm lại, trình bày và dùng khi còn nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Nấm xào rau củ'), (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), 'Cách làm Nấm xào rau củ', 'Nấm xào nhanh cùng bông cải và ớt chuông.', 'https://picsum.photos/seed/erd-swp-dish-17/800/600', NULL, 2, 15, 40, 350, '1. Sơ chế và cân nguyên liệu theo định lượng.
2. Làm nóng nồi hoặc chảo, chế biến phần chính trước.
3. Thêm rau củ và gia vị, nấu đến độ chín mong muốn.
4. Nêm lại, trình bày và dùng khi còn nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Rau củ kho thập cẩm'), (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), 'Cách làm Rau củ kho thập cẩm', 'Rau củ kho mềm, thích hợp cho bữa cơm gia đình.', 'https://picsum.photos/seed/erd-swp-dish-18/800/600', NULL, 2, 20, 15, 380, '1. Sơ chế và cân nguyên liệu theo định lượng.
2. Làm nóng nồi hoặc chảo, chế biến phần chính trước.
3. Thêm rau củ và gia vị, nấu đến độ chín mong muốn.
4. Nêm lại, trình bày và dùng khi còn nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Cà ri khoai lang đậu gà'), (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), 'Cách làm Cà ri khoai lang đậu gà', 'Cà ri béo nhẹ từ nước cốt dừa, khoai lang và đậu gà.', 'https://picsum.photos/seed/erd-swp-dish-19/800/600', NULL, 3, 25, 20, 520, '1. Sơ chế và cân nguyên liệu theo định lượng.
2. Làm nóng nồi hoặc chảo, chế biến phần chính trước.
3. Thêm rau củ và gia vị, nấu đến độ chín mong muốn.
4. Nêm lại, trình bày và dùng khi còn nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Đậu lăng hầm cà chua'), (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), 'Cách làm Đậu lăng hầm cà chua', 'Đậu lăng hầm cà chua giàu chất xơ và protein.', 'https://picsum.photos/seed/erd-swp-dish-20/800/600', NULL, 2, 10, 25, 450, '1. Sơ chế và cân nguyên liệu theo định lượng.
2. Làm nóng nồi hoặc chảo, chế biến phần chính trước.
3. Thêm rau củ và gia vị, nấu đến độ chín mong muốn.
4. Nêm lại, trình bày và dùng khi còn nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Canh chua chay'), (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), 'Cách làm Canh chua chay', 'Canh chua rau củ thanh mát kiểu Việt.', 'https://picsum.photos/seed/erd-swp-dish-21/800/600', NULL, 2, 15, 30, 180, '1. Sơ chế rau củ, nấm và phần đạm thực vật.
2. Chuẩn bị nước dùng hoặc nền súp, nêm nhẹ.
3. Nấu các nguyên liệu theo thứ tự từ lâu chín đến nhanh chín.
4. Hoàn thiện với rau thơm, nêm lại và dùng nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Canh bí đỏ đậu hũ'), (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), 'Cách làm Canh bí đỏ đậu hũ', 'Canh bí đỏ ngọt tự nhiên với đậu hũ.', 'https://picsum.photos/seed/erd-swp-dish-22/800/600', NULL, 2, 20, 35, 210, '1. Sơ chế rau củ, nấm và phần đạm thực vật.
2. Chuẩn bị nước dùng hoặc nền súp, nêm nhẹ.
3. Nấu các nguyên liệu theo thứ tự từ lâu chín đến nhanh chín.
4. Hoàn thiện với rau thơm, nêm lại và dùng nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Súp bí đỏ'), (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), 'Cách làm Súp bí đỏ', 'Súp bí đỏ mịn, dùng sữa yến mạch.', 'https://picsum.photos/seed/erd-swp-dish-23/800/600', NULL, 2, 25, 40, 260, '1. Sơ chế rau củ, nấm và phần đạm thực vật.
2. Chuẩn bị nước dùng hoặc nền súp, nêm nhẹ.
3. Nấu các nguyên liệu theo thứ tự từ lâu chín đến nhanh chín.
4. Hoàn thiện với rau thơm, nêm lại và dùng nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Súp nấm kem yến mạch'), (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), 'Cách làm Súp nấm kem yến mạch', 'Súp nấm béo nhẹ không dùng sữa động vật.', 'https://picsum.photos/seed/erd-swp-dish-24/800/600', NULL, 2, 10, 15, 290, '1. Sơ chế rau củ, nấm và phần đạm thực vật.
2. Chuẩn bị nước dùng hoặc nền súp, nêm nhẹ.
3. Nấu các nguyên liệu theo thứ tự từ lâu chín đến nhanh chín.
4. Hoàn thiện với rau thơm, nêm lại và dùng nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Salad đậu gà'), (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), 'Cách làm Salad đậu gà', 'Salad tươi với đậu gà, rau xanh và chanh.', 'https://picsum.photos/seed/erd-swp-dish-25/800/600', NULL, 2, 15, 20, 340, '1. Rửa sạch và để ráo toàn bộ rau củ.
2. Chuẩn bị phần đạm và ngũ cốc theo định lượng.
3. Trộn sốt riêng rồi rưới vào ngay trước khi ăn.
4. Trộn nhẹ, nêm lại và dùng ngay.'),
    ((SELECT dish_id FROM dish WHERE name='Salad quinoa rau củ'), (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), 'Cách làm Salad quinoa rau củ', 'Quinoa trộn rau củ, phù hợp meal prep.', 'https://picsum.photos/seed/erd-swp-dish-26/800/600', NULL, 2, 20, 25, 390, '1. Rửa sạch và để ráo toàn bộ rau củ.
2. Chuẩn bị phần đạm và ngũ cốc theo định lượng.
3. Trộn sốt riêng rồi rưới vào ngay trước khi ăn.
4. Trộn nhẹ, nêm lại và dùng ngay.'),
    ((SELECT dish_id FROM dish WHERE name='Salad đậu hũ mè rang'), (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), 'Cách làm Salad đậu hũ mè rang', 'Đậu hũ, rau xanh và sốt mè thơm.', 'https://picsum.photos/seed/erd-swp-dish-27/800/600', NULL, 2, 25, 30, 370, '1. Rửa sạch và để ráo toàn bộ rau củ.
2. Chuẩn bị phần đạm và ngũ cốc theo định lượng.
3. Trộn sốt riêng rồi rưới vào ngay trước khi ăn.
4. Trộn nhẹ, nêm lại và dùng ngay.'),
    ((SELECT dish_id FROM dish WHERE name='Gỏi cuốn chay'), (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), 'Cách làm Gỏi cuốn chay', 'Gỏi cuốn rau, đậu hũ và bún gạo.', 'https://picsum.photos/seed/erd-swp-dish-28/800/600', NULL, 2, 10, 35, 310, '1. Sơ chế và cân nguyên liệu theo định lượng.
2. Làm nóng nồi hoặc chảo, chế biến phần chính trước.
3. Thêm rau củ và gia vị, nấu đến độ chín mong muốn.
4. Nêm lại, trình bày và dùng khi còn nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Bì cuốn chay'), (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), 'Cách làm Bì cuốn chay', 'Cuốn rau và bì chay từ đậu hũ, khoai củ.', 'https://picsum.photos/seed/erd-swp-dish-29/800/600', NULL, 2, 15, 40, 330, '1. Sơ chế và cân nguyên liệu theo định lượng.
2. Làm nóng nồi hoặc chảo, chế biến phần chính trước.
3. Thêm rau củ và gia vị, nấu đến độ chín mong muốn.
4. Nêm lại, trình bày và dùng khi còn nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Bánh mì đậu hũ'), (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), 'Cách làm Bánh mì đậu hũ', 'Bánh mì giòn kẹp đậu hũ và rau tươi.', 'https://picsum.photos/seed/erd-swp-dish-30/800/600', NULL, 2, 20, 15, 450, '1. Sơ chế và cân nguyên liệu theo định lượng.
2. Làm nóng nồi hoặc chảo, chế biến phần chính trước.
3. Thêm rau củ và gia vị, nấu đến độ chín mong muốn.
4. Nêm lại, trình bày và dùng khi còn nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Bánh mì nấm'), (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), 'Cách làm Bánh mì nấm', 'Bánh mì kẹp nấm xào và rau chua ngọt.', 'https://picsum.photos/seed/erd-swp-dish-31/800/600', NULL, 2, 25, 20, 430, '1. Sơ chế và cân nguyên liệu theo định lượng.
2. Làm nóng nồi hoặc chảo, chế biến phần chính trước.
3. Thêm rau củ và gia vị, nấu đến độ chín mong muốn.
4. Nêm lại, trình bày và dùng khi còn nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Bánh xèo chay'), (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), 'Cách làm Bánh xèo chay', 'Bánh xèo giòn với nấm, giá và rau.', 'https://picsum.photos/seed/erd-swp-dish-32/800/600', NULL, 3, 10, 25, 520, '1. Sơ chế và cân nguyên liệu theo định lượng.
2. Làm nóng nồi hoặc chảo, chế biến phần chính trước.
3. Thêm rau củ và gia vị, nấu đến độ chín mong muốn.
4. Nêm lại, trình bày và dùng khi còn nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Bánh cuốn chay'), (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), 'Cách làm Bánh cuốn chay', 'Bánh cuốn mềm nhân nấm và đậu hũ.', 'https://picsum.photos/seed/erd-swp-dish-33/800/600', NULL, 2, 15, 30, 410, '1. Sơ chế và cân nguyên liệu theo định lượng.
2. Làm nóng nồi hoặc chảo, chế biến phần chính trước.
3. Thêm rau củ và gia vị, nấu đến độ chín mong muốn.
4. Nêm lại, trình bày và dùng khi còn nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Cháo nấm'), (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), 'Cách làm Cháo nấm', 'Cháo nấm nhẹ bụng, phù hợp bữa sáng.', 'https://picsum.photos/seed/erd-swp-dish-34/800/600', NULL, 2, 20, 35, 300, '1. Sơ chế rau củ, nấm và phần đạm thực vật.
2. Chuẩn bị nước dùng hoặc nền súp, nêm nhẹ.
3. Nấu các nguyên liệu theo thứ tự từ lâu chín đến nhanh chín.
4. Hoàn thiện với rau thơm, nêm lại và dùng nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Cháo yến mạch bí đỏ'), (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), 'Cách làm Cháo yến mạch bí đỏ', 'Yến mạch nấu bí đỏ nhanh gọn.', 'https://picsum.photos/seed/erd-swp-dish-35/800/600', NULL, 2, 25, 40, 320, '1. Sơ chế rau củ, nấm và phần đạm thực vật.
2. Chuẩn bị nước dùng hoặc nền súp, nêm nhẹ.
3. Nấu các nguyên liệu theo thứ tự từ lâu chín đến nhanh chín.
4. Hoàn thiện với rau thơm, nêm lại và dùng nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Yến mạch qua đêm chuối'), (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), 'Cách làm Yến mạch qua đêm chuối', 'Overnight oats với chuối và hạt chia.', 'https://picsum.photos/seed/erd-swp-dish-36/800/600', NULL, 2, 10, 15, 380, '1. Sơ chế và cân nguyên liệu theo định lượng.
2. Làm nóng nồi hoặc chảo, chế biến phần chính trước.
3. Thêm rau củ và gia vị, nấu đến độ chín mong muốn.
4. Nêm lại, trình bày và dùng khi còn nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Granola hạt'), (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), 'Cách làm Granola hạt', 'Granola yến mạch và các loại hạt nướng giòn.', 'https://picsum.photos/seed/erd-swp-dish-37/800/600', NULL, 2, 15, 20, 420, '1. Sơ chế và cân nguyên liệu theo định lượng.
2. Làm nóng nồi hoặc chảo, chế biến phần chính trước.
3. Thêm rau củ và gia vị, nấu đến độ chín mong muốn.
4. Nêm lại, trình bày và dùng khi còn nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Smoothie chuối yến mạch'), (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), 'Cách làm Smoothie chuối yến mạch', 'Sinh tố chuối yến mạch no lâu.', 'https://picsum.photos/seed/erd-swp-dish-38/800/600', NULL, 2, 20, 25, 330, '1. Sơ chế và cân các nguyên liệu.
2. Cho nguyên liệu lỏng vào máy xay trước.
3. Thêm phần còn lại và xay đến khi mịn.
4. Điều chỉnh độ đặc, dùng lạnh.'),
    ((SELECT dish_id FROM dish WHERE name='Smoothie xoài dừa'), (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), 'Cách làm Smoothie xoài dừa', 'Sinh tố xoài dừa mát và thơm.', 'https://picsum.photos/seed/erd-swp-dish-39/800/600', NULL, 2, 25, 30, 300, '1. Sơ chế và cân các nguyên liệu.
2. Cho nguyên liệu lỏng vào máy xay trước.
3. Thêm phần còn lại và xay đến khi mịn.
4. Điều chỉnh độ đặc, dùng lạnh.'),
    ((SELECT dish_id FROM dish WHERE name='Sữa hạt điều cacao'), (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), 'Cách làm Sữa hạt điều cacao', 'Đồ uống cacao từ hạt điều xay.', 'https://picsum.photos/seed/erd-swp-dish-40/800/600', NULL, 2, 10, 35, 280, '1. Sơ chế và cân các nguyên liệu.
2. Cho nguyên liệu lỏng vào máy xay trước.
3. Thêm phần còn lại và xay đến khi mịn.
4. Điều chỉnh độ đặc, dùng lạnh.'),
    ((SELECT dish_id FROM dish WHERE name='Chè đậu xanh'), (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), 'Cách làm Chè đậu xanh', 'Chè đậu xanh ngọt vừa với nước cốt dừa.', 'https://picsum.photos/seed/erd-swp-dish-41/800/600', NULL, 2, 15, 40, 360, '1. Ngâm và rửa đậu nếu cần.
2. Nấu đậu đến khi mềm.
3. Thêm chất tạo ngọt và nước cốt dừa, khuấy nhẹ.
4. Nêm vị vừa ăn rồi dùng nóng hoặc lạnh.'),
    ((SELECT dish_id FROM dish WHERE name='Chè đậu đỏ'), (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), 'Cách làm Chè đậu đỏ', 'Chè đậu đỏ mềm bùi, dùng nóng hoặc lạnh.', 'https://picsum.photos/seed/erd-swp-dish-42/800/600', NULL, 2, 20, 15, 380, '1. Ngâm và rửa đậu nếu cần.
2. Nấu đậu đến khi mềm.
3. Thêm chất tạo ngọt và nước cốt dừa, khuấy nhẹ.
4. Nêm vị vừa ăn rồi dùng nóng hoặc lạnh.'),
    ((SELECT dish_id FROM dish WHERE name='Khoai lang nướng mè'), (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), 'Cách làm Khoai lang nướng mè', 'Khoai lang nướng rắc mè, món nhẹ đơn giản.', 'https://picsum.photos/seed/erd-swp-dish-43/800/600', NULL, 2, 25, 20, 250, '1. Sơ chế và cân nguyên liệu theo định lượng.
2. Làm nóng nồi hoặc chảo, chế biến phần chính trước.
3. Thêm rau củ và gia vị, nấu đến độ chín mong muốn.
4. Nêm lại, trình bày và dùng khi còn nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Bánh chuối yến mạch'), (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), 'Cách làm Bánh chuối yến mạch', 'Bánh chuối yến mạch không trứng, ít đường.', 'https://picsum.photos/seed/erd-swp-dish-44/800/600', NULL, 2, 10, 25, 340, '1. Sơ chế và cân nguyên liệu theo định lượng.
2. Làm nóng nồi hoặc chảo, chế biến phần chính trước.
3. Thêm rau củ và gia vị, nấu đến độ chín mong muốn.
4. Nêm lại, trình bày và dùng khi còn nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Pasta sốt cà chua nấm'), (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), 'Cách làm Pasta sốt cà chua nấm', 'Pasta sốt cà chua và nấm kiểu đơn giản.', 'https://picsum.photos/seed/erd-swp-dish-45/800/600', NULL, 3, 15, 30, 510, '1. Sơ chế và cân nguyên liệu theo định lượng.
2. Làm nóng nồi hoặc chảo, chế biến phần chính trước.
3. Thêm rau củ và gia vị, nấu đến độ chín mong muốn.
4. Nêm lại, trình bày và dùng khi còn nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Mì xào rau củ'), (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), 'Cách làm Mì xào rau củ', 'Mì xào nhanh với rau củ giòn.', 'https://picsum.photos/seed/erd-swp-dish-46/800/600', NULL, 2, 20, 35, 480, '1. Sơ chế và cân nguyên liệu theo định lượng.
2. Làm nóng nồi hoặc chảo, chế biến phần chính trước.
3. Thêm rau củ và gia vị, nấu đến độ chín mong muốn.
4. Nêm lại, trình bày và dùng khi còn nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Miến xào nấm'), (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), 'Cách làm Miến xào nấm', 'Miến xào nấm và rau củ, vị thanh.', 'https://picsum.photos/seed/erd-swp-dish-47/800/600', NULL, 2, 25, 40, 430, '1. Sơ chế và cân nguyên liệu theo định lượng.
2. Làm nóng nồi hoặc chảo, chế biến phần chính trước.
3. Thêm rau củ và gia vị, nấu đến độ chín mong muốn.
4. Nêm lại, trình bày và dùng khi còn nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Cơm cuộn rong biển chay'), (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), 'Cách làm Cơm cuộn rong biển chay', 'Cơm cuộn rong biển với đậu hũ và rau củ.', 'https://picsum.photos/seed/erd-swp-dish-48/800/600', NULL, 2, 10, 15, 460, '1. Sơ chế và cân nguyên liệu theo định lượng.
2. Làm nóng nồi hoặc chảo, chế biến phần chính trước.
3. Thêm rau củ và gia vị, nấu đến độ chín mong muốn.
4. Nêm lại, trình bày và dùng khi còn nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Bibimbap chay'), (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), 'Cách làm Bibimbap chay', 'Cơm trộn Hàn Quốc với rau, nấm và đậu hũ.', 'https://picsum.photos/seed/erd-swp-dish-49/800/600', NULL, 3, 15, 20, 560, '1. Sơ chế và cân nguyên liệu theo định lượng.
2. Làm nóng nồi hoặc chảo, chế biến phần chính trước.
3. Thêm rau củ và gia vị, nấu đến độ chín mong muốn.
4. Nêm lại, trình bày và dùng khi còn nóng.'),
    ((SELECT dish_id FROM dish WHERE name='Buddha bowl đậu hũ'), (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), 'Cách làm Buddha bowl đậu hũ', 'Bowl cân bằng với ngũ cốc, đậu hũ và rau củ.', 'https://picsum.photos/seed/erd-swp-dish-50/800/600', NULL, 3, 20, 25, 530, '1. Sơ chế và cân nguyên liệu theo định lượng.
2. Làm nóng nồi hoặc chảo, chế biến phần chính trước.
3. Thêm rau củ và gia vị, nấu đến độ chín mong muốn.
4. Nêm lại, trình bày và dùng khi còn nóng.');
INSERT INTO recipe_ingredient (recipe_id,ingredient_id,amount,unit) VALUES
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Phở chay nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Bánh phở'), 180.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Phở chay nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Nấm đông cô'), 70.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Phở chay nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Nấm rơm'), 80.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Phở chay nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Đậu hũ'), 100.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Phở chay nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Gừng'), 10.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Phở chay nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Rau thơm'), 20.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bún bò Huế chay'), (SELECT ingredient_id FROM ingredient WHERE name='Bún gạo'), 180.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bún bò Huế chay'), (SELECT ingredient_id FROM ingredient WHERE name='Đậu hũ'), 100.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bún bò Huế chay'), (SELECT ingredient_id FROM ingredient WHERE name='Nấm bào ngư'), 90.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bún bò Huế chay'), (SELECT ingredient_id FROM ingredient WHERE name='Sả'), 20.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bún bò Huế chay'), (SELECT ingredient_id FROM ingredient WHERE name='Tương ớt'), 15.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bún bò Huế chay'), (SELECT ingredient_id FROM ingredient WHERE name='Rau thơm'), 25.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bún riêu chay'), (SELECT ingredient_id FROM ingredient WHERE name='Bún gạo'), 180.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bún riêu chay'), (SELECT ingredient_id FROM ingredient WHERE name='Đậu hũ'), 140.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bún riêu chay'), (SELECT ingredient_id FROM ingredient WHERE name='Cà chua'), 120.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bún riêu chay'), (SELECT ingredient_id FROM ingredient WHERE name='Nấm rơm'), 70.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bún riêu chay'), (SELECT ingredient_id FROM ingredient WHERE name='Tương miso'), 15.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bún riêu chay'), (SELECT ingredient_id FROM ingredient WHERE name='Rau thơm'), 20.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Mì Quảng chay'), (SELECT ingredient_id FROM ingredient WHERE name='Mì sợi'), 180.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Mì Quảng chay'), (SELECT ingredient_id FROM ingredient WHERE name='Đậu hũ'), 100.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Mì Quảng chay'), (SELECT ingredient_id FROM ingredient WHERE name='Nấm bào ngư'), 80.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Mì Quảng chay'), (SELECT ingredient_id FROM ingredient WHERE name='Nghệ'), 5.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Mì Quảng chay'), (SELECT ingredient_id FROM ingredient WHERE name='Đậu phộng'), 15.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Mì Quảng chay'), (SELECT ingredient_id FROM ingredient WHERE name='Rau thơm'), 25.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Hủ tiếu chay'), (SELECT ingredient_id FROM ingredient WHERE name='Bún gạo'), 170.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Hủ tiếu chay'), (SELECT ingredient_id FROM ingredient WHERE name='Đậu hũ'), 90.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Hủ tiếu chay'), (SELECT ingredient_id FROM ingredient WHERE name='Nấm đông cô'), 60.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Hủ tiếu chay'), (SELECT ingredient_id FROM ingredient WHERE name='Cải thìa'), 80.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Hủ tiếu chay'), (SELECT ingredient_id FROM ingredient WHERE name='Giá đỗ'), 60.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Hủ tiếu chay'), (SELECT ingredient_id FROM ingredient WHERE name='Ngò rí'), 15.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh canh nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Bột gạo'), 160.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh canh nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Nấm bào ngư'), 90.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh canh nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Nấm rơm'), 70.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh canh nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Đậu hũ'), 80.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh canh nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Cà rốt'), 60.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh canh nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Ngò rí'), 15.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cơm gạo lứt đậu hũ'), (SELECT ingredient_id FROM ingredient WHERE name='Gạo lứt'), 160.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cơm gạo lứt đậu hũ'), (SELECT ingredient_id FROM ingredient WHERE name='Đậu hũ'), 130.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cơm gạo lứt đậu hũ'), (SELECT ingredient_id FROM ingredient WHERE name='Bông cải xanh'), 90.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cơm gạo lứt đậu hũ'), (SELECT ingredient_id FROM ingredient WHERE name='Cà rốt'), 60.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cơm gạo lứt đậu hũ'), (SELECT ingredient_id FROM ingredient WHERE name='Nước tương'), 15.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cơm gạo lứt đậu hũ'), (SELECT ingredient_id FROM ingredient WHERE name='Mè trắng'), 8.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cơm chiên rau củ'), (SELECT ingredient_id FROM ingredient WHERE name='Gạo trắng'), 180.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cơm chiên rau củ'), (SELECT ingredient_id FROM ingredient WHERE name='Cà rốt'), 50.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cơm chiên rau củ'), (SELECT ingredient_id FROM ingredient WHERE name='Đậu que'), 60.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cơm chiên rau củ'), (SELECT ingredient_id FROM ingredient WHERE name='Bắp ngô'), 60.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cơm chiên rau củ'), (SELECT ingredient_id FROM ingredient WHERE name='Đậu hũ'), 80.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cơm chiên rau củ'), (SELECT ingredient_id FROM ingredient WHERE name='Nước tương'), 12.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cơm cà ri chay'), (SELECT ingredient_id FROM ingredient WHERE name='Gạo trắng'), 170.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cơm cà ri chay'), (SELECT ingredient_id FROM ingredient WHERE name='Khoai tây'), 100.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cơm cà ri chay'), (SELECT ingredient_id FROM ingredient WHERE name='Cà rốt'), 70.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cơm cà ri chay'), (SELECT ingredient_id FROM ingredient WHERE name='Đậu hũ'), 100.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cơm cà ri chay'), (SELECT ingredient_id FROM ingredient WHERE name='Nước cốt dừa'), 80.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cơm cà ri chay'), (SELECT ingredient_id FROM ingredient WHERE name='Bột cà ri'), 8.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cơm nấm sốt tiêu'), (SELECT ingredient_id FROM ingredient WHERE name='Gạo trắng'), 170.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cơm nấm sốt tiêu'), (SELECT ingredient_id FROM ingredient WHERE name='Nấm đùi gà'), 130.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cơm nấm sốt tiêu'), (SELECT ingredient_id FROM ingredient WHERE name='Ớt chuông'), 70.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cơm nấm sốt tiêu'), (SELECT ingredient_id FROM ingredient WHERE name='Nước tương'), 18.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cơm nấm sốt tiêu'), (SELECT ingredient_id FROM ingredient WHERE name='Tiêu đen'), 4.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cơm nấm sốt tiêu'), (SELECT ingredient_id FROM ingredient WHERE name='Dầu ô liu'), 10.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Đậu hũ sốt cà chua'), (SELECT ingredient_id FROM ingredient WHERE name='Đậu hũ'), 180.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Đậu hũ sốt cà chua'), (SELECT ingredient_id FROM ingredient WHERE name='Cà chua'), 160.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Đậu hũ sốt cà chua'), (SELECT ingredient_id FROM ingredient WHERE name='Sốt cà chua'), 25.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Đậu hũ sốt cà chua'), (SELECT ingredient_id FROM ingredient WHERE name='Hành boa-rô'), 15.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Đậu hũ sốt cà chua'), (SELECT ingredient_id FROM ingredient WHERE name='Nước tương'), 12.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Đậu hũ sốt cà chua'), (SELECT ingredient_id FROM ingredient WHERE name='Tiêu đen'), 2.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Đậu hũ kho nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Đậu hũ'), 170.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Đậu hũ kho nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Nấm đông cô'), 80.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Đậu hũ kho nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Nấm rơm'), 80.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Đậu hũ kho nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Nước tương'), 20.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Đậu hũ kho nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Đường thốt nốt'), 8.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Đậu hũ kho nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Tiêu đen'), 3.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Đậu hũ xào sả ớt'), (SELECT ingredient_id FROM ingredient WHERE name='Đậu hũ'), 180.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Đậu hũ xào sả ớt'), (SELECT ingredient_id FROM ingredient WHERE name='Sả'), 20.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Đậu hũ xào sả ớt'), (SELECT ingredient_id FROM ingredient WHERE name='Ớt'), 8.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Đậu hũ xào sả ớt'), (SELECT ingredient_id FROM ingredient WHERE name='Ớt chuông'), 70.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Đậu hũ xào sả ớt'), (SELECT ingredient_id FROM ingredient WHERE name='Nước tương'), 15.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Đậu hũ xào sả ớt'), (SELECT ingredient_id FROM ingredient WHERE name='Dầu ô liu'), 10.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Đậu hũ áp chảo sốt mè'), (SELECT ingredient_id FROM ingredient WHERE name='Đậu hũ'), 180.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Đậu hũ áp chảo sốt mè'), (SELECT ingredient_id FROM ingredient WHERE name='Mè trắng'), 12.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Đậu hũ áp chảo sốt mè'), (SELECT ingredient_id FROM ingredient WHERE name='Dầu mè'), 8.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Đậu hũ áp chảo sốt mè'), (SELECT ingredient_id FROM ingredient WHERE name='Nước tương'), 15.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Đậu hũ áp chảo sốt mè'), (SELECT ingredient_id FROM ingredient WHERE name='Bông cải xanh'), 80.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Đậu hũ áp chảo sốt mè'), (SELECT ingredient_id FROM ingredient WHERE name='Chanh'), 15.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Tempeh sốt teriyaki'), (SELECT ingredient_id FROM ingredient WHERE name='Tempeh'), 160.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Tempeh sốt teriyaki'), (SELECT ingredient_id FROM ingredient WHERE name='Nước tương'), 20.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Tempeh sốt teriyaki'), (SELECT ingredient_id FROM ingredient WHERE name='Đường thốt nốt'), 10.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Tempeh sốt teriyaki'), (SELECT ingredient_id FROM ingredient WHERE name='Gừng'), 8.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Tempeh sốt teriyaki'), (SELECT ingredient_id FROM ingredient WHERE name='Mè trắng'), 8.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Tempeh sốt teriyaki'), (SELECT ingredient_id FROM ingredient WHERE name='Bông cải xanh'), 90.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Nấm kho tiêu'), (SELECT ingredient_id FROM ingredient WHERE name='Nấm đùi gà'), 110.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Nấm kho tiêu'), (SELECT ingredient_id FROM ingredient WHERE name='Nấm đông cô'), 70.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Nấm kho tiêu'), (SELECT ingredient_id FROM ingredient WHERE name='Nước tương'), 18.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Nấm kho tiêu'), (SELECT ingredient_id FROM ingredient WHERE name='Tiêu đen'), 4.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Nấm kho tiêu'), (SELECT ingredient_id FROM ingredient WHERE name='Đường thốt nốt'), 6.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Nấm kho tiêu'), (SELECT ingredient_id FROM ingredient WHERE name='Hành boa-rô'), 12.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Nấm xào rau củ'), (SELECT ingredient_id FROM ingredient WHERE name='Nấm bào ngư'), 100.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Nấm xào rau củ'), (SELECT ingredient_id FROM ingredient WHERE name='Bông cải xanh'), 90.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Nấm xào rau củ'), (SELECT ingredient_id FROM ingredient WHERE name='Ớt chuông'), 70.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Nấm xào rau củ'), (SELECT ingredient_id FROM ingredient WHERE name='Cà rốt'), 60.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Nấm xào rau củ'), (SELECT ingredient_id FROM ingredient WHERE name='Nước tương'), 12.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Nấm xào rau củ'), (SELECT ingredient_id FROM ingredient WHERE name='Dầu ô liu'), 10.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Rau củ kho thập cẩm'), (SELECT ingredient_id FROM ingredient WHERE name='Khoai tây'), 90.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Rau củ kho thập cẩm'), (SELECT ingredient_id FROM ingredient WHERE name='Cà rốt'), 70.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Rau củ kho thập cẩm'), (SELECT ingredient_id FROM ingredient WHERE name='Súp lơ trắng'), 90.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Rau củ kho thập cẩm'), (SELECT ingredient_id FROM ingredient WHERE name='Nấm rơm'), 70.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Rau củ kho thập cẩm'), (SELECT ingredient_id FROM ingredient WHERE name='Nước tương'), 18.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Rau củ kho thập cẩm'), (SELECT ingredient_id FROM ingredient WHERE name='Tiêu đen'), 2.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cà ri khoai lang đậu gà'), (SELECT ingredient_id FROM ingredient WHERE name='Khoai lang'), 150.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cà ri khoai lang đậu gà'), (SELECT ingredient_id FROM ingredient WHERE name='Đậu gà'), 130.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cà ri khoai lang đậu gà'), (SELECT ingredient_id FROM ingredient WHERE name='Cà chua'), 90.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cà ri khoai lang đậu gà'), (SELECT ingredient_id FROM ingredient WHERE name='Nước cốt dừa'), 90.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cà ri khoai lang đậu gà'), (SELECT ingredient_id FROM ingredient WHERE name='Bột cà ri'), 8.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cà ri khoai lang đậu gà'), (SELECT ingredient_id FROM ingredient WHERE name='Cải bó xôi'), 60.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Đậu lăng hầm cà chua'), (SELECT ingredient_id FROM ingredient WHERE name='Đậu lăng'), 150.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Đậu lăng hầm cà chua'), (SELECT ingredient_id FROM ingredient WHERE name='Cà chua'), 140.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Đậu lăng hầm cà chua'), (SELECT ingredient_id FROM ingredient WHERE name='Cà rốt'), 60.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Đậu lăng hầm cà chua'), (SELECT ingredient_id FROM ingredient WHERE name='Cải bó xôi'), 60.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Đậu lăng hầm cà chua'), (SELECT ingredient_id FROM ingredient WHERE name='Sốt cà chua'), 25.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Đậu lăng hầm cà chua'), (SELECT ingredient_id FROM ingredient WHERE name='Tiêu đen'), 3.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Canh chua chay'), (SELECT ingredient_id FROM ingredient WHERE name='Cà chua'), 100.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Canh chua chay'), (SELECT ingredient_id FROM ingredient WHERE name='Nấm rơm'), 70.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Canh chua chay'), (SELECT ingredient_id FROM ingredient WHERE name='Đậu hũ'), 80.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Canh chua chay'), (SELECT ingredient_id FROM ingredient WHERE name='Giá đỗ'), 60.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Canh chua chay'), (SELECT ingredient_id FROM ingredient WHERE name='Chanh'), 20.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Canh chua chay'), (SELECT ingredient_id FROM ingredient WHERE name='Rau thơm'), 20.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Canh bí đỏ đậu hũ'), (SELECT ingredient_id FROM ingredient WHERE name='Bí đỏ'), 180.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Canh bí đỏ đậu hũ'), (SELECT ingredient_id FROM ingredient WHERE name='Đậu hũ'), 90.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Canh bí đỏ đậu hũ'), (SELECT ingredient_id FROM ingredient WHERE name='Nấm rơm'), 60.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Canh bí đỏ đậu hũ'), (SELECT ingredient_id FROM ingredient WHERE name='Ngò rí'), 15.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Canh bí đỏ đậu hũ'), (SELECT ingredient_id FROM ingredient WHERE name='Tiêu đen'), 2.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Canh bí đỏ đậu hũ'), (SELECT ingredient_id FROM ingredient WHERE name='Muối'), 3.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Súp bí đỏ'), (SELECT ingredient_id FROM ingredient WHERE name='Bí đỏ'), 220.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Súp bí đỏ'), (SELECT ingredient_id FROM ingredient WHERE name='Sữa yến mạch'), 120.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Súp bí đỏ'), (SELECT ingredient_id FROM ingredient WHERE name='Khoai tây'), 60.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Súp bí đỏ'), (SELECT ingredient_id FROM ingredient WHERE name='Dầu ô liu'), 8.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Súp bí đỏ'), (SELECT ingredient_id FROM ingredient WHERE name='Tiêu đen'), 2.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Súp bí đỏ'), (SELECT ingredient_id FROM ingredient WHERE name='Muối'), 3.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Súp nấm kem yến mạch'), (SELECT ingredient_id FROM ingredient WHERE name='Nấm đùi gà'), 120.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Súp nấm kem yến mạch'), (SELECT ingredient_id FROM ingredient WHERE name='Nấm đông cô'), 60.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Súp nấm kem yến mạch'), (SELECT ingredient_id FROM ingredient WHERE name='Sữa yến mạch'), 150.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Súp nấm kem yến mạch'), (SELECT ingredient_id FROM ingredient WHERE name='Khoai tây'), 60.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Súp nấm kem yến mạch'), (SELECT ingredient_id FROM ingredient WHERE name='Dầu ô liu'), 8.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Súp nấm kem yến mạch'), (SELECT ingredient_id FROM ingredient WHERE name='Tiêu đen'), 2.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Salad đậu gà'), (SELECT ingredient_id FROM ingredient WHERE name='Đậu gà'), 130.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Salad đậu gà'), (SELECT ingredient_id FROM ingredient WHERE name='Xà lách'), 80.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Salad đậu gà'), (SELECT ingredient_id FROM ingredient WHERE name='Dưa leo'), 70.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Salad đậu gà'), (SELECT ingredient_id FROM ingredient WHERE name='Cà chua'), 80.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Salad đậu gà'), (SELECT ingredient_id FROM ingredient WHERE name='Chanh'), 20.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Salad đậu gà'), (SELECT ingredient_id FROM ingredient WHERE name='Dầu ô liu'), 10.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Salad quinoa rau củ'), (SELECT ingredient_id FROM ingredient WHERE name='Quinoa'), 130.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Salad quinoa rau củ'), (SELECT ingredient_id FROM ingredient WHERE name='Dưa leo'), 70.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Salad quinoa rau củ'), (SELECT ingredient_id FROM ingredient WHERE name='Ớt chuông'), 70.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Salad quinoa rau củ'), (SELECT ingredient_id FROM ingredient WHERE name='Bắp ngô'), 60.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Salad quinoa rau củ'), (SELECT ingredient_id FROM ingredient WHERE name='Xà lách'), 70.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Salad quinoa rau củ'), (SELECT ingredient_id FROM ingredient WHERE name='Dầu ô liu'), 10.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Salad đậu hũ mè rang'), (SELECT ingredient_id FROM ingredient WHERE name='Đậu hũ'), 140.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Salad đậu hũ mè rang'), (SELECT ingredient_id FROM ingredient WHERE name='Xà lách'), 80.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Salad đậu hũ mè rang'), (SELECT ingredient_id FROM ingredient WHERE name='Dưa leo'), 60.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Salad đậu hũ mè rang'), (SELECT ingredient_id FROM ingredient WHERE name='Mè trắng'), 12.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Salad đậu hũ mè rang'), (SELECT ingredient_id FROM ingredient WHERE name='Dầu mè'), 8.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Salad đậu hũ mè rang'), (SELECT ingredient_id FROM ingredient WHERE name='Chanh'), 18.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Gỏi cuốn chay'), (SELECT ingredient_id FROM ingredient WHERE name='Bún gạo'), 100.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Gỏi cuốn chay'), (SELECT ingredient_id FROM ingredient WHERE name='Đậu hũ'), 100.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Gỏi cuốn chay'), (SELECT ingredient_id FROM ingredient WHERE name='Xà lách'), 60.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Gỏi cuốn chay'), (SELECT ingredient_id FROM ingredient WHERE name='Dưa leo'), 60.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Gỏi cuốn chay'), (SELECT ingredient_id FROM ingredient WHERE name='Cà rốt'), 50.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Gỏi cuốn chay'), (SELECT ingredient_id FROM ingredient WHERE name='Rau thơm'), 20.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bì cuốn chay'), (SELECT ingredient_id FROM ingredient WHERE name='Đậu hũ'), 110.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bì cuốn chay'), (SELECT ingredient_id FROM ingredient WHERE name='Khoai lang'), 80.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bì cuốn chay'), (SELECT ingredient_id FROM ingredient WHERE name='Cà rốt'), 50.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bì cuốn chay'), (SELECT ingredient_id FROM ingredient WHERE name='Xà lách'), 60.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bì cuốn chay'), (SELECT ingredient_id FROM ingredient WHERE name='Dưa leo'), 50.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bì cuốn chay'), (SELECT ingredient_id FROM ingredient WHERE name='Mè trắng'), 8.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh mì đậu hũ'), (SELECT ingredient_id FROM ingredient WHERE name='Bánh mì'), 120.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh mì đậu hũ'), (SELECT ingredient_id FROM ingredient WHERE name='Đậu hũ'), 120.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh mì đậu hũ'), (SELECT ingredient_id FROM ingredient WHERE name='Dưa leo'), 60.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh mì đậu hũ'), (SELECT ingredient_id FROM ingredient WHERE name='Cà rốt'), 50.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh mì đậu hũ'), (SELECT ingredient_id FROM ingredient WHERE name='Rau thơm'), 20.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh mì đậu hũ'), (SELECT ingredient_id FROM ingredient WHERE name='Nước tương'), 12.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh mì nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Bánh mì'), 120.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh mì nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Nấm bào ngư'), 120.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh mì nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Dưa leo'), 60.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh mì nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Cà rốt'), 50.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh mì nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Rau thơm'), 20.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh mì nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Nước tương'), 12.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh xèo chay'), (SELECT ingredient_id FROM ingredient WHERE name='Bột gạo'), 150.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh xèo chay'), (SELECT ingredient_id FROM ingredient WHERE name='Nước cốt dừa'), 60.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh xèo chay'), (SELECT ingredient_id FROM ingredient WHERE name='Nấm rơm'), 80.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh xèo chay'), (SELECT ingredient_id FROM ingredient WHERE name='Giá đỗ'), 80.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh xèo chay'), (SELECT ingredient_id FROM ingredient WHERE name='Đậu xanh'), 60.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh xèo chay'), (SELECT ingredient_id FROM ingredient WHERE name='Xà lách'), 70.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh cuốn chay'), (SELECT ingredient_id FROM ingredient WHERE name='Bột gạo'), 150.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh cuốn chay'), (SELECT ingredient_id FROM ingredient WHERE name='Nấm đông cô'), 70.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh cuốn chay'), (SELECT ingredient_id FROM ingredient WHERE name='Đậu hũ'), 90.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh cuốn chay'), (SELECT ingredient_id FROM ingredient WHERE name='Giá đỗ'), 60.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh cuốn chay'), (SELECT ingredient_id FROM ingredient WHERE name='Rau thơm'), 20.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh cuốn chay'), (SELECT ingredient_id FROM ingredient WHERE name='Nước tương'), 15.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cháo nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Gạo trắng'), 100.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cháo nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Nấm rơm'), 80.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cháo nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Nấm đông cô'), 50.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cháo nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Cà rốt'), 50.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cháo nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Ngò rí'), 15.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cháo nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Tiêu đen'), 2.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cháo yến mạch bí đỏ'), (SELECT ingredient_id FROM ingredient WHERE name='Yến mạch'), 90.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cháo yến mạch bí đỏ'), (SELECT ingredient_id FROM ingredient WHERE name='Bí đỏ'), 140.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cháo yến mạch bí đỏ'), (SELECT ingredient_id FROM ingredient WHERE name='Sữa yến mạch'), 100.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cháo yến mạch bí đỏ'), (SELECT ingredient_id FROM ingredient WHERE name='Hạt chia'), 8.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cháo yến mạch bí đỏ'), (SELECT ingredient_id FROM ingredient WHERE name='Muối'), 2.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cháo yến mạch bí đỏ'), (SELECT ingredient_id FROM ingredient WHERE name='Tiêu đen'), 1.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Yến mạch qua đêm chuối'), (SELECT ingredient_id FROM ingredient WHERE name='Yến mạch'), 80.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Yến mạch qua đêm chuối'), (SELECT ingredient_id FROM ingredient WHERE name='Chuối'), 120.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Yến mạch qua đêm chuối'), (SELECT ingredient_id FROM ingredient WHERE name='Sữa yến mạch'), 180.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Yến mạch qua đêm chuối'), (SELECT ingredient_id FROM ingredient WHERE name='Hạt chia'), 12.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Yến mạch qua đêm chuối'), (SELECT ingredient_id FROM ingredient WHERE name='Hạnh nhân'), 15.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Yến mạch qua đêm chuối'), (SELECT ingredient_id FROM ingredient WHERE name='Cacao'), 5.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Granola hạt'), (SELECT ingredient_id FROM ingredient WHERE name='Yến mạch'), 120.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Granola hạt'), (SELECT ingredient_id FROM ingredient WHERE name='Hạnh nhân'), 20.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Granola hạt'), (SELECT ingredient_id FROM ingredient WHERE name='Hạt điều'), 20.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Granola hạt'), (SELECT ingredient_id FROM ingredient WHERE name='Hạt bí'), 20.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Granola hạt'), (SELECT ingredient_id FROM ingredient WHERE name='Hạt chia'), 10.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Granola hạt'), (SELECT ingredient_id FROM ingredient WHERE name='Đường thốt nốt'), 12.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Smoothie chuối yến mạch'), (SELECT ingredient_id FROM ingredient WHERE name='Chuối'), 140.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Smoothie chuối yến mạch'), (SELECT ingredient_id FROM ingredient WHERE name='Yến mạch'), 50.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Smoothie chuối yến mạch'), (SELECT ingredient_id FROM ingredient WHERE name='Sữa yến mạch'), 220.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Smoothie chuối yến mạch'), (SELECT ingredient_id FROM ingredient WHERE name='Hạt chia'), 10.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Smoothie chuối yến mạch'), (SELECT ingredient_id FROM ingredient WHERE name='Bơ đậu phộng'), 15.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Smoothie chuối yến mạch'), (SELECT ingredient_id FROM ingredient WHERE name='Cacao'), 5.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Smoothie xoài dừa'), (SELECT ingredient_id FROM ingredient WHERE name='Xoài'), 160.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Smoothie xoài dừa'), (SELECT ingredient_id FROM ingredient WHERE name='Nước cốt dừa'), 80.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Smoothie xoài dừa'), (SELECT ingredient_id FROM ingredient WHERE name='Sữa yến mạch'), 120.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Smoothie xoài dừa'), (SELECT ingredient_id FROM ingredient WHERE name='Hạt chia'), 8.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Smoothie xoài dừa'), (SELECT ingredient_id FROM ingredient WHERE name='Chuối'), 60.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Smoothie xoài dừa'), (SELECT ingredient_id FROM ingredient WHERE name='Chanh'), 10.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Sữa hạt điều cacao'), (SELECT ingredient_id FROM ingredient WHERE name='Hạt điều'), 60.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Sữa hạt điều cacao'), (SELECT ingredient_id FROM ingredient WHERE name='Cacao'), 12.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Sữa hạt điều cacao'), (SELECT ingredient_id FROM ingredient WHERE name='Đường thốt nốt'), 10.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Sữa hạt điều cacao'), (SELECT ingredient_id FROM ingredient WHERE name='Sữa yến mạch'), 180.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Sữa hạt điều cacao'), (SELECT ingredient_id FROM ingredient WHERE name='Hạt chia'), 5.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Sữa hạt điều cacao'), (SELECT ingredient_id FROM ingredient WHERE name='Muối'), 1.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Chè đậu xanh'), (SELECT ingredient_id FROM ingredient WHERE name='Đậu xanh'), 140.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Chè đậu xanh'), (SELECT ingredient_id FROM ingredient WHERE name='Nước cốt dừa'), 80.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Chè đậu xanh'), (SELECT ingredient_id FROM ingredient WHERE name='Đường thốt nốt'), 30.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Chè đậu xanh'), (SELECT ingredient_id FROM ingredient WHERE name='Dừa'), 40.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Chè đậu xanh'), (SELECT ingredient_id FROM ingredient WHERE name='Hạt chia'), 5.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Chè đậu xanh'), (SELECT ingredient_id FROM ingredient WHERE name='Muối'), 1.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Chè đậu đỏ'), (SELECT ingredient_id FROM ingredient WHERE name='Đậu đỏ'), 140.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Chè đậu đỏ'), (SELECT ingredient_id FROM ingredient WHERE name='Nước cốt dừa'), 80.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Chè đậu đỏ'), (SELECT ingredient_id FROM ingredient WHERE name='Đường thốt nốt'), 30.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Chè đậu đỏ'), (SELECT ingredient_id FROM ingredient WHERE name='Dừa'), 40.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Chè đậu đỏ'), (SELECT ingredient_id FROM ingredient WHERE name='Hạt chia'), 5.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Chè đậu đỏ'), (SELECT ingredient_id FROM ingredient WHERE name='Muối'), 1.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Khoai lang nướng mè'), (SELECT ingredient_id FROM ingredient WHERE name='Khoai lang'), 220.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Khoai lang nướng mè'), (SELECT ingredient_id FROM ingredient WHERE name='Mè trắng'), 12.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Khoai lang nướng mè'), (SELECT ingredient_id FROM ingredient WHERE name='Dầu ô liu'), 8.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Khoai lang nướng mè'), (SELECT ingredient_id FROM ingredient WHERE name='Tiêu đen'), 2.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Khoai lang nướng mè'), (SELECT ingredient_id FROM ingredient WHERE name='Muối'), 2.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Khoai lang nướng mè'), (SELECT ingredient_id FROM ingredient WHERE name='Chanh'), 10.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh chuối yến mạch'), (SELECT ingredient_id FROM ingredient WHERE name='Chuối'), 160.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh chuối yến mạch'), (SELECT ingredient_id FROM ingredient WHERE name='Yến mạch'), 100.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh chuối yến mạch'), (SELECT ingredient_id FROM ingredient WHERE name='Sữa yến mạch'), 100.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh chuối yến mạch'), (SELECT ingredient_id FROM ingredient WHERE name='Hạt chia'), 10.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh chuối yến mạch'), (SELECT ingredient_id FROM ingredient WHERE name='Cacao'), 8.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh chuối yến mạch'), (SELECT ingredient_id FROM ingredient WHERE name='Hạnh nhân'), 15.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Pasta sốt cà chua nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Mì sợi'), 170.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Pasta sốt cà chua nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Cà chua'), 150.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Pasta sốt cà chua nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Nấm đùi gà'), 100.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Pasta sốt cà chua nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Sốt cà chua'), 30.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Pasta sốt cà chua nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Dầu ô liu'), 10.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Pasta sốt cà chua nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Húng quế'), 15.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Mì xào rau củ'), (SELECT ingredient_id FROM ingredient WHERE name='Mì sợi'), 170.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Mì xào rau củ'), (SELECT ingredient_id FROM ingredient WHERE name='Bông cải xanh'), 80.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Mì xào rau củ'), (SELECT ingredient_id FROM ingredient WHERE name='Cà rốt'), 60.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Mì xào rau củ'), (SELECT ingredient_id FROM ingredient WHERE name='Ớt chuông'), 60.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Mì xào rau củ'), (SELECT ingredient_id FROM ingredient WHERE name='Nấm bào ngư'), 80.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Mì xào rau củ'), (SELECT ingredient_id FROM ingredient WHERE name='Nước tương'), 15.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Miến xào nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Miến'), 160.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Miến xào nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Nấm đông cô'), 70.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Miến xào nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Nấm bào ngư'), 80.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Miến xào nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Cà rốt'), 50.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Miến xào nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Cải thìa'), 70.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Miến xào nấm'), (SELECT ingredient_id FROM ingredient WHERE name='Nước tương'), 15.00, 'ml'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cơm cuộn rong biển chay'), (SELECT ingredient_id FROM ingredient WHERE name='Gạo trắng'), 160.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cơm cuộn rong biển chay'), (SELECT ingredient_id FROM ingredient WHERE name='Rong biển'), 12.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cơm cuộn rong biển chay'), (SELECT ingredient_id FROM ingredient WHERE name='Đậu hũ'), 90.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cơm cuộn rong biển chay'), (SELECT ingredient_id FROM ingredient WHERE name='Cà rốt'), 50.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cơm cuộn rong biển chay'), (SELECT ingredient_id FROM ingredient WHERE name='Dưa leo'), 60.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Cơm cuộn rong biển chay'), (SELECT ingredient_id FROM ingredient WHERE name='Mè trắng'), 8.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bibimbap chay'), (SELECT ingredient_id FROM ingredient WHERE name='Gạo trắng'), 170.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bibimbap chay'), (SELECT ingredient_id FROM ingredient WHERE name='Đậu hũ'), 100.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bibimbap chay'), (SELECT ingredient_id FROM ingredient WHERE name='Nấm đông cô'), 60.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bibimbap chay'), (SELECT ingredient_id FROM ingredient WHERE name='Cải bó xôi'), 70.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bibimbap chay'), (SELECT ingredient_id FROM ingredient WHERE name='Cà rốt'), 60.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Bibimbap chay'), (SELECT ingredient_id FROM ingredient WHERE name='Tương ớt'), 18.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Buddha bowl đậu hũ'), (SELECT ingredient_id FROM ingredient WHERE name='Quinoa'), 130.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Buddha bowl đậu hũ'), (SELECT ingredient_id FROM ingredient WHERE name='Đậu hũ'), 130.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Buddha bowl đậu hũ'), (SELECT ingredient_id FROM ingredient WHERE name='Khoai lang'), 100.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Buddha bowl đậu hũ'), (SELECT ingredient_id FROM ingredient WHERE name='Bông cải xanh'), 80.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Buddha bowl đậu hũ'), (SELECT ingredient_id FROM ingredient WHERE name='Đậu gà'), 80.00, 'g'),
    ((SELECT recipe_id FROM recipe WHERE title='Cách làm Buddha bowl đậu hũ'), (SELECT ingredient_id FROM ingredient WHERE name='Dầu ô liu'), 10.00, 'ml');

-- 6) COMMUNITY: 20 POSTS + CATEGORY + 50 COMMENTS + 90 VOTES
INSERT INTO post (account_id,post_type,title,content,thumbnail_url,youtube_url,status,moderation_note,moderated_by,moderated_at,view_count,vote_count,comment_count,published_at,deleted_at,created_at,updated_at) VALUES
    ((SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local'), 'blog', 'Meal prep chay 3 ngày cho người bận rộn', 'Mình thường chuẩn bị gạo lứt, đậu hũ và rau củ vào tối Chủ nhật để tiết kiệm thời gian trong tuần.', 'https://picsum.photos/seed/erd-swp-post-01/1000/600', NULL, 'public', NULL, (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-09-02 10:00:00+07', 642, 0, 0, '2026-09-02 09:00:00+07', NULL, '2026-08-02 08:00:00+07', '2026-09-02 08:00:00+07'),
    ((SELECT account_id FROM account WHERE email='minh.anh@seed.erdswp.local'), 'blog', '5 nguồn protein thực vật mình dùng khi tập gym', 'Đậu hũ, tempeh, đậu gà, đậu lăng và quinoa là những lựa chọn mình dùng luân phiên.', 'https://picsum.photos/seed/erd-swp-post-02/1000/600', NULL, 'public', NULL, (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-09-03 11:00:00+07', 1280, 0, 0, '2026-09-03 10:00:00+07', NULL, '2026-08-03 08:00:00+07', '2026-09-03 08:00:00+07'),
    ((SELECT account_id FROM account WHERE email='hoang.pham@seed.erdswp.local'), 'blog', 'Lần đầu nấu phở chay nấm', 'Nước dùng rau củ và nấm tạo vị ngọt tự nhiên, không cần nêm quá nhiều.', 'https://picsum.photos/seed/erd-swp-post-03/1000/600', NULL, 'public', NULL, (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-09-04 12:00:00+07', 530, 0, 0, '2026-09-04 11:00:00+07', NULL, '2026-08-04 08:00:00+07', '2026-09-04 08:00:00+07'),
    ((SELECT account_id FROM account WHERE email='mai.le@seed.erdswp.local'), 'blog', 'Cách mình theo dõi calories khi ăn chay', 'Mình ưu tiên theo dõi khẩu phần, protein và tổng năng lượng thay vì kiêng quá nhiều món.', 'https://picsum.photos/seed/erd-swp-post-04/1000/600', NULL, 'public', NULL, (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-09-05 13:00:00+07', 910, 0, 0, '2026-09-05 12:00:00+07', NULL, '2026-08-05 08:00:00+07', '2026-09-05 08:00:00+07'),
    ((SELECT account_id FROM account WHERE email='khanh.vo@seed.erdswp.local'), 'blog', 'Review bữa trưa chay cuối tuần', 'Mình thử một combo cơm, nấm và canh. Khẩu phần vừa đủ và khá dễ ăn.', 'https://picsum.photos/seed/erd-swp-post-05/1000/600', NULL, 'public', NULL, (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-09-06 14:00:00+07', 404, 0, 0, '2026-09-06 13:00:00+07', NULL, '2026-08-06 08:00:00+07', '2026-09-06 08:00:00+07'),
    ((SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local'), 'video', 'Overnight oats cho sáng bận rộn', 'Cách mình chuẩn bị yến mạch qua đêm với chuối và hạt chia.', 'https://picsum.photos/seed/erd-swp-post-06/1000/600', 'https://www.youtube.com/watch?v=VegSeed00006', 'public', NULL, (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-09-07 15:00:00+07', 756, 0, 0, '2026-09-07 14:00:00+07', NULL, '2026-08-07 08:00:00+07', '2026-09-07 08:00:00+07'),
    ((SELECT account_id FROM account WHERE email='tuan.nguyen@seed.erdswp.local'), 'blog', 'Ba món đậu hũ dễ nấu cho người mới', 'Nếu mới tập nấu, mình thấy sốt cà chua, kho nấm và áp chảo là ba cách dễ bắt đầu.', 'https://picsum.photos/seed/erd-swp-post-07/1000/600', NULL, 'public', NULL, (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-09-08 16:00:00+07', 688, 0, 0, '2026-09-08 15:00:00+07', NULL, '2026-08-08 08:00:00+07', '2026-09-08 08:00:00+07'),
    ((SELECT account_id FROM account WHERE email='thu.do@seed.erdswp.local'), 'video', 'Salad đậu gà 10 phút', 'Một bữa nhẹ nhanh với đậu gà, xà lách, dưa leo và sốt chanh.', 'https://picsum.photos/seed/erd-swp-post-08/1000/600', 'https://www.youtube.com/watch?v=VegSeed00008', 'public', NULL, (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-09-09 09:00:00+07', 845, 0, 0, '2026-09-09 08:00:00+07', NULL, '2026-08-09 08:00:00+07', '2026-09-09 08:00:00+07'),
    ((SELECT account_id FROM account WHERE email='bao.huynh@seed.erdswp.local'), 'blog', 'Ăn chay ngoài hàng: mình thường kiểm tra gì?', 'Mình hỏi kỹ nước dùng, sốt và các thành phần có thể chứa nguyên liệu động vật.', 'https://picsum.photos/seed/erd-swp-post-09/1000/600', NULL, 'public', NULL, (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-09-10 10:00:00+07', 967, 0, 0, '2026-09-10 09:00:00+07', NULL, '2026-08-10 08:00:00+07', '2026-09-10 08:00:00+07'),
    ((SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local'), 'blog', 'Buddha bowl tự ráp theo công thức 1-1-2', 'Mình chọn một phần ngũ cốc, một phần đạm thực vật và hai phần rau củ.', 'https://picsum.photos/seed/erd-swp-post-10/1000/600', NULL, 'public', NULL, (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-09-11 11:00:00+07', 712, 0, 0, '2026-09-11 10:00:00+07', NULL, '2026-08-11 08:00:00+07', '2026-09-11 08:00:00+07'),
    ((SELECT account_id FROM account WHERE email='minh.anh@seed.erdswp.local'), 'video', 'Tempeh áp chảo cho bữa giàu protein', 'Mẹo ướp tempeh đơn giản bằng nước tương, gừng và một ít đường.', 'https://picsum.photos/seed/erd-swp-post-11/1000/600', 'https://www.youtube.com/watch?v=VegSeed00011', 'public', NULL, (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-09-12 12:00:00+07', 1114, 0, 0, '2026-09-12 11:00:00+07', NULL, '2026-08-12 08:00:00+07', '2026-09-12 08:00:00+07'),
    ((SELECT account_id FROM account WHERE email='hoang.pham@seed.erdswp.local'), 'blog', 'Nấu canh chua chay không cần quá nhiều gia vị', 'Cà chua, nấm và chanh đã tạo được vị chua ngọt khá cân bằng.', 'https://picsum.photos/seed/erd-swp-post-12/1000/600', NULL, 'public', NULL, (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-09-13 13:00:00+07', 318, 0, 0, '2026-09-13 12:00:00+07', NULL, '2026-08-13 08:00:00+07', '2026-09-13 08:00:00+07'),
    ((SELECT account_id FROM account WHERE email='mai.le@seed.erdswp.local'), 'blog', 'Gợi ý bữa tối khoảng 500 kcal', 'Một phần cơm vừa, đậu hũ và nhiều rau giúp mình dễ kiểm soát khẩu phần.', 'https://picsum.photos/seed/erd-swp-post-13/1000/600', NULL, 'public', NULL, (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), '2026-09-14 14:00:00+07', 622, 0, 0, '2026-09-14 13:00:00+07', NULL, '2026-08-14 08:00:00+07', '2026-09-14 08:00:00+07'),
    ((SELECT account_id FROM account WHERE email='khanh.vo@seed.erdswp.local'), 'video', 'Mì xào rau củ nhanh sau giờ làm', 'Mình xào lửa lớn để rau còn giòn và mì không bị nhão.', 'https://picsum.photos/seed/erd-swp-post-14/1000/600', 'https://www.youtube.com/watch?v=VegSeed00014', 'public', NULL, (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), '2026-09-15 15:00:00+07', 554, 0, 0, '2026-09-15 14:00:00+07', NULL, '2026-08-15 08:00:00+07', '2026-09-15 08:00:00+07'),
    ((SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local'), 'blog', 'Danh sách nguyên liệu mình luôn có trong bếp', 'Yến mạch, đậu hũ, nấm, rau xanh và nước tương giúp mình xoay được khá nhiều món.', 'https://picsum.photos/seed/erd-swp-post-15/1000/600', NULL, 'public', NULL, (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-09-16 16:00:00+07', 478, 0, 0, '2026-09-16 15:00:00+07', NULL, '2026-08-16 08:00:00+07', '2026-09-16 08:00:00+07'),
    ((SELECT account_id FROM account WHERE email='tuan.nguyen@seed.erdswp.local'), 'blog', 'Thử nghiệm công thức granola ít ngọt', 'Mẻ đầu tiên hơi khô, mình đang điều chỉnh tỷ lệ yến mạch và hạt.', 'https://picsum.photos/seed/erd-swp-post-16/1000/600', NULL, 'pending', NULL, NULL, NULL, 0, 0, 0, NULL, NULL, '2026-08-17 08:00:00+07', '2026-09-17 08:00:00+07'),
    ((SELECT account_id FROM account WHERE email='thu.do@seed.erdswp.local'), 'video', 'Smoothie xoài dừa phiên bản mới', 'Mình đang thử công thức ít ngọt hơn và tăng lượng trái cây.', 'https://picsum.photos/seed/erd-swp-post-17/1000/600', 'https://www.youtube.com/watch?v=VegSeed00017', 'pending', NULL, NULL, NULL, 0, 0, 0, NULL, NULL, '2026-08-18 08:00:00+07', '2026-09-18 08:00:00+07'),
    ((SELECT account_id FROM account WHERE email='duc.tran@seed.erdswp.local'), 'blog', 'Bài đăng thử nghiệm bị báo cáo', 'Đây là dữ liệu mẫu để FE hiển thị trạng thái reported và luồng moderation.', 'https://picsum.photos/seed/erd-swp-post-18/1000/600', NULL, 'reported', 'Đang chờ admin xử lý report mẫu.', NULL, NULL, 92, 0, 0, '2026-09-01 10:00:00+07', NULL, '2026-08-19 08:00:00+07', '2026-09-01 08:00:00+07'),
    ((SELECT account_id FROM account WHERE email='bao.huynh@seed.erdswp.local'), 'blog', 'Một bài cần admin xem lại', 'Dữ liệu mẫu phục vụ test report và moderation note.', 'https://picsum.photos/seed/erd-swp-post-19/1000/600', NULL, 'reported', 'Đang chờ admin xử lý report mẫu.', NULL, NULL, 120, 0, 0, '2026-09-02 10:00:00+07', NULL, '2026-08-20 08:00:00+07', '2026-09-02 08:00:00+07'),
    ((SELECT account_id FROM account WHERE email='vy.pham@seed.erdswp.local'), 'blog', 'Bài viết đã xóa mềm', 'Bản ghi này được giữ lại để test trạng thái deleted trên giao diện quản trị.', 'https://picsum.photos/seed/erd-swp-post-20/1000/600', NULL, 'deleted', 'Bài đã xóa mềm để test FE.', (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), '2026-09-10 12:00:00+07', 33, 0, 0, '2026-08-20 10:00:00+07', '2026-09-10 12:00:00+07', '2026-08-01 08:00:00+07', '2026-09-03 08:00:00+07');
INSERT INTO post_category (post_id,category_id)
SELECT p.post_id,c.category_id FROM (VALUES
    ('Meal prep chay 3 ngày cho người bận rộn', 'Meal Prep'),
    ('5 nguồn protein thực vật mình dùng khi tập gym', 'Dinh dưỡng'),
    ('Lần đầu nấu phở chay nấm', 'Kinh nghiệm'),
    ('Cách mình theo dõi calories khi ăn chay', 'Dinh dưỡng'),
    ('Review bữa trưa chay cuối tuần', 'Kinh nghiệm'),
    ('Overnight oats cho sáng bận rộn', 'Ăn sáng'),
    ('Ba món đậu hũ dễ nấu cho người mới', 'Kinh nghiệm'),
    ('Salad đậu gà 10 phút', 'Salad'),
    ('Ăn chay ngoài hàng: mình thường kiểm tra gì?', 'Kinh nghiệm'),
    ('Buddha bowl tự ráp theo công thức 1-1-2', 'Meal Prep'),
    ('Tempeh áp chảo cho bữa giàu protein', 'Dinh dưỡng'),
    ('Nấu canh chua chay không cần quá nhiều gia vị', 'Món nhẹ'),
    ('Gợi ý bữa tối khoảng 500 kcal', 'Dinh dưỡng'),
    ('Mì xào rau củ nhanh sau giờ làm', 'Món chính'),
    ('Danh sách nguyên liệu mình luôn có trong bếp', 'Meal Prep'),
    ('Thử nghiệm công thức granola ít ngọt', 'Ăn sáng'),
    ('Smoothie xoài dừa phiên bản mới', 'Đồ uống'),
    ('Bài đăng thử nghiệm bị báo cáo', 'Kinh nghiệm'),
    ('Một bài cần admin xem lại', 'Kinh nghiệm'),
    ('Bài viết đã xóa mềm', 'Kinh nghiệm')
) x(post_title,category_name) JOIN post p ON p.title=x.post_title JOIN category c ON c.name=x.category_name;
INSERT INTO comment (post_id,author_id,content,status,created_at,updated_at) VALUES
    ((SELECT post_id FROM post WHERE title='Meal prep chay 3 ngày cho người bận rộn'), (SELECT account_id FROM account WHERE email='minh.anh@seed.erdswp.local'), 'Cảm ơn bạn, mình sẽ thử công thức này.', 'public', '2026-09-01 09:30:00+07', '2026-09-01 09:30:00+07'),
    ((SELECT post_id FROM post WHERE title='5 nguồn protein thực vật mình dùng khi tập gym'), (SELECT account_id FROM account WHERE email='mai.le@seed.erdswp.local'), 'Phần chia khẩu phần khá hữu ích.', 'public', '2026-09-02 10:30:00+07', '2026-09-02 10:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Lần đầu nấu phở chay nấm'), (SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local'), 'Mình thích cách trình bày ngắn gọn.', 'public', '2026-09-03 11:30:00+07', '2026-09-03 11:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Cách mình theo dõi calories khi ăn chay'), (SELECT account_id FROM account WHERE email='thu.do@seed.erdswp.local'), 'Món này nhìn hợp để meal prep.', 'public', '2026-09-04 12:30:00+07', '2026-09-04 12:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Review bữa trưa chay cuối tuần'), (SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local'), 'Bạn có thể chia sẻ thêm cách bảo quản không?', 'public', '2026-09-05 13:30:00+07', '2026-09-05 13:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Overnight oats cho sáng bận rộn'), (SELECT account_id FROM account WHERE email='hoang.pham@seed.erdswp.local'), 'Mình đã thử và thấy khá dễ làm.', 'public', '2026-09-06 14:30:00+07', '2026-09-06 14:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Ba món đậu hũ dễ nấu cho người mới'), (SELECT account_id FROM account WHERE email='khanh.vo@seed.erdswp.local'), 'Thông tin protein rất hữu ích với mình.', 'public', '2026-09-07 15:30:00+07', '2026-09-07 15:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Salad đậu gà 10 phút'), (SELECT account_id FROM account WHERE email='tuan.nguyen@seed.erdswp.local'), 'Mình thường thay nấm bằng loại khác và vẫn ổn.', 'public', '2026-09-08 16:30:00+07', '2026-09-08 16:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Ăn chay ngoài hàng: mình thường kiểm tra gì?'), (SELECT account_id FROM account WHERE email='bao.huynh@seed.erdswp.local'), 'Bài này đúng thứ mình đang tìm.', 'public', '2026-09-09 17:30:00+07', '2026-09-09 17:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Buddha bowl tự ráp theo công thức 1-1-2'), (SELECT account_id FROM account WHERE email='minh.anh@seed.erdswp.local'), 'Mình lưu lại để cuối tuần thử.', 'public', '2026-09-10 18:30:00+07', '2026-09-10 18:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Tempeh áp chảo cho bữa giàu protein'), (SELECT account_id FROM account WHERE email='mai.le@seed.erdswp.local'), 'Nếu giảm dầu một chút chắc vẫn ngon.', 'public', '2026-09-11 09:30:00+07', '2026-09-11 09:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Nấu canh chua chay không cần quá nhiều gia vị'), (SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local'), 'Cảm ơn phần lưu ý về nguyên liệu.', 'public', '2026-09-12 10:30:00+07', '2026-09-12 10:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Gợi ý bữa tối khoảng 500 kcal'), (SELECT account_id FROM account WHERE email='thu.do@seed.erdswp.local'), 'Mình thích phiên bản ít cay hơn.', 'public', '2026-09-13 11:30:00+07', '2026-09-13 11:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Mì xào rau củ nhanh sau giờ làm'), (SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local'), 'Có thể dùng gạo lứt thay gạo trắng.', 'public', '2026-09-14 12:30:00+07', '2026-09-14 12:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Danh sách nguyên liệu mình luôn có trong bếp'), (SELECT account_id FROM account WHERE email='hoang.pham@seed.erdswp.local'), 'Mình sẽ thử cho bữa trưa văn phòng.', 'public', '2026-09-15 13:30:00+07', '2026-09-15 13:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Meal prep chay 3 ngày cho người bận rộn'), (SELECT account_id FROM account WHERE email='khanh.vo@seed.erdswp.local'), 'Cảm ơn bạn, mình sẽ thử công thức này. #16', 'public', '2026-09-16 14:30:00+07', '2026-09-16 14:30:00+07'),
    ((SELECT post_id FROM post WHERE title='5 nguồn protein thực vật mình dùng khi tập gym'), (SELECT account_id FROM account WHERE email='tuan.nguyen@seed.erdswp.local'), 'Phần chia khẩu phần khá hữu ích. #17', 'public', '2026-09-17 15:30:00+07', '2026-09-17 15:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Lần đầu nấu phở chay nấm'), (SELECT account_id FROM account WHERE email='bao.huynh@seed.erdswp.local'), 'Mình thích cách trình bày ngắn gọn. #18', 'public', '2026-09-18 16:30:00+07', '2026-09-18 16:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Cách mình theo dõi calories khi ăn chay'), (SELECT account_id FROM account WHERE email='minh.anh@seed.erdswp.local'), 'Món này nhìn hợp để meal prep. #19', 'public', '2026-09-19 17:30:00+07', '2026-09-19 17:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Review bữa trưa chay cuối tuần'), (SELECT account_id FROM account WHERE email='mai.le@seed.erdswp.local'), 'Bạn có thể chia sẻ thêm cách bảo quản không? #20', 'public', '2026-09-20 18:30:00+07', '2026-09-20 18:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Overnight oats cho sáng bận rộn'), (SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local'), 'Mình đã thử và thấy khá dễ làm. #21', 'public', '2026-09-01 09:30:00+07', '2026-09-01 09:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Ba món đậu hũ dễ nấu cho người mới'), (SELECT account_id FROM account WHERE email='thu.do@seed.erdswp.local'), 'Thông tin protein rất hữu ích với mình. #22', 'public', '2026-09-02 10:30:00+07', '2026-09-02 10:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Salad đậu gà 10 phút'), (SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local'), 'Mình thường thay nấm bằng loại khác và vẫn ổn. #23', 'public', '2026-09-03 11:30:00+07', '2026-09-03 11:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Ăn chay ngoài hàng: mình thường kiểm tra gì?'), (SELECT account_id FROM account WHERE email='hoang.pham@seed.erdswp.local'), 'Bài này đúng thứ mình đang tìm. #24', 'public', '2026-09-04 12:30:00+07', '2026-09-04 12:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Buddha bowl tự ráp theo công thức 1-1-2'), (SELECT account_id FROM account WHERE email='khanh.vo@seed.erdswp.local'), 'Mình lưu lại để cuối tuần thử. #25', 'public', '2026-09-05 13:30:00+07', '2026-09-05 13:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Tempeh áp chảo cho bữa giàu protein'), (SELECT account_id FROM account WHERE email='tuan.nguyen@seed.erdswp.local'), 'Nếu giảm dầu một chút chắc vẫn ngon. #26', 'public', '2026-09-06 14:30:00+07', '2026-09-06 14:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Nấu canh chua chay không cần quá nhiều gia vị'), (SELECT account_id FROM account WHERE email='bao.huynh@seed.erdswp.local'), 'Cảm ơn phần lưu ý về nguyên liệu. #27', 'public', '2026-09-07 15:30:00+07', '2026-09-07 15:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Gợi ý bữa tối khoảng 500 kcal'), (SELECT account_id FROM account WHERE email='minh.anh@seed.erdswp.local'), 'Mình thích phiên bản ít cay hơn. #28', 'public', '2026-09-08 16:30:00+07', '2026-09-08 16:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Mì xào rau củ nhanh sau giờ làm'), (SELECT account_id FROM account WHERE email='mai.le@seed.erdswp.local'), 'Có thể dùng gạo lứt thay gạo trắng. #29', 'public', '2026-09-09 17:30:00+07', '2026-09-09 17:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Danh sách nguyên liệu mình luôn có trong bếp'), (SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local'), 'Mình sẽ thử cho bữa trưa văn phòng. #30', 'public', '2026-09-10 18:30:00+07', '2026-09-10 18:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Meal prep chay 3 ngày cho người bận rộn'), (SELECT account_id FROM account WHERE email='thu.do@seed.erdswp.local'), 'Cảm ơn bạn, mình sẽ thử công thức này. #31', 'public', '2026-09-11 09:30:00+07', '2026-09-11 09:30:00+07'),
    ((SELECT post_id FROM post WHERE title='5 nguồn protein thực vật mình dùng khi tập gym'), (SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local'), 'Phần chia khẩu phần khá hữu ích. #32', 'public', '2026-09-12 10:30:00+07', '2026-09-12 10:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Lần đầu nấu phở chay nấm'), (SELECT account_id FROM account WHERE email='hoang.pham@seed.erdswp.local'), 'Mình thích cách trình bày ngắn gọn. #33', 'public', '2026-09-13 11:30:00+07', '2026-09-13 11:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Cách mình theo dõi calories khi ăn chay'), (SELECT account_id FROM account WHERE email='khanh.vo@seed.erdswp.local'), 'Món này nhìn hợp để meal prep. #34', 'public', '2026-09-14 12:30:00+07', '2026-09-14 12:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Review bữa trưa chay cuối tuần'), (SELECT account_id FROM account WHERE email='tuan.nguyen@seed.erdswp.local'), 'Bạn có thể chia sẻ thêm cách bảo quản không? #35', 'public', '2026-09-15 13:30:00+07', '2026-09-15 13:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Overnight oats cho sáng bận rộn'), (SELECT account_id FROM account WHERE email='bao.huynh@seed.erdswp.local'), 'Mình đã thử và thấy khá dễ làm. #36', 'public', '2026-09-16 14:30:00+07', '2026-09-16 14:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Ba món đậu hũ dễ nấu cho người mới'), (SELECT account_id FROM account WHERE email='minh.anh@seed.erdswp.local'), 'Thông tin protein rất hữu ích với mình. #37', 'public', '2026-09-17 15:30:00+07', '2026-09-17 15:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Salad đậu gà 10 phút'), (SELECT account_id FROM account WHERE email='mai.le@seed.erdswp.local'), 'Mình thường thay nấm bằng loại khác và vẫn ổn. #38', 'public', '2026-09-18 16:30:00+07', '2026-09-18 16:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Ăn chay ngoài hàng: mình thường kiểm tra gì?'), (SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local'), 'Bài này đúng thứ mình đang tìm. #39', 'public', '2026-09-19 17:30:00+07', '2026-09-19 17:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Buddha bowl tự ráp theo công thức 1-1-2'), (SELECT account_id FROM account WHERE email='thu.do@seed.erdswp.local'), 'Mình lưu lại để cuối tuần thử. #40', 'public', '2026-09-20 18:30:00+07', '2026-09-20 18:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Tempeh áp chảo cho bữa giàu protein'), (SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local'), 'Nếu giảm dầu một chút chắc vẫn ngon. #41', 'public', '2026-09-01 09:30:00+07', '2026-09-01 09:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Nấu canh chua chay không cần quá nhiều gia vị'), (SELECT account_id FROM account WHERE email='hoang.pham@seed.erdswp.local'), 'Cảm ơn phần lưu ý về nguyên liệu. #42', 'public', '2026-09-02 10:30:00+07', '2026-09-02 10:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Gợi ý bữa tối khoảng 500 kcal'), (SELECT account_id FROM account WHERE email='khanh.vo@seed.erdswp.local'), 'Mình thích phiên bản ít cay hơn. #43', 'public', '2026-09-03 11:30:00+07', '2026-09-03 11:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Mì xào rau củ nhanh sau giờ làm'), (SELECT account_id FROM account WHERE email='tuan.nguyen@seed.erdswp.local'), 'Có thể dùng gạo lứt thay gạo trắng. #44', 'public', '2026-09-04 12:30:00+07', '2026-09-04 12:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Danh sách nguyên liệu mình luôn có trong bếp'), (SELECT account_id FROM account WHERE email='bao.huynh@seed.erdswp.local'), 'Mình sẽ thử cho bữa trưa văn phòng. #45', 'public', '2026-09-05 13:30:00+07', '2026-09-05 13:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Meal prep chay 3 ngày cho người bận rộn'), (SELECT account_id FROM account WHERE email='minh.anh@seed.erdswp.local'), 'Cảm ơn bạn, mình sẽ thử công thức này. #46', 'hidden', '2026-09-06 14:30:00+07', '2026-09-06 14:30:00+07'),
    ((SELECT post_id FROM post WHERE title='5 nguồn protein thực vật mình dùng khi tập gym'), (SELECT account_id FROM account WHERE email='mai.le@seed.erdswp.local'), 'Phần chia khẩu phần khá hữu ích. #47', 'hidden', '2026-09-07 15:30:00+07', '2026-09-07 15:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Lần đầu nấu phở chay nấm'), (SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local'), 'Mình thích cách trình bày ngắn gọn. #48', 'hidden', '2026-09-08 16:30:00+07', '2026-09-08 16:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Cách mình theo dõi calories khi ăn chay'), (SELECT account_id FROM account WHERE email='thu.do@seed.erdswp.local'), 'Món này nhìn hợp để meal prep. #49', 'deleted', '2026-09-09 17:30:00+07', '2026-09-09 17:30:00+07'),
    ((SELECT post_id FROM post WHERE title='Review bữa trưa chay cuối tuần'), (SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local'), 'Bạn có thể chia sẻ thêm cách bảo quản không? #50', 'deleted', '2026-09-10 18:30:00+07', '2026-09-10 18:30:00+07');
INSERT INTO post_vote (post_id,account_id,created_at) VALUES
    ((SELECT post_id FROM post WHERE title='Meal prep chay 3 ngày cho người bận rộn'), (SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local'), '2026-09-01 10:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Meal prep chay 3 ngày cho người bận rộn'), (SELECT account_id FROM account WHERE email='minh.anh@seed.erdswp.local'), '2026-09-01 11:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Meal prep chay 3 ngày cho người bận rộn'), (SELECT account_id FROM account WHERE email='hoang.pham@seed.erdswp.local'), '2026-09-01 12:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Meal prep chay 3 ngày cho người bận rộn'), (SELECT account_id FROM account WHERE email='mai.le@seed.erdswp.local'), '2026-09-01 13:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Meal prep chay 3 ngày cho người bận rộn'), (SELECT account_id FROM account WHERE email='khanh.vo@seed.erdswp.local'), '2026-09-01 14:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Meal prep chay 3 ngày cho người bận rộn'), (SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local'), '2026-09-01 15:10:00+07'),
    ((SELECT post_id FROM post WHERE title='5 nguồn protein thực vật mình dùng khi tập gym'), (SELECT account_id FROM account WHERE email='minh.anh@seed.erdswp.local'), '2026-09-02 10:10:00+07'),
    ((SELECT post_id FROM post WHERE title='5 nguồn protein thực vật mình dùng khi tập gym'), (SELECT account_id FROM account WHERE email='hoang.pham@seed.erdswp.local'), '2026-09-02 11:10:00+07'),
    ((SELECT post_id FROM post WHERE title='5 nguồn protein thực vật mình dùng khi tập gym'), (SELECT account_id FROM account WHERE email='mai.le@seed.erdswp.local'), '2026-09-02 12:10:00+07'),
    ((SELECT post_id FROM post WHERE title='5 nguồn protein thực vật mình dùng khi tập gym'), (SELECT account_id FROM account WHERE email='khanh.vo@seed.erdswp.local'), '2026-09-02 13:10:00+07'),
    ((SELECT post_id FROM post WHERE title='5 nguồn protein thực vật mình dùng khi tập gym'), (SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local'), '2026-09-02 14:10:00+07'),
    ((SELECT post_id FROM post WHERE title='5 nguồn protein thực vật mình dùng khi tập gym'), (SELECT account_id FROM account WHERE email='tuan.nguyen@seed.erdswp.local'), '2026-09-02 15:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Lần đầu nấu phở chay nấm'), (SELECT account_id FROM account WHERE email='hoang.pham@seed.erdswp.local'), '2026-09-03 10:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Lần đầu nấu phở chay nấm'), (SELECT account_id FROM account WHERE email='mai.le@seed.erdswp.local'), '2026-09-03 11:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Lần đầu nấu phở chay nấm'), (SELECT account_id FROM account WHERE email='khanh.vo@seed.erdswp.local'), '2026-09-03 12:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Lần đầu nấu phở chay nấm'), (SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local'), '2026-09-03 13:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Lần đầu nấu phở chay nấm'), (SELECT account_id FROM account WHERE email='tuan.nguyen@seed.erdswp.local'), '2026-09-03 14:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Lần đầu nấu phở chay nấm'), (SELECT account_id FROM account WHERE email='thu.do@seed.erdswp.local'), '2026-09-03 15:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Cách mình theo dõi calories khi ăn chay'), (SELECT account_id FROM account WHERE email='mai.le@seed.erdswp.local'), '2026-09-04 10:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Cách mình theo dõi calories khi ăn chay'), (SELECT account_id FROM account WHERE email='khanh.vo@seed.erdswp.local'), '2026-09-04 11:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Cách mình theo dõi calories khi ăn chay'), (SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local'), '2026-09-04 12:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Cách mình theo dõi calories khi ăn chay'), (SELECT account_id FROM account WHERE email='tuan.nguyen@seed.erdswp.local'), '2026-09-04 13:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Cách mình theo dõi calories khi ăn chay'), (SELECT account_id FROM account WHERE email='thu.do@seed.erdswp.local'), '2026-09-04 14:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Cách mình theo dõi calories khi ăn chay'), (SELECT account_id FROM account WHERE email='bao.huynh@seed.erdswp.local'), '2026-09-04 15:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Review bữa trưa chay cuối tuần'), (SELECT account_id FROM account WHERE email='khanh.vo@seed.erdswp.local'), '2026-09-05 10:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Review bữa trưa chay cuối tuần'), (SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local'), '2026-09-05 11:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Review bữa trưa chay cuối tuần'), (SELECT account_id FROM account WHERE email='tuan.nguyen@seed.erdswp.local'), '2026-09-05 12:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Review bữa trưa chay cuối tuần'), (SELECT account_id FROM account WHERE email='thu.do@seed.erdswp.local'), '2026-09-05 13:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Review bữa trưa chay cuối tuần'), (SELECT account_id FROM account WHERE email='bao.huynh@seed.erdswp.local'), '2026-09-05 14:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Review bữa trưa chay cuối tuần'), (SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local'), '2026-09-05 15:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Overnight oats cho sáng bận rộn'), (SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local'), '2026-09-06 10:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Overnight oats cho sáng bận rộn'), (SELECT account_id FROM account WHERE email='tuan.nguyen@seed.erdswp.local'), '2026-09-06 11:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Overnight oats cho sáng bận rộn'), (SELECT account_id FROM account WHERE email='thu.do@seed.erdswp.local'), '2026-09-06 12:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Overnight oats cho sáng bận rộn'), (SELECT account_id FROM account WHERE email='bao.huynh@seed.erdswp.local'), '2026-09-06 13:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Overnight oats cho sáng bận rộn'), (SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local'), '2026-09-06 14:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Overnight oats cho sáng bận rộn'), (SELECT account_id FROM account WHERE email='minh.anh@seed.erdswp.local'), '2026-09-06 15:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Ba món đậu hũ dễ nấu cho người mới'), (SELECT account_id FROM account WHERE email='tuan.nguyen@seed.erdswp.local'), '2026-09-07 10:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Ba món đậu hũ dễ nấu cho người mới'), (SELECT account_id FROM account WHERE email='thu.do@seed.erdswp.local'), '2026-09-07 11:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Ba món đậu hũ dễ nấu cho người mới'), (SELECT account_id FROM account WHERE email='bao.huynh@seed.erdswp.local'), '2026-09-07 12:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Ba món đậu hũ dễ nấu cho người mới'), (SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local'), '2026-09-07 13:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Ba món đậu hũ dễ nấu cho người mới'), (SELECT account_id FROM account WHERE email='minh.anh@seed.erdswp.local'), '2026-09-07 14:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Ba món đậu hũ dễ nấu cho người mới'), (SELECT account_id FROM account WHERE email='hoang.pham@seed.erdswp.local'), '2026-09-07 15:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Salad đậu gà 10 phút'), (SELECT account_id FROM account WHERE email='thu.do@seed.erdswp.local'), '2026-09-08 10:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Salad đậu gà 10 phút'), (SELECT account_id FROM account WHERE email='bao.huynh@seed.erdswp.local'), '2026-09-08 11:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Salad đậu gà 10 phút'), (SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local'), '2026-09-08 12:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Salad đậu gà 10 phút'), (SELECT account_id FROM account WHERE email='minh.anh@seed.erdswp.local'), '2026-09-08 13:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Salad đậu gà 10 phút'), (SELECT account_id FROM account WHERE email='hoang.pham@seed.erdswp.local'), '2026-09-08 14:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Salad đậu gà 10 phút'), (SELECT account_id FROM account WHERE email='mai.le@seed.erdswp.local'), '2026-09-08 15:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Ăn chay ngoài hàng: mình thường kiểm tra gì?'), (SELECT account_id FROM account WHERE email='bao.huynh@seed.erdswp.local'), '2026-09-09 10:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Ăn chay ngoài hàng: mình thường kiểm tra gì?'), (SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local'), '2026-09-09 11:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Ăn chay ngoài hàng: mình thường kiểm tra gì?'), (SELECT account_id FROM account WHERE email='minh.anh@seed.erdswp.local'), '2026-09-09 12:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Ăn chay ngoài hàng: mình thường kiểm tra gì?'), (SELECT account_id FROM account WHERE email='hoang.pham@seed.erdswp.local'), '2026-09-09 13:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Ăn chay ngoài hàng: mình thường kiểm tra gì?'), (SELECT account_id FROM account WHERE email='mai.le@seed.erdswp.local'), '2026-09-09 14:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Ăn chay ngoài hàng: mình thường kiểm tra gì?'), (SELECT account_id FROM account WHERE email='khanh.vo@seed.erdswp.local'), '2026-09-09 15:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Buddha bowl tự ráp theo công thức 1-1-2'), (SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local'), '2026-09-10 10:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Buddha bowl tự ráp theo công thức 1-1-2'), (SELECT account_id FROM account WHERE email='minh.anh@seed.erdswp.local'), '2026-09-10 11:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Buddha bowl tự ráp theo công thức 1-1-2'), (SELECT account_id FROM account WHERE email='hoang.pham@seed.erdswp.local'), '2026-09-10 12:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Buddha bowl tự ráp theo công thức 1-1-2'), (SELECT account_id FROM account WHERE email='mai.le@seed.erdswp.local'), '2026-09-10 13:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Buddha bowl tự ráp theo công thức 1-1-2'), (SELECT account_id FROM account WHERE email='khanh.vo@seed.erdswp.local'), '2026-09-10 14:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Buddha bowl tự ráp theo công thức 1-1-2'), (SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local'), '2026-09-10 15:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Tempeh áp chảo cho bữa giàu protein'), (SELECT account_id FROM account WHERE email='minh.anh@seed.erdswp.local'), '2026-09-11 10:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Tempeh áp chảo cho bữa giàu protein'), (SELECT account_id FROM account WHERE email='hoang.pham@seed.erdswp.local'), '2026-09-11 11:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Tempeh áp chảo cho bữa giàu protein'), (SELECT account_id FROM account WHERE email='mai.le@seed.erdswp.local'), '2026-09-11 12:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Tempeh áp chảo cho bữa giàu protein'), (SELECT account_id FROM account WHERE email='khanh.vo@seed.erdswp.local'), '2026-09-11 13:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Tempeh áp chảo cho bữa giàu protein'), (SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local'), '2026-09-11 14:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Tempeh áp chảo cho bữa giàu protein'), (SELECT account_id FROM account WHERE email='tuan.nguyen@seed.erdswp.local'), '2026-09-11 15:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Nấu canh chua chay không cần quá nhiều gia vị'), (SELECT account_id FROM account WHERE email='hoang.pham@seed.erdswp.local'), '2026-09-12 10:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Nấu canh chua chay không cần quá nhiều gia vị'), (SELECT account_id FROM account WHERE email='mai.le@seed.erdswp.local'), '2026-09-12 11:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Nấu canh chua chay không cần quá nhiều gia vị'), (SELECT account_id FROM account WHERE email='khanh.vo@seed.erdswp.local'), '2026-09-12 12:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Nấu canh chua chay không cần quá nhiều gia vị'), (SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local'), '2026-09-12 13:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Nấu canh chua chay không cần quá nhiều gia vị'), (SELECT account_id FROM account WHERE email='tuan.nguyen@seed.erdswp.local'), '2026-09-12 14:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Nấu canh chua chay không cần quá nhiều gia vị'), (SELECT account_id FROM account WHERE email='thu.do@seed.erdswp.local'), '2026-09-12 15:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Gợi ý bữa tối khoảng 500 kcal'), (SELECT account_id FROM account WHERE email='mai.le@seed.erdswp.local'), '2026-09-13 10:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Gợi ý bữa tối khoảng 500 kcal'), (SELECT account_id FROM account WHERE email='khanh.vo@seed.erdswp.local'), '2026-09-13 11:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Gợi ý bữa tối khoảng 500 kcal'), (SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local'), '2026-09-13 12:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Gợi ý bữa tối khoảng 500 kcal'), (SELECT account_id FROM account WHERE email='tuan.nguyen@seed.erdswp.local'), '2026-09-13 13:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Gợi ý bữa tối khoảng 500 kcal'), (SELECT account_id FROM account WHERE email='thu.do@seed.erdswp.local'), '2026-09-13 14:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Gợi ý bữa tối khoảng 500 kcal'), (SELECT account_id FROM account WHERE email='bao.huynh@seed.erdswp.local'), '2026-09-13 15:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Mì xào rau củ nhanh sau giờ làm'), (SELECT account_id FROM account WHERE email='khanh.vo@seed.erdswp.local'), '2026-09-14 10:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Mì xào rau củ nhanh sau giờ làm'), (SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local'), '2026-09-14 11:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Mì xào rau củ nhanh sau giờ làm'), (SELECT account_id FROM account WHERE email='tuan.nguyen@seed.erdswp.local'), '2026-09-14 12:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Mì xào rau củ nhanh sau giờ làm'), (SELECT account_id FROM account WHERE email='thu.do@seed.erdswp.local'), '2026-09-14 13:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Mì xào rau củ nhanh sau giờ làm'), (SELECT account_id FROM account WHERE email='bao.huynh@seed.erdswp.local'), '2026-09-14 14:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Mì xào rau củ nhanh sau giờ làm'), (SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local'), '2026-09-14 15:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Danh sách nguyên liệu mình luôn có trong bếp'), (SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local'), '2026-09-15 10:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Danh sách nguyên liệu mình luôn có trong bếp'), (SELECT account_id FROM account WHERE email='tuan.nguyen@seed.erdswp.local'), '2026-09-15 11:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Danh sách nguyên liệu mình luôn có trong bếp'), (SELECT account_id FROM account WHERE email='thu.do@seed.erdswp.local'), '2026-09-15 12:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Danh sách nguyên liệu mình luôn có trong bếp'), (SELECT account_id FROM account WHERE email='bao.huynh@seed.erdswp.local'), '2026-09-15 13:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Danh sách nguyên liệu mình luôn có trong bếp'), (SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local'), '2026-09-15 14:10:00+07'),
    ((SELECT post_id FROM post WHERE title='Danh sách nguyên liệu mình luôn có trong bếp'), (SELECT account_id FROM account WHERE email='minh.anh@seed.erdswp.local'), '2026-09-15 15:10:00+07');
UPDATE post p
SET vote_count = x.cnt
FROM (SELECT post_id, count(*)::int AS cnt FROM post_vote GROUP BY post_id) x
WHERE x.post_id=p.post_id;
UPDATE post p
SET comment_count = x.cnt
FROM (SELECT post_id, count(*)::int AS cnt FROM comment WHERE status <> 'deleted' GROUP BY post_id) x
WHERE x.post_id=p.post_id;

-- 7) MODERATION: 8 REPORTS + 24 NOTIFICATIONS + KEYWORDS + ADMIN LOGS
INSERT INTO report (reporter_id,target_type,target_id,reason_code,reason_text,status,handled_by,handled_at,resolution_note,created_at) VALUES
    ((SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local'),'post',(SELECT post_id FROM post WHERE title='Bài đăng thử nghiệm bị báo cáo'),'wrong_topic','Bài mẫu để kiểm thử luồng báo cáo.','pending',NULL,NULL,NULL,'2026-09-21 09:00:00+07'),
    ((SELECT account_id FROM account WHERE email='minh.anh@seed.erdswp.local'),'post',(SELECT post_id FROM post WHERE title='Một bài cần admin xem lại'),'spam','Nội dung lặp lại và cần kiểm tra.','accepted',(SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'),'2026-09-22 11:00:00+07','Đã xác nhận report mẫu.','2026-09-21 10:00:00+07'),
    ((SELECT account_id FROM account WHERE email='hoang.pham@seed.erdswp.local'),'recipe',(SELECT recipe_id FROM recipe WHERE title='Cách làm Tempeh sốt teriyaki'),'other','Cần kiểm tra lại mô tả khẩu phần.','rejected',(SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'),'2026-09-23 14:00:00+07','Không phát hiện vi phạm.','2026-09-22 08:00:00+07'),
    ((SELECT account_id FROM account WHERE email='mai.le@seed.erdswp.local'),'recipe',(SELECT recipe_id FROM recipe WHERE title='Cách làm Bánh mì đậu hũ'),'not_vegan','Kiểm tra nguồn nguyên liệu bánh mì.','pending',NULL,NULL,NULL,'2026-09-23 09:00:00+07'),
    ((SELECT account_id FROM account WHERE email='khanh.vo@seed.erdswp.local'),'comment',(SELECT comment_id FROM comment ORDER BY comment_id OFFSET 45 LIMIT 1),'abusive','Comment mẫu cần kiểm duyệt.','accepted',(SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'),'2026-09-24 15:00:00+07','Đã ẩn comment mẫu.','2026-09-24 09:00:00+07'),
    ((SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local'),'comment',(SELECT comment_id FROM comment ORDER BY comment_id OFFSET 1 LIMIT 1),'spam','Comment mẫu nghi spam.','rejected',(SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'),'2026-09-24 16:00:00+07','Không đủ bằng chứng.','2026-09-24 10:00:00+07'),
    ((SELECT account_id FROM account WHERE email='tuan.nguyen@seed.erdswp.local'),'post',(SELECT post_id FROM post WHERE title='Meal prep chay 3 ngày cho người bận rộn'),'other','Report mẫu để test kết quả rejected.','rejected',(SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'),'2026-09-24 17:00:00+07','Bài hợp lệ.','2026-09-24 11:00:00+07'),
    ((SELECT account_id FROM account WHERE email='thu.do@seed.erdswp.local'),'recipe',(SELECT recipe_id FROM recipe WHERE title='Cách làm Salad đậu gà'),'wrong_topic','Report mẫu cho recipe.','pending',NULL,NULL,NULL,'2026-09-25 08:00:00+07');
INSERT INTO notification (account_id,type,title,content,ref_type,ref_id,is_read,created_at) VALUES
    ((SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local'), 'post_approved', 'Thông báo hệ thống', 'Đây là notification mẫu phục vụ hiển thị FE.', 'post', (SELECT post_id FROM post WHERE title='Meal prep chay 3 ngày cho người bận rộn'), true, '2026-09-24 08:00:00+07'),
    ((SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local'), 'report_result', 'Kết quả xử lý báo cáo', 'Admin đã cập nhật một báo cáo mẫu.', 'report', (SELECT report_id FROM report WHERE status IN ('accepted','rejected') ORDER BY report_id LIMIT 1), true, '2026-09-25 08:30:00+07'),
    ((SELECT account_id FROM account WHERE email='minh.anh@seed.erdswp.local'), 'dish_approved', 'Thông báo hệ thống', 'Đây là notification mẫu phục vụ hiển thị FE.', 'dish', (SELECT dish_id FROM dish WHERE name='Phở chay nấm'), false, '2026-09-24 09:00:00+07'),
    ((SELECT account_id FROM account WHERE email='minh.anh@seed.erdswp.local'), 'report_result', 'Kết quả xử lý báo cáo', 'Admin đã cập nhật một báo cáo mẫu.', 'report', (SELECT report_id FROM report WHERE status IN ('accepted','rejected') ORDER BY report_id LIMIT 1), false, '2026-09-25 09:30:00+07'),
    ((SELECT account_id FROM account WHERE email='hoang.pham@seed.erdswp.local'), 'report_result', 'Thông báo hệ thống', 'Đây là notification mẫu phục vụ hiển thị FE.', 'report', (SELECT report_id FROM report WHERE status IN ('accepted','rejected') ORDER BY report_id LIMIT 1), false, '2026-09-24 10:00:00+07'),
    ((SELECT account_id FROM account WHERE email='hoang.pham@seed.erdswp.local'), 'report_result', 'Kết quả xử lý báo cáo', 'Admin đã cập nhật một báo cáo mẫu.', 'report', (SELECT report_id FROM report WHERE status IN ('accepted','rejected') ORDER BY report_id LIMIT 1), false, '2026-09-25 10:30:00+07'),
    ((SELECT account_id FROM account WHERE email='mai.le@seed.erdswp.local'), 'post_approved', 'Thông báo hệ thống', 'Đây là notification mẫu phục vụ hiển thị FE.', 'post', (SELECT post_id FROM post WHERE title='Meal prep chay 3 ngày cho người bận rộn'), true, '2026-09-24 11:00:00+07'),
    ((SELECT account_id FROM account WHERE email='mai.le@seed.erdswp.local'), 'report_result', 'Kết quả xử lý báo cáo', 'Admin đã cập nhật một báo cáo mẫu.', 'report', (SELECT report_id FROM report WHERE status IN ('accepted','rejected') ORDER BY report_id LIMIT 1), false, '2026-09-25 11:30:00+07'),
    ((SELECT account_id FROM account WHERE email='khanh.vo@seed.erdswp.local'), 'dish_approved', 'Thông báo hệ thống', 'Đây là notification mẫu phục vụ hiển thị FE.', 'dish', (SELECT dish_id FROM dish WHERE name='Phở chay nấm'), false, '2026-09-24 12:00:00+07'),
    ((SELECT account_id FROM account WHERE email='khanh.vo@seed.erdswp.local'), 'report_result', 'Kết quả xử lý báo cáo', 'Admin đã cập nhật một báo cáo mẫu.', 'report', (SELECT report_id FROM report WHERE status IN ('accepted','rejected') ORDER BY report_id LIMIT 1), true, '2026-09-25 12:30:00+07'),
    ((SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local'), 'report_result', 'Thông báo hệ thống', 'Đây là notification mẫu phục vụ hiển thị FE.', 'report', (SELECT report_id FROM report WHERE status IN ('accepted','rejected') ORDER BY report_id LIMIT 1), false, '2026-09-24 13:00:00+07'),
    ((SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local'), 'report_result', 'Kết quả xử lý báo cáo', 'Admin đã cập nhật một báo cáo mẫu.', 'report', (SELECT report_id FROM report WHERE status IN ('accepted','rejected') ORDER BY report_id LIMIT 1), false, '2026-09-25 13:30:00+07'),
    ((SELECT account_id FROM account WHERE email='tuan.nguyen@seed.erdswp.local'), 'post_approved', 'Thông báo hệ thống', 'Đây là notification mẫu phục vụ hiển thị FE.', 'post', (SELECT post_id FROM post WHERE title='Meal prep chay 3 ngày cho người bận rộn'), true, '2026-09-24 14:00:00+07'),
    ((SELECT account_id FROM account WHERE email='tuan.nguyen@seed.erdswp.local'), 'report_result', 'Kết quả xử lý báo cáo', 'Admin đã cập nhật một báo cáo mẫu.', 'report', (SELECT report_id FROM report WHERE status IN ('accepted','rejected') ORDER BY report_id LIMIT 1), false, '2026-09-25 14:30:00+07'),
    ((SELECT account_id FROM account WHERE email='thu.do@seed.erdswp.local'), 'dish_approved', 'Thông báo hệ thống', 'Đây là notification mẫu phục vụ hiển thị FE.', 'dish', (SELECT dish_id FROM dish WHERE name='Phở chay nấm'), false, '2026-09-24 15:00:00+07'),
    ((SELECT account_id FROM account WHERE email='thu.do@seed.erdswp.local'), 'report_result', 'Kết quả xử lý báo cáo', 'Admin đã cập nhật một báo cáo mẫu.', 'report', (SELECT report_id FROM report WHERE status IN ('accepted','rejected') ORDER BY report_id LIMIT 1), false, '2026-09-25 15:30:00+07'),
    ((SELECT account_id FROM account WHERE email='bao.huynh@seed.erdswp.local'), 'report_result', 'Thông báo hệ thống', 'Đây là notification mẫu phục vụ hiển thị FE.', 'report', (SELECT report_id FROM report WHERE status IN ('accepted','rejected') ORDER BY report_id LIMIT 1), false, '2026-09-24 16:00:00+07'),
    ((SELECT account_id FROM account WHERE email='bao.huynh@seed.erdswp.local'), 'report_result', 'Kết quả xử lý báo cáo', 'Admin đã cập nhật một báo cáo mẫu.', 'report', (SELECT report_id FROM report WHERE status IN ('accepted','rejected') ORDER BY report_id LIMIT 1), true, '2026-09-25 16:30:00+07'),
    ((SELECT account_id FROM account WHERE email='ngoc.bui@seed.erdswp.local'), 'account_locked', 'Tài khoản tạm khóa', 'Thông báo mẫu để kiểm thử trạng thái tài khoản.', 'account', (SELECT account_id FROM account WHERE email='ngoc.bui@seed.erdswp.local'), true, '2026-09-24 17:00:00+07'),
    ((SELECT account_id FROM account WHERE email='ngoc.bui@seed.erdswp.local'), 'report_result', 'Kết quả xử lý báo cáo', 'Admin đã cập nhật một báo cáo mẫu.', 'report', (SELECT report_id FROM report WHERE status IN ('accepted','rejected') ORDER BY report_id LIMIT 1), false, '2026-09-25 17:30:00+07'),
    ((SELECT account_id FROM account WHERE email='duc.tran@seed.erdswp.local'), 'dish_approved', 'Thông báo hệ thống', 'Đây là notification mẫu phục vụ hiển thị FE.', 'dish', (SELECT dish_id FROM dish WHERE name='Phở chay nấm'), false, '2026-09-24 18:00:00+07'),
    ((SELECT account_id FROM account WHERE email='duc.tran@seed.erdswp.local'), 'report_result', 'Kết quả xử lý báo cáo', 'Admin đã cập nhật một báo cáo mẫu.', 'report', (SELECT report_id FROM report WHERE status IN ('accepted','rejected') ORDER BY report_id LIMIT 1), false, '2026-09-25 18:30:00+07'),
    ((SELECT account_id FROM account WHERE email='vy.pham@seed.erdswp.local'), 'report_result', 'Thông báo hệ thống', 'Đây là notification mẫu phục vụ hiển thị FE.', 'report', (SELECT report_id FROM report WHERE status IN ('accepted','rejected') ORDER BY report_id LIMIT 1), false, '2026-09-24 19:00:00+07'),
    ((SELECT account_id FROM account WHERE email='vy.pham@seed.erdswp.local'), 'report_result', 'Kết quả xử lý báo cáo', 'Admin đã cập nhật một báo cáo mẫu.', 'report', (SELECT report_id FROM report WHERE status IN ('accepted','rejected') ORDER BY report_id LIMIT 1), false, '2026-09-25 19:30:00+07');
INSERT INTO banned_keyword (keyword,normalized_keyword,scope,severity,is_active,created_by) VALUES
    ('spamlink','spamlink','both','block',true,(SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local')),
    ('quảng cáo rác','quảng cáo rác','both','warn',true,(SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local')),
    ('clickbait','clickbait','post','warn',true,(SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local')),
    ('offtopic','offtopic','post','warn',true,(SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local')),
    ('toxicword','toxicword','comment','block',true,(SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local')),
    ('copy-paste','copy-paste','both','warn',true,(SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'));
INSERT INTO admin_log (admin_id,action,target_type,target_id,reason,before_value,after_value,ip_address,created_at) VALUES
    ((SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), 'APPROVE', 'dish', (SELECT dish_id FROM dish ORDER BY dish_id LIMIT 1), 'Admin log mẫu cho FE', NULL, jsonb_build_object('seed',true,'index',1), '127.0.0.1', '2026-09-10 15:00:00+07'),
    ((SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), 'REVIEW', 'post', (SELECT post_id FROM post ORDER BY post_id LIMIT 1), 'Admin log mẫu cho FE', NULL, jsonb_build_object('seed',true,'index',2), '127.0.0.1', '2026-09-11 15:00:00+07'),
    ((SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), 'UPDATE', 'report', (SELECT report_id FROM report WHERE status IN ('accepted','rejected') ORDER BY report_id LIMIT 1), 'Admin log mẫu cho FE', NULL, jsonb_build_object('seed',true,'index',3), '127.0.0.1', '2026-09-12 15:00:00+07'),
    ((SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), 'HIDE', 'banned_keyword', (SELECT keyword_id FROM banned_keyword ORDER BY keyword_id LIMIT 1), 'Admin log mẫu cho FE', NULL, jsonb_build_object('seed',true,'index',4), '127.0.0.1', '2026-09-13 15:00:00+07'),
    ((SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), 'APPROVE', 'dish', (SELECT dish_id FROM dish ORDER BY dish_id LIMIT 1), 'Admin log mẫu cho FE', NULL, jsonb_build_object('seed',true,'index',5), '127.0.0.1', '2026-09-14 15:00:00+07'),
    ((SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), 'REVIEW', 'post', (SELECT post_id FROM post ORDER BY post_id LIMIT 1), 'Admin log mẫu cho FE', NULL, jsonb_build_object('seed',true,'index',6), '127.0.0.1', '2026-09-15 15:00:00+07'),
    ((SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), 'UPDATE', 'report', (SELECT report_id FROM report WHERE status IN ('accepted','rejected') ORDER BY report_id LIMIT 1), 'Admin log mẫu cho FE', NULL, jsonb_build_object('seed',true,'index',7), '127.0.0.1', '2026-09-16 15:00:00+07'),
    ((SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), 'HIDE', 'banned_keyword', (SELECT keyword_id FROM banned_keyword ORDER BY keyword_id LIMIT 1), 'Admin log mẫu cho FE', NULL, jsonb_build_object('seed',true,'index',8), '127.0.0.1', '2026-09-17 15:00:00+07'),
    ((SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), 'APPROVE', 'dish', (SELECT dish_id FROM dish ORDER BY dish_id LIMIT 1), 'Admin log mẫu cho FE', NULL, jsonb_build_object('seed',true,'index',9), '127.0.0.1', '2026-09-18 15:00:00+07'),
    ((SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), 'REVIEW', 'post', (SELECT post_id FROM post ORDER BY post_id LIMIT 1), 'Admin log mẫu cho FE', NULL, jsonb_build_object('seed',true,'index',10), '127.0.0.1', '2026-09-19 15:00:00+07'),
    ((SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), 'UPDATE', 'report', (SELECT report_id FROM report WHERE status IN ('accepted','rejected') ORDER BY report_id LIMIT 1), 'Admin log mẫu cho FE', NULL, jsonb_build_object('seed',true,'index',11), '127.0.0.1', '2026-09-20 15:00:00+07'),
    ((SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), 'HIDE', 'banned_keyword', (SELECT keyword_id FROM banned_keyword ORDER BY keyword_id LIMIT 1), 'Admin log mẫu cho FE', NULL, jsonb_build_object('seed',true,'index',12), '127.0.0.1', '2026-09-21 15:00:00+07');

-- 8) SHOPS: 5 SHOPS + 25 SHOP_DISH
INSERT INTO shop (name,address,phone,open_time,close_time,open_days,status,owner_account_id,verification_status,verification_note,verified_at,verified_by,created_by,created_at,updated_at) VALUES
    ('An Nhiên Vegan', '125 Nguyễn Gia Trí, Bình Thạnh, TP.HCM', '0901000001', '08:00', '21:00', 'T2-CN', 'active', (SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local'), 'verified', 'Cửa hàng demo đã xác minh.', '2026-09-01 10:00:00+07', (SELECT account_id FROM account WHERE email='admin.quan@seed.erdswp.local'), (SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local'), '2026-08-01 09:00:00+07', '2026-09-01 10:00:00+07'),
    ('Lá Xanh Kitchen', '42 Võ Văn Tần, Quận 3, TP.HCM', '0901000002', '09:00', '21:30', 'T2-CN', 'active', (SELECT account_id FROM account WHERE email='hoang.pham@seed.erdswp.local'), 'verified', 'Cửa hàng demo đã xác minh.', '2026-09-01 10:00:00+07', (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), (SELECT account_id FROM account WHERE email='hoang.pham@seed.erdswp.local'), '2026-08-01 09:00:00+07', '2026-09-01 10:00:00+07'),
    ('Mộc Vegetarian', '18 Phan Xích Long, Phú Nhuận, TP.HCM', '0901000003', '07:30', '20:30', 'T2-CN', 'active', (SELECT account_id FROM account WHERE email='khanh.vo@seed.erdswp.local'), 'verified', 'Cửa hàng demo đã xác minh.', '2026-09-01 10:00:00+07', (SELECT account_id FROM account WHERE email='admin.nam@seed.erdswp.local'), (SELECT account_id FROM account WHERE email='khanh.vo@seed.erdswp.local'), '2026-08-01 09:00:00+07', '2026-09-01 10:00:00+07'),
    ('Bếp Hạt & Rau', '210 Điện Biên Phủ, Bình Thạnh, TP.HCM', '0901000004', '10:00', '20:00', 'T2-T7', 'renovating', (SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local'), 'pending', 'Dữ liệu mẫu để test trạng thái xác minh.', NULL, NULL, (SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local'), '2026-08-01 09:00:00+07', '2026-09-01 10:00:00+07'),
    ('Green Bowl Demo', '75 Lê Văn Sỹ, Quận 3, TP.HCM', '0901000005', '09:00', '20:00', 'T2-CN', 'inactive', (SELECT account_id FROM account WHERE email='bao.huynh@seed.erdswp.local'), 'rejected', 'Dữ liệu mẫu để test trạng thái xác minh.', NULL, (SELECT account_id FROM account WHERE email='admin.ha@seed.erdswp.local'), (SELECT account_id FROM account WHERE email='bao.huynh@seed.erdswp.local'), '2026-08-01 09:00:00+07', '2026-09-01 10:00:00+07');
INSERT INTO shop_dish (shop_id,dish_id,dish_category,price,ingredient_note,is_available,created_at,updated_at,created_by,updated_by) VALUES
    ((SELECT shop_id FROM shop WHERE name='An Nhiên Vegan'), (SELECT dish_id FROM dish WHERE name='Phở chay nấm'), 'Món nước', 45000.00, 'Thành phần tham khảo theo recipe hệ thống.', true, '2026-09-01 09:00:00+07', '2026-09-20 09:00:00+07', (SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local'), (SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local')),
    ((SELECT shop_id FROM shop WHERE name='An Nhiên Vegan'), (SELECT dish_id FROM dish WHERE name='Bún riêu chay'), 'Món nước', 48000.00, 'Thành phần tham khảo theo recipe hệ thống.', true, '2026-09-01 09:00:00+07', '2026-09-20 09:00:00+07', (SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local'), (SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local')),
    ((SELECT shop_id FROM shop WHERE name='An Nhiên Vegan'), (SELECT dish_id FROM dish WHERE name='Cơm gạo lứt đậu hũ'), 'Món chính', 51000.00, 'Thành phần tham khảo theo recipe hệ thống.', true, '2026-09-01 09:00:00+07', '2026-09-20 09:00:00+07', (SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local'), (SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local')),
    ((SELECT shop_id FROM shop WHERE name='An Nhiên Vegan'), (SELECT dish_id FROM dish WHERE name='Đậu hũ sốt cà chua'), 'Món chính', 54000.00, 'Thành phần tham khảo theo recipe hệ thống.', true, '2026-09-01 09:00:00+07', '2026-09-20 09:00:00+07', (SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local'), (SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local')),
    ((SELECT shop_id FROM shop WHERE name='An Nhiên Vegan'), (SELECT dish_id FROM dish WHERE name='Gỏi cuốn chay'), 'Món nhẹ', 57000.00, 'Thành phần tham khảo theo recipe hệ thống.', true, '2026-09-01 09:00:00+07', '2026-09-20 09:00:00+07', (SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local'), (SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local')),
    ((SELECT shop_id FROM shop WHERE name='Lá Xanh Kitchen'), (SELECT dish_id FROM dish WHERE name='Bún bò Huế chay'), 'Món nước', 49000.00, 'Thành phần tham khảo theo recipe hệ thống.', true, '2026-09-01 09:00:00+07', '2026-09-20 09:00:00+07', (SELECT account_id FROM account WHERE email='hoang.pham@seed.erdswp.local'), (SELECT account_id FROM account WHERE email='hoang.pham@seed.erdswp.local')),
    ((SELECT shop_id FROM shop WHERE name='Lá Xanh Kitchen'), (SELECT dish_id FROM dish WHERE name='Mì Quảng chay'), 'Món nước', 52000.00, 'Thành phần tham khảo theo recipe hệ thống.', true, '2026-09-01 09:00:00+07', '2026-09-20 09:00:00+07', (SELECT account_id FROM account WHERE email='hoang.pham@seed.erdswp.local'), (SELECT account_id FROM account WHERE email='hoang.pham@seed.erdswp.local')),
    ((SELECT shop_id FROM shop WHERE name='Lá Xanh Kitchen'), (SELECT dish_id FROM dish WHERE name='Cơm cà ri chay'), 'Món chính', 55000.00, 'Thành phần tham khảo theo recipe hệ thống.', true, '2026-09-01 09:00:00+07', '2026-09-20 09:00:00+07', (SELECT account_id FROM account WHERE email='hoang.pham@seed.erdswp.local'), (SELECT account_id FROM account WHERE email='hoang.pham@seed.erdswp.local')),
    ((SELECT shop_id FROM shop WHERE name='Lá Xanh Kitchen'), (SELECT dish_id FROM dish WHERE name='Nấm kho tiêu'), 'Món chính', 58000.00, 'Thành phần tham khảo theo recipe hệ thống.', true, '2026-09-01 09:00:00+07', '2026-09-20 09:00:00+07', (SELECT account_id FROM account WHERE email='hoang.pham@seed.erdswp.local'), (SELECT account_id FROM account WHERE email='hoang.pham@seed.erdswp.local')),
    ((SELECT shop_id FROM shop WHERE name='Lá Xanh Kitchen'), (SELECT dish_id FROM dish WHERE name='Canh chua chay'), 'Món nhẹ', 61000.00, 'Thành phần tham khảo theo recipe hệ thống.', true, '2026-09-01 09:00:00+07', '2026-09-20 09:00:00+07', (SELECT account_id FROM account WHERE email='hoang.pham@seed.erdswp.local'), (SELECT account_id FROM account WHERE email='hoang.pham@seed.erdswp.local')),
    ((SELECT shop_id FROM shop WHERE name='Mộc Vegetarian'), (SELECT dish_id FROM dish WHERE name='Hủ tiếu chay'), 'Món nước', 53000.00, 'Thành phần tham khảo theo recipe hệ thống.', true, '2026-09-01 09:00:00+07', '2026-09-20 09:00:00+07', (SELECT account_id FROM account WHERE email='khanh.vo@seed.erdswp.local'), (SELECT account_id FROM account WHERE email='khanh.vo@seed.erdswp.local')),
    ((SELECT shop_id FROM shop WHERE name='Mộc Vegetarian'), (SELECT dish_id FROM dish WHERE name='Cơm chiên rau củ'), 'Món chính', 56000.00, 'Thành phần tham khảo theo recipe hệ thống.', true, '2026-09-01 09:00:00+07', '2026-09-20 09:00:00+07', (SELECT account_id FROM account WHERE email='khanh.vo@seed.erdswp.local'), (SELECT account_id FROM account WHERE email='khanh.vo@seed.erdswp.local')),
    ((SELECT shop_id FROM shop WHERE name='Mộc Vegetarian'), (SELECT dish_id FROM dish WHERE name='Đậu hũ kho nấm'), 'Món chính', 59000.00, 'Thành phần tham khảo theo recipe hệ thống.', true, '2026-09-01 09:00:00+07', '2026-09-20 09:00:00+07', (SELECT account_id FROM account WHERE email='khanh.vo@seed.erdswp.local'), (SELECT account_id FROM account WHERE email='khanh.vo@seed.erdswp.local')),
    ((SELECT shop_id FROM shop WHERE name='Mộc Vegetarian'), (SELECT dish_id FROM dish WHERE name='Bánh xèo chay'), 'Món chính', 62000.00, 'Thành phần tham khảo theo recipe hệ thống.', true, '2026-09-01 09:00:00+07', '2026-09-20 09:00:00+07', (SELECT account_id FROM account WHERE email='khanh.vo@seed.erdswp.local'), (SELECT account_id FROM account WHERE email='khanh.vo@seed.erdswp.local')),
    ((SELECT shop_id FROM shop WHERE name='Mộc Vegetarian'), (SELECT dish_id FROM dish WHERE name='Cháo nấm'), 'Ăn sáng', 65000.00, 'Thành phần tham khảo theo recipe hệ thống.', true, '2026-09-01 09:00:00+07', '2026-09-20 09:00:00+07', (SELECT account_id FROM account WHERE email='khanh.vo@seed.erdswp.local'), (SELECT account_id FROM account WHERE email='khanh.vo@seed.erdswp.local')),
    ((SELECT shop_id FROM shop WHERE name='Bếp Hạt & Rau'), (SELECT dish_id FROM dish WHERE name='Salad đậu gà'), 'Salad', 57000.00, 'Thành phần tham khảo theo recipe hệ thống.', true, '2026-09-01 09:00:00+07', '2026-09-20 09:00:00+07', (SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local'), (SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local')),
    ((SELECT shop_id FROM shop WHERE name='Bếp Hạt & Rau'), (SELECT dish_id FROM dish WHERE name='Salad quinoa rau củ'), 'Salad', 60000.00, 'Thành phần tham khảo theo recipe hệ thống.', true, '2026-09-01 09:00:00+07', '2026-09-20 09:00:00+07', (SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local'), (SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local')),
    ((SELECT shop_id FROM shop WHERE name='Bếp Hạt & Rau'), (SELECT dish_id FROM dish WHERE name='Yến mạch qua đêm chuối'), 'Ăn sáng', 63000.00, 'Thành phần tham khảo theo recipe hệ thống.', true, '2026-09-01 09:00:00+07', '2026-09-20 09:00:00+07', (SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local'), (SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local')),
    ((SELECT shop_id FROM shop WHERE name='Bếp Hạt & Rau'), (SELECT dish_id FROM dish WHERE name='Smoothie chuối yến mạch'), 'Đồ uống', 66000.00, 'Thành phần tham khảo theo recipe hệ thống.', false, '2026-09-01 09:00:00+07', '2026-09-20 09:00:00+07', (SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local'), (SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local')),
    ((SELECT shop_id FROM shop WHERE name='Bếp Hạt & Rau'), (SELECT dish_id FROM dish WHERE name='Buddha bowl đậu hũ'), 'Meal Prep', 69000.00, 'Thành phần tham khảo theo recipe hệ thống.', false, '2026-09-01 09:00:00+07', '2026-09-20 09:00:00+07', (SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local'), (SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local')),
    ((SELECT shop_id FROM shop WHERE name='Green Bowl Demo'), (SELECT dish_id FROM dish WHERE name='Nấm xào rau củ'), 'Món chính', 61000.00, 'Thành phần tham khảo theo recipe hệ thống.', false, '2026-09-01 09:00:00+07', '2026-09-20 09:00:00+07', (SELECT account_id FROM account WHERE email='bao.huynh@seed.erdswp.local'), (SELECT account_id FROM account WHERE email='bao.huynh@seed.erdswp.local')),
    ((SELECT shop_id FROM shop WHERE name='Green Bowl Demo'), (SELECT dish_id FROM dish WHERE name='Đậu lăng hầm cà chua'), 'Món chính', 64000.00, 'Thành phần tham khảo theo recipe hệ thống.', false, '2026-09-01 09:00:00+07', '2026-09-20 09:00:00+07', (SELECT account_id FROM account WHERE email='bao.huynh@seed.erdswp.local'), (SELECT account_id FROM account WHERE email='bao.huynh@seed.erdswp.local')),
    ((SELECT shop_id FROM shop WHERE name='Green Bowl Demo'), (SELECT dish_id FROM dish WHERE name='Súp bí đỏ'), 'Món nhẹ', 67000.00, 'Thành phần tham khảo theo recipe hệ thống.', false, '2026-09-01 09:00:00+07', '2026-09-20 09:00:00+07', (SELECT account_id FROM account WHERE email='bao.huynh@seed.erdswp.local'), (SELECT account_id FROM account WHERE email='bao.huynh@seed.erdswp.local')),
    ((SELECT shop_id FROM shop WHERE name='Green Bowl Demo'), (SELECT dish_id FROM dish WHERE name='Bánh mì nấm'), 'Ăn sáng', 70000.00, 'Thành phần tham khảo theo recipe hệ thống.', false, '2026-09-01 09:00:00+07', '2026-09-20 09:00:00+07', (SELECT account_id FROM account WHERE email='bao.huynh@seed.erdswp.local'), (SELECT account_id FROM account WHERE email='bao.huynh@seed.erdswp.local')),
    ((SELECT shop_id FROM shop WHERE name='Green Bowl Demo'), (SELECT dish_id FROM dish WHERE name='Khoai lang nướng mè'), 'Món nhẹ', 73000.00, 'Thành phần tham khảo theo recipe hệ thống.', false, '2026-09-01 09:00:00+07', '2026-09-20 09:00:00+07', (SELECT account_id FROM account WHERE email='bao.huynh@seed.erdswp.local'), (SELECT account_id FROM account WHERE email='bao.huynh@seed.erdswp.local'));

-- 9) AI/MEAL PLAN: 5 PLANS + 51 ITEMS + 5 CHAT SESSIONS + 15 MESSAGES
INSERT INTO meal_plan (account_id,title,start_date,days_count,meals_per_day,source,bmi_snapshot,target_calories_kcal,goal_snapshot,allergy_snapshot,available_ingredients,status,ai_model,prompt_tokens,completion_tokens,created_at,updated_at) VALUES
    ((SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local'), 'Meal plan 7 ngày cân bằng', '2026-09-28', 7, 3, 'ai', 20.3, 1850, 'maintain', '["Đậu phộng"]'::jsonb, 'đậu hũ, nấm, rau xanh, gạo lứt', 'saved', 'gpt-seed-demo', 1200, 800, '2026-09-25 09:00:00+07', '2026-09-25 09:00:00+07'),
    ((SELECT account_id FROM account WHERE email='minh.anh@seed.erdswp.local'), 'Meal plan tăng cơ thực vật', '2026-09-28', 7, 3, 'ai', 21.3, 2300, 'gain_muscle', '["Hạt điều"]'::jsonb, 'đậu hũ, nấm, rau xanh, gạo lứt', 'saved', 'gpt-seed-demo', 1250, 840, '2026-09-25 09:00:00+07', '2026-09-25 09:00:00+07'),
    ((SELECT account_id FROM account WHERE email='mai.le@seed.erdswp.local'), 'Bản nháp giảm cân tuần tới', '2026-10-05', 7, 3, 'manual', 24.4, 1500, 'lose_weight', '["Mè"]'::jsonb, 'đậu hũ, nấm, rau xanh, gạo lứt', 'draft', NULL, NULL, NULL, '2026-09-25 09:00:00+07', '2026-09-25 09:00:00+07'),
    ((SELECT account_id FROM account WHERE email='yen.tran@seed.erdswp.local'), 'Meal plan văn phòng', '2026-10-05', 5, 3, 'ai', 18.7, 1600, 'maintain', '["Đậu nành"]'::jsonb, 'đậu gà, nấm, rau xanh, gạo lứt', 'draft', 'gpt-seed-demo', 1350, 920, '2026-09-25 09:00:00+07', '2026-09-25 09:00:00+07'),
    ((SELECT account_id FROM account WHERE email='bao.huynh@seed.erdswp.local'), 'Kế hoạch cũ tháng 9', '2026-09-01', 7, 3, 'ai', 27.7, 1900, 'lose_weight', '["Gluten"]'::jsonb, 'đậu hũ, nấm, rau xanh, gạo lứt', 'archived', 'gpt-seed-demo', 1400, 960, '2026-09-25 09:00:00+07', '2026-09-25 09:00:00+07');
INSERT INTO meal_plan_item (meal_plan_id,day_no,meal_slot,dish_id,dish_name,description,calories_kcal,nutrition_group,ingredients,is_swapped,original_dish_name) VALUES
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan 7 ngày cân bằng'), 1, 'breakfast', (SELECT dish_id FROM dish WHERE name='Bánh mì đậu hũ'), 'Bánh mì đậu hũ', 'Bánh mì giòn kẹp đậu hũ và rau tươi.', 450, 'carb', '["Bánh mì","Đậu hũ","Dưa leo","Cà rốt"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan 7 ngày cân bằng'), 1, 'lunch', (SELECT dish_id FROM dish WHERE name='Cơm gạo lứt đậu hũ'), 'Cơm gạo lứt đậu hũ', 'Cơm gạo lứt ăn cùng đậu hũ và rau củ.', 520, 'protein', '["Gạo lứt","Đậu hũ","Bông cải xanh","Cà rốt"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan 7 ngày cân bằng'), 1, 'dinner', (SELECT dish_id FROM dish WHERE name='Phở chay nấm'), 'Phở chay nấm', 'Nước dùng thanh từ rau củ, ăn cùng nấm và đậu hũ.', 420, 'vegetable', '["Bánh phở","Nấm đông cô","Nấm rơm","Đậu hũ"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan 7 ngày cân bằng'), 2, 'breakfast', (SELECT dish_id FROM dish WHERE name='Cháo nấm'), 'Cháo nấm', 'Cháo nấm nhẹ bụng, phù hợp bữa sáng.', 300, 'carb', '["Gạo trắng","Nấm rơm","Nấm đông cô","Cà rốt"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan 7 ngày cân bằng'), 2, 'lunch', (SELECT dish_id FROM dish WHERE name='Cơm cà ri chay'), 'Cơm cà ri chay', 'Cà ri rau củ béo nhẹ dùng với cơm nóng.', 590, 'protein', '["Gạo trắng","Khoai tây","Cà rốt","Đậu hũ"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan 7 ngày cân bằng'), 2, 'dinner', (SELECT dish_id FROM dish WHERE name='Bún riêu chay'), 'Bún riêu chay', 'Bún riêu với riêu đậu hũ và cà chua.', 430, 'vegetable', '["Bún gạo","Đậu hũ","Cà chua","Nấm rơm"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan 7 ngày cân bằng'), 3, 'breakfast', (SELECT dish_id FROM dish WHERE name='Yến mạch qua đêm chuối'), 'Yến mạch qua đêm chuối', 'Overnight oats với chuối và hạt chia.', 380, 'carb', '["Yến mạch","Chuối","Sữa yến mạch","Hạt chia"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan 7 ngày cân bằng'), 3, 'lunch', (SELECT dish_id FROM dish WHERE name='Salad quinoa rau củ'), 'Salad quinoa rau củ', 'Quinoa trộn rau củ, phù hợp meal prep.', 390, 'protein', '["Quinoa","Dưa leo","Ớt chuông","Bắp ngô"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan 7 ngày cân bằng'), 3, 'dinner', (SELECT dish_id FROM dish WHERE name='Canh chua chay'), 'Canh chua chay', 'Canh chua rau củ thanh mát kiểu Việt.', 180, 'vegetable', '["Cà chua","Nấm rơm","Đậu hũ","Giá đỗ"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan 7 ngày cân bằng'), 4, 'breakfast', (SELECT dish_id FROM dish WHERE name='Cháo yến mạch bí đỏ'), 'Cháo yến mạch bí đỏ', 'Yến mạch nấu bí đỏ nhanh gọn.', 320, 'carb', '["Yến mạch","Bí đỏ","Sữa yến mạch","Hạt chia"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan 7 ngày cân bằng'), 4, 'lunch', (SELECT dish_id FROM dish WHERE name='Đậu lăng hầm cà chua'), 'Đậu lăng hầm cà chua', 'Đậu lăng hầm cà chua giàu chất xơ và protein.', 450, 'protein', '["Đậu lăng","Cà chua","Cà rốt","Cải bó xôi"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan 7 ngày cân bằng'), 4, 'dinner', (SELECT dish_id FROM dish WHERE name='Nấm xào rau củ'), 'Nấm xào rau củ', 'Nấm xào nhanh cùng bông cải và ớt chuông.', 350, 'vegetable', '["Nấm bào ngư","Bông cải xanh","Ớt chuông","Cà rốt"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan 7 ngày cân bằng'), 5, 'breakfast', (SELECT dish_id FROM dish WHERE name='Bánh cuốn chay'), 'Bánh cuốn chay', 'Bánh cuốn mềm nhân nấm và đậu hũ.', 410, 'carb', '["Bột gạo","Nấm đông cô","Đậu hũ","Giá đỗ"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan 7 ngày cân bằng'), 5, 'lunch', (SELECT dish_id FROM dish WHERE name='Cơm nấm sốt tiêu'), 'Cơm nấm sốt tiêu', 'Nấm áp chảo sốt tiêu đen ăn cùng cơm.', 560, 'protein', '["Gạo trắng","Nấm đùi gà","Ớt chuông","Nước tương"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan 7 ngày cân bằng'), 5, 'dinner', (SELECT dish_id FROM dish WHERE name='Đậu hũ kho nấm'), 'Đậu hũ kho nấm', 'Đậu hũ kho nấm đậm vị, phù hợp ăn với cơm.', 390, 'vegetable', '["Đậu hũ","Nấm đông cô","Nấm rơm","Nước tương"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan 7 ngày cân bằng'), 6, 'breakfast', (SELECT dish_id FROM dish WHERE name='Granola hạt'), 'Granola hạt', 'Granola yến mạch và các loại hạt nướng giòn.', 420, 'carb', '["Yến mạch","Hạnh nhân","Hạt điều","Hạt bí"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan 7 ngày cân bằng'), 6, 'lunch', (SELECT dish_id FROM dish WHERE name='Buddha bowl đậu hũ'), 'Buddha bowl đậu hũ', 'Bowl cân bằng với ngũ cốc, đậu hũ và rau củ.', 530, 'protein', '["Quinoa","Đậu hũ","Khoai lang","Bông cải xanh"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan 7 ngày cân bằng'), 6, 'dinner', (SELECT dish_id FROM dish WHERE name='Mì xào rau củ'), 'Mì xào rau củ', 'Mì xào nhanh với rau củ giòn.', 480, 'vegetable', '["Mì sợi","Bông cải xanh","Cà rốt","Ớt chuông"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan 7 ngày cân bằng'), 7, 'breakfast', (SELECT dish_id FROM dish WHERE name='Bánh mì nấm'), 'Bánh mì nấm', 'Bánh mì kẹp nấm xào và rau chua ngọt.', 430, 'carb', '["Bánh mì","Nấm bào ngư","Dưa leo","Cà rốt"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan 7 ngày cân bằng'), 7, 'lunch', (SELECT dish_id FROM dish WHERE name='Cơm chiên rau củ'), 'Cơm chiên rau củ', 'Cơm chiên ít dầu với rau củ nhiều màu sắc.', 540, 'protein', '["Gạo trắng","Cà rốt","Đậu que","Bắp ngô"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan 7 ngày cân bằng'), 7, 'dinner', (SELECT dish_id FROM dish WHERE name='Hủ tiếu chay'), 'Hủ tiếu chay', 'Hủ tiếu rau củ nấm theo phong cách miền Nam.', 440, 'vegetable', '["Bún gạo","Đậu hũ","Nấm đông cô","Cải thìa"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan tăng cơ thực vật'), 1, 'breakfast', (SELECT dish_id FROM dish WHERE name='Cháo nấm'), 'Cháo nấm', 'Cháo nấm nhẹ bụng, phù hợp bữa sáng.', 300, 'carb', '["Gạo trắng","Nấm rơm","Nấm đông cô","Cà rốt"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan tăng cơ thực vật'), 1, 'lunch', (SELECT dish_id FROM dish WHERE name='Cơm cà ri chay'), 'Cơm cà ri chay', 'Cà ri rau củ béo nhẹ dùng với cơm nóng.', 590, 'protein', '["Gạo trắng","Khoai tây","Cà rốt","Đậu hũ"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan tăng cơ thực vật'), 1, 'dinner', (SELECT dish_id FROM dish WHERE name='Bún riêu chay'), 'Bún riêu chay', 'Bún riêu với riêu đậu hũ và cà chua.', 430, 'vegetable', '["Bún gạo","Đậu hũ","Cà chua","Nấm rơm"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan tăng cơ thực vật'), 2, 'breakfast', (SELECT dish_id FROM dish WHERE name='Yến mạch qua đêm chuối'), 'Yến mạch qua đêm chuối', 'Overnight oats với chuối và hạt chia.', 380, 'carb', '["Yến mạch","Chuối","Sữa yến mạch","Hạt chia"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan tăng cơ thực vật'), 2, 'lunch', (SELECT dish_id FROM dish WHERE name='Salad quinoa rau củ'), 'Salad quinoa rau củ', 'Quinoa trộn rau củ, phù hợp meal prep.', 390, 'protein', '["Quinoa","Dưa leo","Ớt chuông","Bắp ngô"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan tăng cơ thực vật'), 2, 'dinner', (SELECT dish_id FROM dish WHERE name='Canh chua chay'), 'Canh chua chay', 'Canh chua rau củ thanh mát kiểu Việt.', 180, 'vegetable', '["Cà chua","Nấm rơm","Đậu hũ","Giá đỗ"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan tăng cơ thực vật'), 3, 'breakfast', (SELECT dish_id FROM dish WHERE name='Cháo yến mạch bí đỏ'), 'Cháo yến mạch bí đỏ', 'Yến mạch nấu bí đỏ nhanh gọn.', 320, 'carb', '["Yến mạch","Bí đỏ","Sữa yến mạch","Hạt chia"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan tăng cơ thực vật'), 3, 'lunch', (SELECT dish_id FROM dish WHERE name='Đậu lăng hầm cà chua'), 'Đậu lăng hầm cà chua', 'Đậu lăng hầm cà chua giàu chất xơ và protein.', 450, 'protein', '["Đậu lăng","Cà chua","Cà rốt","Cải bó xôi"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan tăng cơ thực vật'), 3, 'dinner', (SELECT dish_id FROM dish WHERE name='Nấm xào rau củ'), 'Nấm xào rau củ', 'Nấm xào nhanh cùng bông cải và ớt chuông.', 350, 'vegetable', '["Nấm bào ngư","Bông cải xanh","Ớt chuông","Cà rốt"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan tăng cơ thực vật'), 4, 'breakfast', (SELECT dish_id FROM dish WHERE name='Bánh cuốn chay'), 'Bánh cuốn chay', 'Bánh cuốn mềm nhân nấm và đậu hũ.', 410, 'carb', '["Bột gạo","Nấm đông cô","Đậu hũ","Giá đỗ"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan tăng cơ thực vật'), 4, 'lunch', (SELECT dish_id FROM dish WHERE name='Cơm nấm sốt tiêu'), 'Cơm nấm sốt tiêu', 'Nấm áp chảo sốt tiêu đen ăn cùng cơm.', 560, 'protein', '["Gạo trắng","Nấm đùi gà","Ớt chuông","Nước tương"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan tăng cơ thực vật'), 4, 'dinner', (SELECT dish_id FROM dish WHERE name='Đậu hũ kho nấm'), 'Đậu hũ kho nấm', 'Đậu hũ kho nấm đậm vị, phù hợp ăn với cơm.', 390, 'vegetable', '["Đậu hũ","Nấm đông cô","Nấm rơm","Nước tương"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan tăng cơ thực vật'), 5, 'breakfast', (SELECT dish_id FROM dish WHERE name='Cháo nấm'), 'Cháo nấm', 'Cháo nấm nhẹ bụng, phù hợp bữa sáng.', 300, 'carb', '["Gạo trắng","Nấm rơm","Nấm đông cô","Cà rốt"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan tăng cơ thực vật'), 5, 'lunch', (SELECT dish_id FROM dish WHERE name='Buddha bowl đậu hũ'), 'Buddha bowl đậu hũ', 'Bowl cân bằng với ngũ cốc, đậu hũ và rau củ.', 530, 'protein', '["Quinoa","Đậu hũ","Khoai lang","Bông cải xanh"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan tăng cơ thực vật'), 5, 'dinner', (SELECT dish_id FROM dish WHERE name='Mì xào rau củ'), 'Mì xào rau củ', 'Mì xào nhanh với rau củ giòn.', 480, 'vegetable', '["Mì sợi","Bông cải xanh","Cà rốt","Ớt chuông"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan tăng cơ thực vật'), 6, 'breakfast', (SELECT dish_id FROM dish WHERE name='Bánh mì nấm'), 'Bánh mì nấm', 'Bánh mì kẹp nấm xào và rau chua ngọt.', 430, 'carb', '["Bánh mì","Nấm bào ngư","Dưa leo","Cà rốt"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan tăng cơ thực vật'), 6, 'lunch', (SELECT dish_id FROM dish WHERE name='Cơm chiên rau củ'), 'Cơm chiên rau củ', 'Cơm chiên ít dầu với rau củ nhiều màu sắc.', 540, 'protein', '["Gạo trắng","Cà rốt","Đậu que","Bắp ngô"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan tăng cơ thực vật'), 6, 'dinner', (SELECT dish_id FROM dish WHERE name='Hủ tiếu chay'), 'Hủ tiếu chay', 'Hủ tiếu rau củ nấm theo phong cách miền Nam.', 440, 'vegetable', '["Bún gạo","Đậu hũ","Nấm đông cô","Cải thìa"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan tăng cơ thực vật'), 7, 'breakfast', (SELECT dish_id FROM dish WHERE name='Bánh mì đậu hũ'), 'Bánh mì đậu hũ', 'Bánh mì giòn kẹp đậu hũ và rau tươi.', 450, 'carb', '["Bánh mì","Đậu hũ","Dưa leo","Cà rốt"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan tăng cơ thực vật'), 7, 'lunch', (SELECT dish_id FROM dish WHERE name='Cơm gạo lứt đậu hũ'), 'Cơm gạo lứt đậu hũ', 'Cơm gạo lứt ăn cùng đậu hũ và rau củ.', 520, 'protein', '["Gạo lứt","Đậu hũ","Bông cải xanh","Cà rốt"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan tăng cơ thực vật'), 7, 'dinner', (SELECT dish_id FROM dish WHERE name='Phở chay nấm'), 'Phở chay nấm', 'Nước dùng thanh từ rau củ, ăn cùng nấm và đậu hũ.', 420, 'vegetable', '["Bánh phở","Nấm đông cô","Nấm rơm","Đậu hũ"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Bản nháp giảm cân tuần tới'), 1, 'breakfast', (SELECT dish_id FROM dish WHERE name='Yến mạch qua đêm chuối'), 'Yến mạch qua đêm chuối', 'Overnight oats với chuối và hạt chia.', 380, 'carb', '["Yến mạch","Chuối","Sữa yến mạch","Hạt chia"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Bản nháp giảm cân tuần tới'), 1, 'lunch', (SELECT dish_id FROM dish WHERE name='Salad quinoa rau củ'), 'Salad quinoa rau củ', 'Quinoa trộn rau củ, phù hợp meal prep.', 390, 'protein', '["Quinoa","Dưa leo","Ớt chuông","Bắp ngô"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Bản nháp giảm cân tuần tới'), 1, 'dinner', (SELECT dish_id FROM dish WHERE name='Canh chua chay'), 'Canh chua chay', 'Canh chua rau củ thanh mát kiểu Việt.', 180, 'vegetable', '["Cà chua","Nấm rơm","Đậu hũ","Giá đỗ"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan văn phòng'), 1, 'breakfast', (SELECT dish_id FROM dish WHERE name='Cháo yến mạch bí đỏ'), 'Cháo yến mạch bí đỏ', 'Yến mạch nấu bí đỏ nhanh gọn.', 320, 'carb', '["Yến mạch","Bí đỏ","Sữa yến mạch","Hạt chia"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan văn phòng'), 1, 'lunch', (SELECT dish_id FROM dish WHERE name='Đậu lăng hầm cà chua'), 'Đậu lăng hầm cà chua', 'Đậu lăng hầm cà chua giàu chất xơ và protein.', 450, 'protein', '["Đậu lăng","Cà chua","Cà rốt","Cải bó xôi"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Meal plan văn phòng'), 1, 'dinner', (SELECT dish_id FROM dish WHERE name='Súp bí đỏ'), 'Súp bí đỏ', 'Súp bí đỏ mịn, dùng sữa yến mạch.', 260, 'vegetable', '["Bí đỏ","Sữa yến mạch","Khoai tây","Dầu ô liu"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Kế hoạch cũ tháng 9'), 1, 'breakfast', (SELECT dish_id FROM dish WHERE name='Bánh cuốn chay'), 'Bánh cuốn chay', 'Bánh cuốn mềm nhân nấm và đậu hũ.', 410, 'carb', '["Bột gạo","Nấm đông cô","Đậu hũ","Giá đỗ"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Kế hoạch cũ tháng 9'), 1, 'lunch', (SELECT dish_id FROM dish WHERE name='Cơm nấm sốt tiêu'), 'Cơm nấm sốt tiêu', 'Nấm áp chảo sốt tiêu đen ăn cùng cơm.', 560, 'protein', '["Gạo trắng","Nấm đùi gà","Ớt chuông","Nước tương"]'::jsonb, false, NULL),
    ((SELECT meal_plan_id FROM meal_plan WHERE title='Kế hoạch cũ tháng 9'), 1, 'dinner', (SELECT dish_id FROM dish WHERE name='Đậu hũ kho nấm'), 'Đậu hũ kho nấm', 'Đậu hũ kho nấm đậm vị, phù hợp ăn với cơm.', 390, 'vegetable', '["Đậu hũ","Nấm đông cô","Nấm rơm","Nước tương"]'::jsonb, false, NULL);
INSERT INTO chat_session (account_id,device_id,is_trial,title,message_count,started_at,last_activity_at,ended_at) VALUES
    ((SELECT account_id FROM account WHERE email='linh.nguyen@seed.erdswp.local'), NULL, false, 'Tư vấn món chay #1', 3, '2026-09-20 19:00:00+07', '2026-09-20 19:05:00+07', NULL),
    ((SELECT account_id FROM account WHERE email='minh.anh@seed.erdswp.local'), NULL, false, 'Tư vấn món chay #2', 3, '2026-09-21 19:00:00+07', '2026-09-21 19:05:00+07', NULL),
    ((SELECT account_id FROM account WHERE email='hoang.pham@seed.erdswp.local'), NULL, false, 'Tư vấn món chay #3', 3, '2026-09-22 19:00:00+07', '2026-09-22 19:05:00+07', NULL),
    ((SELECT account_id FROM account WHERE email='mai.le@seed.erdswp.local'), NULL, false, 'Tư vấn món chay #4', 3, '2026-09-23 19:00:00+07', '2026-09-23 19:05:00+07', NULL),
    ((SELECT account_id FROM account WHERE email='khanh.vo@seed.erdswp.local'), NULL, false, 'Tư vấn món chay #5', 3, '2026-09-24 19:00:00+07', '2026-09-24 19:05:00+07', NULL);
INSERT INTO chat_message (chat_session_id,sender,content,status,tokens_used,ai_model,ref_post_id,created_at) VALUES
    ((SELECT chat_session_id FROM chat_session WHERE title='Tư vấn món chay #1'), 'user', 'Gợi ý cho mình một bữa chay đơn giản khoảng 500 kcal.', 'ok', 35, NULL, (SELECT post_id FROM post WHERE title='Meal prep chay 3 ngày cho người bận rộn'), '2026-09-20 19:00:00+07'),
    ((SELECT chat_session_id FROM chat_session WHERE title='Tư vấn món chay #1'), 'bot', 'Bạn có thể chọn cơm gạo lứt đậu hũ hoặc một bowl rau củ cân bằng.', 'ok', 95, 'gpt-seed-demo', (SELECT post_id FROM post WHERE title='Meal prep chay 3 ngày cho người bận rộn'), '2026-09-20 19:01:00+07'),
    ((SELECT chat_session_id FROM chat_session WHERE title='Tư vấn món chay #1'), 'user', 'Mình muốn ưu tiên món dễ chuẩn bị trước.', 'ok', 28, NULL, (SELECT post_id FROM post WHERE title='Meal prep chay 3 ngày cho người bận rộn'), '2026-09-20 19:02:00+07'),
    ((SELECT chat_session_id FROM chat_session WHERE title='Tư vấn món chay #2'), 'user', 'Gợi ý cho mình một bữa chay đơn giản khoảng 500 kcal.', 'ok', 35, NULL, (SELECT post_id FROM post WHERE title='5 nguồn protein thực vật mình dùng khi tập gym'), '2026-09-21 19:03:00+07'),
    ((SELECT chat_session_id FROM chat_session WHERE title='Tư vấn món chay #2'), 'bot', 'Bạn có thể chọn cơm gạo lứt đậu hũ hoặc một bowl rau củ cân bằng.', 'ok', 95, 'gpt-seed-demo', (SELECT post_id FROM post WHERE title='5 nguồn protein thực vật mình dùng khi tập gym'), '2026-09-21 19:04:00+07'),
    ((SELECT chat_session_id FROM chat_session WHERE title='Tư vấn món chay #2'), 'user', 'Mình muốn ưu tiên món dễ chuẩn bị trước.', 'ok', 28, NULL, (SELECT post_id FROM post WHERE title='5 nguồn protein thực vật mình dùng khi tập gym'), '2026-09-21 19:05:00+07'),
    ((SELECT chat_session_id FROM chat_session WHERE title='Tư vấn món chay #3'), 'user', 'Gợi ý cho mình một bữa chay đơn giản khoảng 500 kcal.', 'ok', 35, NULL, (SELECT post_id FROM post WHERE title='Lần đầu nấu phở chay nấm'), '2026-09-22 19:00:00+07'),
    ((SELECT chat_session_id FROM chat_session WHERE title='Tư vấn món chay #3'), 'bot', 'Bạn có thể chọn cơm gạo lứt đậu hũ hoặc một bowl rau củ cân bằng.', 'ok', 95, 'gpt-seed-demo', (SELECT post_id FROM post WHERE title='Lần đầu nấu phở chay nấm'), '2026-09-22 19:01:00+07'),
    ((SELECT chat_session_id FROM chat_session WHERE title='Tư vấn món chay #3'), 'user', 'Mình muốn ưu tiên món dễ chuẩn bị trước.', 'ok', 28, NULL, (SELECT post_id FROM post WHERE title='Lần đầu nấu phở chay nấm'), '2026-09-22 19:02:00+07'),
    ((SELECT chat_session_id FROM chat_session WHERE title='Tư vấn món chay #4'), 'user', 'Gợi ý cho mình một bữa chay đơn giản khoảng 500 kcal.', 'ok', 35, NULL, (SELECT post_id FROM post WHERE title='Cách mình theo dõi calories khi ăn chay'), '2026-09-23 19:03:00+07'),
    ((SELECT chat_session_id FROM chat_session WHERE title='Tư vấn món chay #4'), 'bot', 'Bạn có thể chọn cơm gạo lứt đậu hũ hoặc một bowl rau củ cân bằng.', 'ok', 95, 'gpt-seed-demo', (SELECT post_id FROM post WHERE title='Cách mình theo dõi calories khi ăn chay'), '2026-09-23 19:04:00+07'),
    ((SELECT chat_session_id FROM chat_session WHERE title='Tư vấn món chay #4'), 'user', 'Mình muốn ưu tiên món dễ chuẩn bị trước.', 'ok', 28, NULL, (SELECT post_id FROM post WHERE title='Cách mình theo dõi calories khi ăn chay'), '2026-09-23 19:05:00+07'),
    ((SELECT chat_session_id FROM chat_session WHERE title='Tư vấn món chay #5'), 'user', 'Gợi ý cho mình một bữa chay đơn giản khoảng 500 kcal.', 'ok', 35, NULL, (SELECT post_id FROM post WHERE title='Review bữa trưa chay cuối tuần'), '2026-09-24 19:00:00+07'),
    ((SELECT chat_session_id FROM chat_session WHERE title='Tư vấn món chay #5'), 'bot', 'Bạn có thể chọn cơm gạo lứt đậu hũ hoặc một bowl rau củ cân bằng.', 'ok', 95, 'gpt-seed-demo', (SELECT post_id FROM post WHERE title='Review bữa trưa chay cuối tuần'), '2026-09-24 19:01:00+07'),
    ((SELECT chat_session_id FROM chat_session WHERE title='Tư vấn món chay #5'), 'user', 'Mình muốn ưu tiên món dễ chuẩn bị trước.', 'ok', 28, NULL, (SELECT post_id FROM post WHERE title='Review bữa trưa chay cuối tuần'), '2026-09-24 19:02:00+07');

-- 10) DAILY QUOTA samples
INSERT INTO daily_quota (subject_type,subject_key,quota_date,posts_viewed,chat_turns,updated_at) VALUES
    ('account', (SELECT account_id::text FROM account WHERE email='linh.nguyen@seed.erdswp.local'), '2026-09-25', 2, 1, '2026-09-25 21:00:00+07'),
    ('account', (SELECT account_id::text FROM account WHERE email='minh.anh@seed.erdswp.local'), '2026-09-25', 3, 2, '2026-09-25 21:00:00+07'),
    ('account', (SELECT account_id::text FROM account WHERE email='hoang.pham@seed.erdswp.local'), '2026-09-25', 4, 3, '2026-09-25 21:00:00+07'),
    ('account', (SELECT account_id::text FROM account WHERE email='mai.le@seed.erdswp.local'), '2026-09-25', 5, 4, '2026-09-25 21:00:00+07'),
    ('account', (SELECT account_id::text FROM account WHERE email='khanh.vo@seed.erdswp.local'), '2026-09-25', 6, 1, '2026-09-25 21:00:00+07'),
    ('account', (SELECT account_id::text FROM account WHERE email='yen.tran@seed.erdswp.local'), '2026-09-25', 7, 2, '2026-09-25 21:00:00+07'),
    ('account', (SELECT account_id::text FROM account WHERE email='tuan.nguyen@seed.erdswp.local'), '2026-09-25', 2, 3, '2026-09-25 21:00:00+07'),
    ('account', (SELECT account_id::text FROM account WHERE email='thu.do@seed.erdswp.local'), '2026-09-25', 3, 4, '2026-09-25 21:00:00+07'),
    ('account', (SELECT account_id::text FROM account WHERE email='bao.huynh@seed.erdswp.local'), '2026-09-25', 4, 1, '2026-09-25 21:00:00+07'),
    ('account', (SELECT account_id::text FROM account WHERE email='ngoc.bui@seed.erdswp.local'), '2026-09-25', 5, 2, '2026-09-25 21:00:00+07'),
    ('account', (SELECT account_id::text FROM account WHERE email='duc.tran@seed.erdswp.local'), '2026-09-25', 6, 3, '2026-09-25 21:00:00+07'),
    ('account', (SELECT account_id::text FROM account WHERE email='vy.pham@seed.erdswp.local'), '2026-09-25', 7, 4, '2026-09-25 21:00:00+07');

-- 11) POST-SEED VALIDATION: any mismatch aborts the transaction
DO $$
DECLARE
    v bigint;
BEGIN
    SELECT count(*) INTO v FROM account;
    IF v <> 15 THEN RAISE EXCEPTION 'Validation failed: account expected 15, got %', v; END IF;
    IF (SELECT count(*) FROM account a JOIN role r ON r.role_id=a.role_id WHERE r.name='admin') <> 3 THEN RAISE EXCEPTION 'Validation failed: admin accounts'; END IF;
    IF (SELECT count(*) FROM account a JOIN role r ON r.role_id=a.role_id WHERE r.name='member') <> 12 THEN RAISE EXCEPTION 'Validation failed: member accounts'; END IF;
    IF (SELECT count(*) FROM profile) <> 12 THEN RAISE EXCEPTION 'Validation failed: profiles'; END IF;
    IF (SELECT count(*) FROM allergy) <> 10 THEN RAISE EXCEPTION 'Validation failed: allergies'; END IF;
    IF (SELECT count(*) FROM category) <> 10 THEN RAISE EXCEPTION 'Validation failed: categories'; END IF;
    IF (SELECT count(*) FROM ingredient) <> 80 THEN RAISE EXCEPTION 'Validation failed: ingredients'; END IF;
    IF (SELECT count(*) FROM dish) <> 50 THEN RAISE EXCEPTION 'Validation failed: dishes'; END IF;
    IF (SELECT count(*) FROM recipe) <> 50 THEN RAISE EXCEPTION 'Validation failed: recipes'; END IF;
    IF (SELECT count(*) FROM recipe_ingredient) <> 300 THEN RAISE EXCEPTION 'Validation failed: recipe_ingredient expected 300'; END IF;
    IF EXISTS (SELECT 1 FROM recipe r WHERE (SELECT count(*) FROM recipe_ingredient ri WHERE ri.recipe_id=r.recipe_id) <> 6) THEN RAISE EXCEPTION 'Validation failed: every recipe must have 6 ingredients'; END IF;
    IF EXISTS (SELECT 1 FROM recipe_ingredient ri JOIN ingredient i ON i.ingredient_id=ri.ingredient_id WHERE i.is_animal_derived) THEN RAISE EXCEPTION 'Validation failed: animal-derived ingredient used in recipe'; END IF;
    IF (SELECT count(*) FROM dish_category) <> 50 THEN RAISE EXCEPTION 'Validation failed: dish_category'; END IF;
    IF EXISTS (SELECT 1 FROM recipe r LEFT JOIN dish d ON d.dish_id=r.dish_id WHERE d.dish_id IS NULL) THEN RAISE EXCEPTION 'Validation failed: recipe->dish FK'; END IF;
    IF EXISTS (SELECT 1 FROM recipe_ingredient ri LEFT JOIN ingredient i ON i.ingredient_id=ri.ingredient_id WHERE i.ingredient_id IS NULL) THEN RAISE EXCEPTION 'Validation failed: recipe_ingredient->ingredient'; END IF;
    IF (SELECT count(*) FROM post) <> 20 THEN RAISE EXCEPTION 'Validation failed: posts'; END IF;
    IF (SELECT count(*) FROM comment) <> 50 THEN RAISE EXCEPTION 'Validation failed: comments'; END IF;
    IF (SELECT count(*) FROM post_vote) <> 90 THEN RAISE EXCEPTION 'Validation failed: post votes'; END IF;
    IF (SELECT count(*) FROM post_category) <> 20 THEN RAISE EXCEPTION 'Validation failed: post_category'; END IF;
    IF EXISTS (SELECT 1 FROM post p WHERE p.vote_count <> (SELECT count(*) FROM post_vote v WHERE v.post_id=p.post_id)) THEN RAISE EXCEPTION 'Validation failed: post.vote_count mismatch'; END IF;
    IF EXISTS (SELECT 1 FROM post p WHERE p.comment_count <> (SELECT count(*) FROM comment c WHERE c.post_id=p.post_id AND c.status <> 'deleted')) THEN RAISE EXCEPTION 'Validation failed: post.comment_count mismatch'; END IF;
    IF (SELECT count(*) FROM report) <> 8 THEN RAISE EXCEPTION 'Validation failed: reports'; END IF;
    IF EXISTS (SELECT 1 FROM report r WHERE (r.target_type='post' AND NOT EXISTS (SELECT 1 FROM post p WHERE p.post_id=r.target_id)) OR (r.target_type='comment' AND NOT EXISTS (SELECT 1 FROM comment c WHERE c.comment_id=r.target_id)) OR (r.target_type='recipe' AND NOT EXISTS (SELECT 1 FROM recipe x WHERE x.recipe_id=r.target_id))) THEN RAISE EXCEPTION 'Validation failed: polymorphic report target'; END IF;
    IF (SELECT count(*) FROM notification) <> 24 THEN RAISE EXCEPTION 'Validation failed: notifications'; END IF;
    IF (SELECT count(*) FROM shop) <> 5 THEN RAISE EXCEPTION 'Validation failed: shops'; END IF;
    IF (SELECT count(*) FROM shop_dish) <> 25 THEN RAISE EXCEPTION 'Validation failed: shop_dish'; END IF;
    IF EXISTS (SELECT 1 FROM shop_dish GROUP BY shop_id,dish_id HAVING count(*)>1) THEN RAISE EXCEPTION 'Validation failed: duplicate shop/dish rows'; END IF;
    IF EXISTS (SELECT 1 FROM shop_dish sd JOIN dish d ON d.dish_id=sd.dish_id WHERE d.status <> 'active') THEN RAISE EXCEPTION 'Validation failed: shop references non-active dish'; END IF;
    IF (SELECT count(*) FROM meal_plan) <> 5 THEN RAISE EXCEPTION 'Validation failed: meal_plan'; END IF;
    IF (SELECT count(*) FROM meal_plan_item) <> 51 THEN RAISE EXCEPTION 'Validation failed: meal_plan_item'; END IF;
    IF EXISTS (SELECT 1 FROM meal_plan_item GROUP BY meal_plan_id,day_no,meal_slot HAVING count(*)>1) THEN RAISE EXCEPTION 'Validation failed: duplicate meal slots in seed'; END IF;
    IF EXISTS (SELECT 1 FROM meal_plan_item mpi JOIN dish d ON d.dish_id=mpi.dish_id WHERE d.status <> 'active') THEN RAISE EXCEPTION 'Validation failed: meal plan references non-active dish'; END IF;
    IF EXISTS (SELECT 1 FROM meal_plan_item mpi JOIN meal_plan mp ON mp.meal_plan_id=mpi.meal_plan_id WHERE mpi.day_no < 1 OR mpi.day_no > mp.days_count) THEN RAISE EXCEPTION 'Validation failed: meal_plan_item day_no'; END IF;
    IF (SELECT count(*) FROM chat_session) <> 5 OR (SELECT count(*) FROM chat_message) <> 15 THEN RAISE EXCEPTION 'Validation failed: chat samples'; END IF;
    IF (SELECT count(*) FROM banned_keyword) <> 6 OR (SELECT count(*) FROM admin_log) <> 12 THEN RAISE EXCEPTION 'Validation failed: moderation support data'; END IF;
    IF (SELECT count(*) FROM daily_quota) <> 12 THEN RAISE EXCEPTION 'Validation failed: daily_quota'; END IF;
END $$;

COMMIT;

-- Verification summary query (safe to run after import)
SELECT * FROM (VALUES
('account', (SELECT count(*) FROM account)),
('profile', (SELECT count(*) FROM profile)),
('allergy', (SELECT count(*) FROM allergy)),
('category', (SELECT count(*) FROM category)),
('ingredient', (SELECT count(*) FROM ingredient)),
('dish', (SELECT count(*) FROM dish)),
('recipe', (SELECT count(*) FROM recipe)),
('recipe_ingredient', (SELECT count(*) FROM recipe_ingredient)),
('post', (SELECT count(*) FROM post)),
('comment', (SELECT count(*) FROM comment)),
('post_vote', (SELECT count(*) FROM post_vote)),
('report', (SELECT count(*) FROM report)),
('notification', (SELECT count(*) FROM notification)),
('shop', (SELECT count(*) FROM shop)),
('shop_dish', (SELECT count(*) FROM shop_dish)),
('meal_plan', (SELECT count(*) FROM meal_plan)),
('meal_plan_item', (SELECT count(*) FROM meal_plan_item)),
('chat_session', (SELECT count(*) FROM chat_session)),
('chat_message', (SELECT count(*) FROM chat_message)),
('banned_keyword', (SELECT count(*) FROM banned_keyword)),
('admin_log', (SELECT count(*) FROM admin_log)),
('daily_quota', (SELECT count(*) FROM daily_quota))
) AS seed_summary(table_name,row_count)
ORDER BY table_name;
