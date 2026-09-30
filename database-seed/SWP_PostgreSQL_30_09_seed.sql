-- Vegetarian Social / Green Bowl demo seed. PostgreSQL 13+ / Neon.
-- Run after SWP_PostgreSQL_30_09.sql on an empty project schema.
-- All 54 accounts use password greenbowl@123 (bcrypt cost 10).
BEGIN;
SET LOCAL TIME ZONE 'Asia/Ho_Chi_Minh';

DO $$ BEGIN
    IF (SELECT count(*) FROM account) <> 0 THEN
        RAISE EXCEPTION 'Seed requires empty account table. Run reset/schema first.';
    END IF;
    IF (SELECT count(*) FROM role WHERE name IN ('member','admin')) <> 2 THEN
        RAISE EXCEPTION 'Required roles member/admin are missing.';
    END IF;
END $$;

INSERT INTO account (email,password_hash,role_id,status,full_name,bio,created_at,updated_at) VALUES
('tungnh@greenbowl.vn','$2b$10$upel7zVXgMH0Vqer9A81BuJBJy/ZVvX9dZBPrnQLK4WSManUvAjfa',(SELECT role_id FROM role WHERE name='admin'),'active','Nguyễn Hoàng Tùng','Phụ trách vận hành cộng đồng.','2026-06-01 08:00+07','2026-09-25 08:00+07'),
('lamdv@greenbowl.vn','$2b$10$upel7zVXgMH0Vqer9A81BuJBJy/ZVvX9dZBPrnQLK4WSManUvAjfa',(SELECT role_id FROM role WHERE name='admin'),'active','Đặng Văn Lâm','Phụ trách kiểm duyệt bài viết và bình luận.','2026-06-01 08:00+07','2026-09-25 08:00+07'),
('duymk@greenbowl.vn','$2b$10$upel7zVXgMH0Vqer9A81BuJBJy/ZVvX9dZBPrnQLK4WSManUvAjfa',(SELECT role_id FROM role WHERE name='admin'),'active','Mai Khánh Duy','Phụ trách món ăn, cửa hàng và hỗ trợ thành viên.','2026-06-01 08:00+07','2026-09-25 08:00+07'),
('khoila@greenbowl.vn','$2b$10$upel7zVXgMH0Vqer9A81BuJBJy/ZVvX9dZBPrnQLK4WSManUvAjfa',(SELECT role_id FROM role WHERE name='admin'),'active','Lê Anh Khôi','Phụ trách hỗ trợ kiểm duyệt báo cáo tài khoản.','2026-06-01 08:00+07','2026-09-25 08:00+07');

WITH names AS (
    SELECT full_name, n FROM unnest(ARRAY[
        'Nguyễn Thảo Linh','Trần Minh Anh','Phạm Gia Hoàng','Lê Ngọc Mai','Võ Quốc Khánh',
        'Trần Hải Yến','Nguyễn Anh Tuấn','Đỗ Thanh Thu','Huỳnh Gia Bảo','Bùi Hồng Ngọc',
        'Trần Minh Đức','Phạm Thảo Vy','Lê Bảo An','Võ Thanh Bình','Nguyễn Ngọc Châu',
        'Trần Mỹ Diễm','Phạm Nhật Duy','Bùi Thu Giang','Nguyễn Khánh Hân','Lê Quang Hiếu',
        'Đỗ Minh Hòa','Phạm Quốc Hưng','Lâm Gia Khánh','Trần Thùy Lan','Nguyễn Thành Lộc',
        'Võ Hoàng My','Đặng Hải Nam','Lê Thu Oanh','Bùi Hữu Phúc','Nguyễn Như Quỳnh',
        'Trần Minh Sơn','Phạm Ngọc Tâm','Đinh Phương Thảo','Nguyễn Đức Thịnh','Lê Bảo Trang',
        'Võ Minh Trường','Bùi Thanh Tú','Nguyễn Hà Vân','Trần Gia Vi','Phạm Quốc Việt',
        'Lê Xuân','Đỗ Hải Yến','Nguyễn Hoàng Bảo','Trần Minh Chi','Võ Tiến Đạt',
        'Nguyễn Thanh Hà','Lê Ngọc Khuê','Phạm Đức Long','Đặng Minh Nhật','Bùi Hồng Nhung'
    ]) WITH ORDINALITY AS x(full_name,n)
)
INSERT INTO account (email,password_hash,role_id,status,full_name,avatar_url,bio,last_login_at,created_at,updated_at)
SELECT 'thanhvien'||lpad(n::text,2,'0')||'@greenbowl.vn',
       '$2b$10$upel7zVXgMH0Vqer9A81BuJBJy/ZVvX9dZBPrnQLK4WSManUvAjfa',
       (SELECT role_id FROM role WHERE name='member'),
       (CASE WHEN n IN (17,26,31) THEN 'reported' WHEN n=45 THEN 'locked'
             WHEN n=50 THEN 'deleted' ELSE 'active' END)::account_status_enum,
       full_name, 'https://i.pravatar.cc/300?img='||n,
       (ARRAY['Thích nấu món chay Việt tại nhà.','Quan tâm dinh dưỡng thực vật và meal prep.',
              'Hay chia sẻ quán chay và trải nghiệm ăn uống.','Đang học thêm các công thức thuần chay.'])[(n%4+1)::int],
       CASE WHEN n=50 THEN NULL ELSE '2026-09-20 09:00+07'::timestamptz + n*interval '2 hours' END,
       '2026-06-01 09:00+07'::timestamptz + n*interval '1 day',
       CASE WHEN n=17 THEN '2026-09-28 11:00+07'::timestamptz
            WHEN n=26 THEN '2026-09-29 08:00+07'::timestamptz
            WHEN n=45 THEN '2026-09-25 11:55+07'::timestamptz
            ELSE '2026-09-20 09:00+07'::timestamptz + n*interval '2 hours' END
FROM names;

WITH members AS (
    SELECT account_id, row_number() OVER (ORDER BY account_id)::int AS n
    FROM account WHERE role_id=(SELECT role_id FROM role WHERE name='member')
), measures AS (
    SELECT account_id,n,(155+n%23)::numeric AS h,(48+n%25)::numeric AS w FROM members
), metrics AS (
    SELECT *,round(w/power(h/100,2),1) AS bmi_value FROM measures
)
INSERT INTO profile (account_id,gender,date_of_birth,height_cm,weight_kg,bmi,bmi_category,activity_level,health_goal,tdee_kcal,target_calories_kcal)
SELECT account_id,
       (CASE WHEN n%3=0 THEN 'male' WHEN n%3=1 THEN 'female' ELSE 'other' END)::profile_gender_enum,
       date '1988-01-01' + n*71,
       h,w,bmi_value,
       (CASE WHEN bmi_value<18.5 THEN 'underweight' WHEN bmi_value<25 THEN 'normal'
             WHEN bmi_value<30 THEN 'overweight' ELSE 'obese' END)::bmi_category_enum,
       (ARRAY['sedentary','light','moderate','active'])[(n%4+1)]::activity_level_enum,
       (ARRAY['maintain','gain_muscle','lose_weight'])[(n%3+1)]::health_goal_enum,
       1650+(n%9)*135,
       1650+(n%9)*135 + CASE WHEN n%3=1 THEN 200 WHEN n%3=2 THEN -250 ELSE 0 END
FROM metrics;

INSERT INTO allergy (profile_id,name)
SELECT p.profile_id,(ARRAY['Đậu phộng','Mè','Đậu nành','Hạt điều','Gluten'])[(x.n%5+1)]
FROM (SELECT account_id,row_number() OVER (ORDER BY account_id)::int AS n FROM account
      WHERE role_id=(SELECT role_id FROM role WHERE name='member')) x
JOIN profile p ON p.account_id=x.account_id WHERE x.n%5=0;

INSERT INTO auth_session (account_id,token_hash,device_id,ip_address,user_agent,expires_at,revoked_at,created_at)
SELECT account_id,'expired-demo-session-'||account_id,'seed-device-'||account_id,'127.0.0.1',
       'Green Bowl demo browser','2026-09-15 12:00+07','2026-09-15 10:00+07','2026-09-10 10:00+07'
FROM account WHERE email LIKE 'thanhvien%' ORDER BY account_id LIMIT 5;

INSERT INTO category (name,is_active) VALUES
('Ăn sáng',true),('Món chính',true),('Món nước',true),('Salad',true),('Món nhẹ',true),
('Đồ uống',true),('Tráng miệng',true),('Dinh dưỡng',true),('Kinh nghiệm',true),('Meal Prep',true);

INSERT INTO ingredient (name,is_animal_derived,is_ngu_vi_tan,is_common_allergen) VALUES
('Gạo lứt',false,false,false),('Gạo trắng',false,false,false),('Đậu hũ',false,false,true),
('Nấm rơm',false,false,false),('Nấm đùi gà',false,false,false),('Nấm hương',false,false,false),
('Cà chua',false,false,false),('Cà rốt',false,false,false),('Bông cải xanh',false,false,false),
('Bí đỏ',false,false,false),('Khoai lang',false,false,false),('Đậu gà',false,false,false),
('Đậu lăng',false,false,false),('Yến mạch',false,false,false),('Quinoa',false,false,false),
('Xà lách',false,false,false),('Dưa leo',false,false,false),('Nước cốt dừa',false,false,false),
('Sả',false,false,false),('Nghệ',false,false,false),('Chanh',false,false,false),
('Hạt chia',false,false,false),('Mè rang',false,false,true),('Bún',false,false,false),
('Bánh phở',false,false,false),('Chuối',false,false,false),('Sữa yến mạch',false,false,false),
('Tiêu đen',false,false,false),('Dứa',false,false,false),('Bánh tráng',false,false,false),
('Rau muống',false,false,false),('Đậu que',false,false,false);

CREATE TEMP TABLE seed_dish_input (
    n int PRIMARY KEY, name text UNIQUE NOT NULL, description text NOT NULL,
    category_name text NOT NULL, kcal int NOT NULL, status dish_status_enum NOT NULL,
    ingredients text[] NOT NULL, instructions text NOT NULL
) ON COMMIT DROP;

INSERT INTO seed_dish_input VALUES
(1,'Phở chay nấm hương','Nước dùng nấm hương và rau củ, ăn với bánh phở.','Món nước',420,'active',ARRAY['Bánh phở','Nấm hương','Cà rốt','Đậu hũ'],'Ninh cà rốt và nấm hương lấy nước ngọt. Trụng bánh phở, thêm đậu hũ rồi chan nước dùng nóng.'),
(2,'Bún riêu chay đậu hũ','Riêu đậu hũ cà chua dùng cùng bún tươi.','Món nước',450,'active',ARRAY['Bún','Đậu hũ','Cà chua','Nấm rơm'],'Xào cà chua, cho nấm vào nấu mềm. Dầm đậu hũ làm riêu, nêm vừa ăn và chan lên bún.'),
(3,'Cơm gạo lứt đậu hũ áp chảo','Bữa trưa cân bằng với rau xanh và đạm thực vật.','Món chính',530,'active',ARRAY['Gạo lứt','Đậu hũ','Bông cải xanh','Cà rốt'],'Nấu gạo lứt chín mềm. Áp chảo đậu hũ, hấp rau và dùng cùng cơm.'),
(4,'Đậu hũ sốt cà chua','Đậu hũ mềm thấm sốt cà chua, hợp ăn với cơm.','Món chính',360,'active',ARRAY['Đậu hũ','Cà chua','Gạo trắng','Tiêu đen'],'Áp chảo đậu hũ. Nấu cà chua thành sốt, cho đậu vào rim rồi dùng với cơm.'),
(5,'Cà ri khoai lang đậu gà','Cà ri béo nhẹ với nước cốt dừa và nghệ.','Món chính',590,'active',ARRAY['Khoai lang','Đậu gà','Nước cốt dừa','Nghệ'],'Nấu khoai lang và đậu gà với nghệ. Thêm nước cốt dừa cuối cùng, đun nhỏ lửa.'),
(6,'Salad quinoa rau củ','Quinoa trộn rau tươi, chanh và mè rang.','Salad',390,'active',ARRAY['Quinoa','Xà lách','Dưa leo','Chanh'],'Nấu quinoa, để nguội. Trộn rau cùng nước cốt chanh và quinoa.'),
(7,'Salad đậu gà dưa leo','Salad nhanh, nhiều chất xơ cho ngày nóng.','Salad',340,'active',ARRAY['Đậu gà','Dưa leo','Xà lách','Chanh'],'Luộc đậu gà chín mềm, trộn với dưa leo và xà lách, vắt chanh trước khi ăn.'),
(8,'Cháo yến mạch bí đỏ','Bữa sáng mềm, ấm và dễ chuẩn bị.','Ăn sáng',300,'active',ARRAY['Yến mạch','Bí đỏ','Sữa yến mạch','Mè rang'],'Hấp bí đỏ rồi nấu cùng yến mạch và sữa yến mạch đến khi sánh.'),
(9,'Yến mạch qua đêm chuối chia','Bữa sáng làm từ tối hôm trước.','Ăn sáng',350,'active',ARRAY['Yến mạch','Chuối','Hạt chia','Sữa yến mạch'],'Ngâm yến mạch với sữa và hạt chia qua đêm. Thêm chuối khi ăn.'),
(10,'Nấm đùi gà kho tiêu','Nấm kho đậm vị với tiêu đen.','Món chính',320,'active',ARRAY['Nấm đùi gà','Tiêu đen','Gạo trắng','Đậu hũ'],'Áp chảo nấm, thêm nước kho và tiêu. Dùng cùng đậu hũ và cơm nóng.'),
(11,'Canh chua chay nấm rơm','Canh chua thanh nhẹ từ cà chua và dứa.','Món nước',190,'active',ARRAY['Nấm rơm','Cà chua','Dứa','Rau muống'],'Nấu dứa và cà chua lấy vị chua, thêm nấm và rau muống, nêm vừa ăn.'),
(12,'Bún Huế chay sả nấm','Bún Huế chay cay nhẹ, thơm sả.','Món nước',480,'active',ARRAY['Bún','Sả','Nấm đùi gà','Đậu hũ'],'Nấu nước dùng với sả và nấm. Thêm đậu hũ, chan lên bún đã trụng.'),
(13,'Cơm chiên rau củ đậu que','Cơm chiên ít dầu cùng rau củ nhiều màu.','Món chính',540,'active',ARRAY['Gạo trắng','Cà rốt','Đậu que','Đậu hũ'],'Dùng cơm nguội, xào nhanh với cà rốt và đậu que, thêm đậu hũ cắt nhỏ.'),
(14,'Súp bí đỏ sữa yến mạch','Súp bí đỏ mịn, không dùng sữa động vật.','Món nhẹ',270,'active',ARRAY['Bí đỏ','Sữa yến mạch','Cà rốt','Tiêu đen'],'Hấp bí đỏ và cà rốt, xay với sữa yến mạch rồi đun nóng, thêm tiêu.'),
(15,'Gỏi cuốn chay đậu hũ','Gỏi cuốn rau và đậu hũ cho bữa nhẹ.','Món nhẹ',310,'active',ARRAY['Bánh tráng','Đậu hũ','Xà lách','Dưa leo'],'Làm ẩm bánh tráng, xếp rau và đậu hũ rồi cuốn chặt tay.'),
(16,'Bánh mì nấm áp chảo','Món ăn sáng đang chờ duyệt công thức.','Ăn sáng',410,'pending',ARRAY['Nấm đùi gà','Xà lách','Dưa leo','Tiêu đen'],'Áp chảo nấm và kẹp cùng rau tươi trong bánh mì.'),
(17,'Sinh tố chuối yến mạch','Thức uống đang chờ kiểm tra thông tin dinh dưỡng.','Đồ uống',280,'pending',ARRAY['Chuối','Yến mạch','Sữa yến mạch','Hạt chia'],'Xay chuối, yến mạch và sữa, thêm hạt chia khi dùng.'),
(18,'Món nấm chiên quá dầu','Bản nộp bị từ chối do mô tả dinh dưỡng sai.','Món chính',720,'rejected',ARRAY['Nấm đùi gà','Gạo trắng','Tiêu đen','Mè rang'],'Chiên nấm và dùng với cơm.'),
(19,'Salad thiếu thông tin dị ứng','Bản nộp bị từ chối vì bỏ sót cảnh báo mè.','Salad',330,'rejected',ARRAY['Xà lách','Dưa leo','Mè rang','Đậu hũ'],'Trộn các nguyên liệu và thêm mè rang.'),
(20,'Cháo rau củ tạm ẩn','Món tạm ẩn để cập nhật định lượng.','Món nhẹ',260,'hidden',ARRAY['Gạo trắng','Cà rốt','Bí đỏ','Nấm hương'],'Nấu gạo mềm cùng rau củ và nấm.');

INSERT INTO dish (name,description,thumbnail_url,est_calories_kcal,status,moderation_note,moderated_by,moderated_at,created_by,created_at,updated_at)
SELECT s.name,s.description,'https://picsum.photos/seed/greenbowl-dish-'||s.n||'/800/600',s.kcal,s.status,
       CASE WHEN s.status='rejected' THEN 'Cần sửa mô tả trước khi gửi lại.' WHEN s.status='hidden' THEN 'Tạm ẩn để kiểm tra.' ELSE NULL END,
       CASE WHEN s.status='pending' THEN NULL ELSE (SELECT account_id FROM account WHERE email='duymk@greenbowl.vn') END,
       CASE WHEN s.status='pending' THEN NULL ELSE '2026-09-10 10:00+07'::timestamptz+s.n*interval '1 day' END,
       (SELECT account_id FROM account WHERE email='thanhvien'||lpad(s.n::text,2,'0')||'@greenbowl.vn'),
       '2026-08-01 09:00+07'::timestamptz+s.n*interval '1 day',
       '2026-09-10 10:00+07'::timestamptz+s.n*interval '1 day'
FROM seed_dish_input s;

INSERT INTO dish_category (dish_id,category_id)
SELECT d.dish_id,c.category_id FROM seed_dish_input s
JOIN dish d ON d.name=s.name JOIN category c ON c.name=s.category_name;

INSERT INTO recipe (dish_id,author_id,title,description,thumbnail_url,servings,prep_time_minutes,cook_time_minutes,calories_kcal,instructions)
SELECT d.dish_id,(SELECT account_id FROM account WHERE email='thanhvien'||lpad(s.n::text,2,'0')||'@greenbowl.vn'),
       'Cách làm '||s.name,s.description,d.thumbnail_url,2,10+s.n%3*5,15+s.n%4*5,s.kcal,s.instructions
FROM seed_dish_input s JOIN dish d ON d.name=s.name WHERE s.status='active';

INSERT INTO recipe_ingredient (recipe_id,ingredient_id,amount,unit)
SELECT r.recipe_id,i.ingredient_id,CASE WHEN x.ord=1 THEN 150 ELSE 80 END,'g'
FROM seed_dish_input s JOIN recipe r ON r.title='Cách làm '||s.name
CROSS JOIN LATERAL unnest(s.ingredients) WITH ORDINALITY AS x(ingredient_name,ord)
JOIN ingredient i ON i.name=x.ingredient_name;

CREATE TEMP TABLE seed_post_input (
    n int PRIMARY KEY, author_no int NOT NULL, title text UNIQUE NOT NULL,
    content text NOT NULL, category_name text NOT NULL, status post_status_enum NOT NULL,
    comment_one text, comment_two text
) ON COMMIT DROP;

INSERT INTO seed_post_input VALUES
(1,1,'Meal prep chay ba ngày cho người bận rộn','Tối Chủ nhật mình nấu gạo lứt, áp chảo đậu hũ và hấp bông cải. Chia hộp riêng rau để trưa hâm lại vẫn giòn.','Meal Prep','public','Đậu hũ để ngăn mát ba ngày có cần cấp đông không?','Mình thử thay bông cải bằng đậu que, vẫn rất hợp.'),
(2,2,'Nấu phở chay nấm hương tại nhà','Nước dùng từ nấm hương, cà rốt và củ cải cho vị ngọt tự nhiên. Mình nướng sơ nấm trước khi ninh để mùi thơm rõ hơn.','Món nước','public','Ninh nấm khoảng bao lâu thì nước không bị đục?','Mình thêm ít gừng nướng, bát phở thơm hơn hẳn.'),
(3,3,'Bún riêu chay với riêu đậu hũ','Mình bóp đậu hũ với một ít nấm băm để làm riêu, nấu chung cà chua rồi chan bún. Vị chua nhẹ nên không cần nhiều gia vị.','Món nước','public','Có thể dùng đậu hũ non thay đậu hũ trắng không?','Mình làm theo, thêm rau muống chần ăn rất vừa.'),
(4,4,'Bữa trưa 500 kcal từ cơm và đậu hũ','Một phần cơm vừa, đậu hũ áp chảo và hai nắm rau giúp mình no đến chiều. Mình cân khẩu phần theo nhu cầu riêng, không áp một mức cho mọi người.','Dinh dưỡng','public','Cảm ơn bạn đã ghi rõ khẩu phần chỉ là ví dụ.','Mình thay cơm trắng bằng gạo lứt, no lâu hơn.'),
(5,5,'Tìm quán chay có ghi rõ thành phần sốt','Mình hay hỏi kỹ nước sốt vì một số quán dùng mật ong hoặc nước mắm. Ai biết quán ở Bình Thạnh ghi rõ thành phần thì chia sẻ nhé.','Kinh nghiệm','public','Quán gần nhà mình có bảng thành phần ngay quầy.','Đúng rồi, nước sốt là phần dễ bị bỏ sót nhất.'),
(6,6,'Salad đậu gà cho ngày làm việc nóng','Đậu gà luộc chín, dưa leo, xà lách và chanh là đủ cho một phần salad mát. Mình để riêng sốt để rau không úng.','Salad','public','Đậu gà đóng hộp có cần luộc lại không?','Mình thêm mè rang, vị rất hợp với chanh.'),
(7,7,'Bữa sáng yến mạch qua đêm','Mình ngâm yến mạch với sữa yến mạch và hạt chia từ tối. Sáng thêm chuối, không cần bật bếp.','Ăn sáng','public','Mình thường ngâm sáu tiếng, hạt đã nở đủ.','Nếu thích ít ngọt, dùng chuối vừa chín là ổn.'),
(8,8,'Kho nấm đùi gà với tiêu đen','Nấm đùi gà cắt dày, áp chảo cho xém rồi kho lửa nhỏ với tiêu. Ăn cùng cơm nóng rất đưa cơm.','Món chính','public','Áp chảo trước giúp nấm bớt ra nước thật.','Mình giảm tiêu cho trẻ nhỏ, món vẫn ngon.'),
(9,9,'Canh chua chay cho bữa tối','Mình dùng cà chua, dứa và nấm rơm thay nước dùng đóng gói. Cho rau muống cuối cùng để rau còn xanh.','Món nước','public','Dùng me thay dứa được không bạn?','Nước canh thanh, ăn với đậu hũ kho rất hợp.'),
(10,10,'Gợi ý quán chay ở Quận 3','Mình tổng hợp ba quán đã ghé, ghi giá và món mình ăn để mọi người tự cân nhắc. Đây là trải nghiệm cá nhân, không nhận tài trợ.','Kinh nghiệm','public','Bạn có thể cho biết quán nào có chỗ gửi xe?','Ai chê các quán này thì đúng là chẳng biết ăn uống gì, đừng vào nhóm nữa.'),
(11,11,'Protein thực vật khi tập thể thao','Mình luân phiên đậu hũ, đậu gà và tempeh, kết hợp nhiều loại thực phẩm thay vì chỉ uống bột. Khẩu phần nên tùy lịch tập và nhu cầu từng người.','Dinh dưỡng','public','Lượng protein trong tempeh bạn tính theo khối lượng sống hay chín?','Bỏ hẳn bữa tối rồi chỉ ăn rau là cách giảm cân tốt nhất cho mọi người, không cần hỏi ai.'),
(12,12,'Kiểm tra nhãn thực phẩm thuần chay','Khi mua thực phẩm đóng gói mình xem thành phần sữa, mật ong và gelatin. Nhãn vegan giúp tham khảo nhưng vẫn nên đọc danh sách nguyên liệu.','Kinh nghiệm','public','Mình gặp một loại sốt ghi chay nhưng có mật ong, nên đọc nhãn rất quan trọng.','Ai muốn ăn chay phải mua bột của mình, nhắn tin riêng để lấy giá và link đặt hàng.'),
(13,13,'Đậu hũ sốt cà chua cho bữa cơm gia đình','Mình rim đậu hũ với cà chua chín và chút tiêu, ăn cùng rau luộc. Món dễ làm và hợp cả người mới ăn chay.','Món chính','public','Mình áp chảo đậu trước nên sốt thấm mà đậu không vỡ.','Đồ ăn của bạn nhìn tệ quá, làm vậy mà cũng đăng lên cho mọi người xem à?'),
(14,14,'Đi chợ cho thực đơn chay một tuần','Mình mua rau theo mùa, đậu hũ, nấm và ngũ cốc trước, sau đó mới lên thực đơn. Cách này giúp giảm đồ bỏ phí.','Meal Prep','public','Danh sách mua sắm theo tuần này hữu ích quá.','Mình chia rau lá và củ riêng, giữ được lâu hơn.'),
(15,15,'Cà ri khoai lang đậu gà không quá cay','Khoai lang tạo độ sánh, đậu gà cho cảm giác no. Mình dùng ít nước cốt dừa để món không quá béo.','Món chính','public','Có thể nấu sẵn rồi cấp đông từng phần không?','Mình thêm nghệ tươi, màu đẹp mà thơm.'),
(16,16,'Bún Huế chay thơm sả','Mình nấu nước dùng bằng nấm và sả, thêm đậu hũ áp chảo. Ớt để riêng để ai ăn cay mới thêm.','Món nước','public','Cách để ớt riêng rất hợp với gia đình có trẻ nhỏ.','Mình thử với nấm đùi gà, nước dùng đậm hơn.'),
(17,18,'Salad quinoa và rau giòn','Quinoa nấu rồi để nguội, trộn với dưa leo và xà lách. Sốt chanh để riêng giúp mang đi làm không bị mềm rau.','Salad','public','Quinoa nấu tỉ lệ nước bao nhiêu vậy bạn?','Mình thêm đậu gà vào cho đủ bữa trưa.'),
(18,19,'Cơm chiên rau củ dùng cơm nguội','Cơm nguội hạt rời giúp xào nhanh, mình thêm cà rốt và đậu que cắt nhỏ. Chảo nóng và ít dầu là đủ.','Món chính','public','Mình làm thử, cơm không bị nhão.','Thêm đậu hũ vụn cũng khá ngon.'),
(19,20,'Súp bí đỏ với sữa yến mạch','Bí đỏ hấp chín rồi xay với sữa yến mạch. Mình nêm tiêu khi ăn, không cần kem sữa động vật.','Món nhẹ','public','Bí đỏ hấp giữ vị ngọt tốt hơn luộc.','Mình ăn kèm bánh mì nướng, vừa đủ bữa tối.'),
(20,22,'Gỏi cuốn đậu hũ và rau tươi','Mình cuốn đậu hũ áp chảo, xà lách và dưa leo trong bánh tráng. Nước chấm đậu phộng để riêng vì nhiều người bị dị ứng.','Món nhẹ','public','Cảm ơn bạn đã lưu ý về dị ứng đậu phộng.','Để bánh tráng mềm vừa thôi thì cuốn không rách.'),
(21,17,'Bột detox thay bữa giúp giảm 5 kg trong một tuần','Mình bán gói bột detox qua tin nhắn. Chỉ cần bỏ bữa chính và uống bột là giảm nhanh, ai mua hôm nay được giảm giá.','Dinh dưỡng','reported','Lời hứa giảm cân nhanh này cần được kiểm tra.','Bài đang dẫn mọi người bỏ bữa để mua sản phẩm.'),
(22,31,'Ăn chay mà không theo cách của tôi thì đừng tham gia','Bài viết công kích những người ăn chay linh hoạt, dùng lời lẽ xúc phạm và kêu gọi mọi người kéo sang trang cá nhân để tranh cãi.','Kinh nghiệm','deleted',NULL,NULL),
(23,23,'Danh sách quán chay cuối tuần ở Sài Gòn','Mình liệt kê các quán đã ghé. Sau khi bài từng được kết luận không vi phạm, tác giả sửa nội dung để gắn link đặt bàn có mã giới thiệu.','Kinh nghiệm','reported','Danh sách này có link tiếp thị mới thêm sau lần kiểm tra trước.','Mã giới thiệu lặp lại nhiều lần trong bài đã sửa.'),
(24,24,'Bữa tối đậu hũ và rau hấp đơn giản','Mình ăn một phần đậu hũ, rau hấp và cơm. Đây chỉ là bữa ăn mình thích, không quảng cáo hay đưa lời khuyên điều trị.','Món chính','public','Bài này là chia sẻ bữa ăn cá nhân, không thấy quảng cáo.','Mình đã thử thêm nấm, món hợp khẩu vị.'),
(25,25,'Nước mắm cá có dùng được cho món thuần chay không?','Tác giả viết rằng nước mắm cá vẫn là nguyên liệu thuần chay và khuyên người mới cứ dùng, dù sản phẩm có thành phần từ cá.','Dinh dưỡng','reported','Nước mắm từ cá không phù hợp món thuần chay.','Thông tin nguyên liệu trong bài đang gây hiểu nhầm.'),
(26,26,'Mua thực phẩm bổ sung để chữa thiếu máu không cần khám','Bài rao bán viên bổ sung, khẳng định thay được tư vấn y tế và yêu cầu chuyển khoản trước để nhận hàng.','Dinh dưỡng','reported','Bài có nội dung bán hàng và khuyến nghị sức khỏe thiếu căn cứ.','Có số tài khoản và lời cam kết chữa bệnh.'),
(27,27,'Tranh luận về đồ chay giả mặn','Tác giả đặt vấn đề liệu món chay mô phỏng thịt có cần thiết, nhưng đoạn cuối chuyển sang công kích người không đồng ý.','Kinh nghiệm','reported','Đoạn cuối có lời lẽ công kích thành viên khác.','Chủ đề tranh luận được, nhưng cách diễn đạt không phù hợp.'),
(28,28,'Thử món nấm mới cho bữa tối','Mình đang thử tỉ lệ nấm, đậu hũ và rau. Sẽ cập nhật định lượng sau khi nấu lại.','Món chính','pending',NULL,NULL),
(29,29,'Ghi chép bữa sáng yến mạch','Mình đang chụp lại các bước và kiểm tra lượng nguyên liệu trước khi đăng công thức.','Ăn sáng','pending',NULL,NULL),
(30,30,'Quán chay mới mở gần nhà','Mình mới ghé một lần, đang đợi thêm trải nghiệm trước khi viết nhận xét đầy đủ.','Kinh nghiệm','pending',NULL,NULL),
(31,45,'Rao bán sản phẩm không rõ nguồn gốc','Bài từng đăng đường dẫn thanh toán không rõ cửa hàng và bị xóa mềm sau kiểm tra.','Kinh nghiệm','deleted',NULL,NULL),
(32,50,'Bài cũ của tài khoản đã rời cộng đồng','Nội dung cũ không còn hiển thị công khai sau khi thành viên xóa tài khoản.','Kinh nghiệm','deleted',NULL,NULL);

WITH rows AS (SELECT s.*,row_number() OVER (ORDER BY s.n)::int AS rn FROM seed_post_input s)
INSERT INTO post (account_id,post_type,title,content,thumbnail_url,status,moderation_note,moderated_by,moderated_at,view_count,vote_count,comment_count,published_at,deleted_at,created_at,updated_at)
SELECT a.account_id,'blog',s.title,s.content,
       'https://picsum.photos/seed/greenbowl-post-'||s.n||'/1000/600',s.status,
       CASE WHEN s.status='deleted' THEN 'Đã xóa mềm sau kiểm duyệt hoặc theo yêu cầu thành viên.' ELSE NULL END,
       CASE WHEN s.status='pending' THEN NULL ELSE (SELECT account_id FROM account WHERE email='lamdv@greenbowl.vn') END,
       CASE WHEN s.status='pending' THEN NULL ELSE '2026-08-20 08:00+07'::timestamptz+s.n*interval '1 day' END,
       CASE WHEN s.status='pending' THEN 0 ELSE 80+s.n*37 END,0,0,
       CASE WHEN s.status='pending' THEN NULL ELSE '2026-08-20 09:00+07'::timestamptz+s.n*interval '1 day' END,
       CASE WHEN s.n=22 THEN '2026-09-23 10:05+07'::timestamptz
            WHEN s.status='deleted' THEN '2026-09-24 18:00+07'::timestamptz+s.n*interval '2 hours' ELSE NULL END,
       '2026-08-18 09:00+07'::timestamptz+s.n*interval '1 day',
       CASE WHEN s.status='reported' THEN '2026-09-28 10:00+07'::timestamptz
            WHEN s.n=22 THEN '2026-09-23 10:05+07'::timestamptz
            WHEN s.status='deleted' THEN '2026-09-24 18:00+07'::timestamptz+s.n*interval '2 hours'
            ELSE '2026-08-20 09:00+07'::timestamptz+s.n*interval '1 day' END
FROM rows s JOIN account a ON a.email='thanhvien'||lpad(s.author_no::text,2,'0')||'@greenbowl.vn';

INSERT INTO post_category (post_id,category_id)
SELECT p.post_id,c.category_id FROM seed_post_input s JOIN post p ON p.title=s.title
JOIN category c ON c.name=s.category_name;

INSERT INTO comment (post_id,author_id,content,status,created_at,updated_at)
SELECT p.post_id,a.account_id,x.body,
       (CASE WHEN (s.n=10 AND x.seq=2) OR (s.n=13 AND x.seq=2) THEN 'hidden' ELSE 'public' END)::comment_status_enum,
       p.published_at+x.seq*interval '2 hours',
       CASE WHEN s.n=10 AND x.seq=2 THEN '2026-09-21 11:00+07'::timestamptz
            WHEN s.n=13 AND x.seq=2 THEN '2026-09-23 11:00+07'::timestamptz
            WHEN s.n=12 AND x.seq=2 THEN '2026-09-27 17:00+07'::timestamptz
            ELSE p.published_at+x.seq*interval '2 hours' END
FROM seed_post_input s JOIN post p ON p.title=s.title
CROSS JOIN LATERAL (VALUES (1,s.comment_one),(2,s.comment_two)) AS x(seq,body)
JOIN LATERAL (
    SELECT account_id FROM account
    WHERE role_id=(SELECT role_id FROM role WHERE name='member')
      AND account_id<>p.account_id
    ORDER BY md5(s.n::text||':'||x.seq::text||':'||account_id::text) LIMIT 1
) a ON true
WHERE x.body IS NOT NULL;

INSERT INTO post_vote (post_id,account_id,created_at)
SELECT p.post_id,a.account_id,p.published_at+interval '1 day'
FROM post p JOIN seed_post_input s ON s.title=p.title
JOIN LATERAL (
    SELECT account_id FROM account
    WHERE role_id=(SELECT role_id FROM role WHERE name='member') AND account_id<>p.account_id
    ORDER BY md5(p.post_id::text||':'||account_id::text) LIMIT 5
) a ON true
WHERE p.status IN ('public','reported');

UPDATE post p SET vote_count=(SELECT count(*) FROM post_vote v WHERE v.post_id=p.post_id),
                  comment_count=(SELECT count(*) FROM comment c WHERE c.post_id=p.post_id AND c.status<>'deleted');

CREATE TEMP TABLE seed_case_input (
    case_key text PRIMARY KEY, target_type report_target_type_enum NOT NULL,
    target_id bigint NOT NULL, status report_status_enum NOT NULL,
    created_at timestamptz NOT NULL UNIQUE, handled_by_email text,
    handled_at timestamptz, resolution_note varchar(255)
) ON COMMIT DROP;

INSERT INTO seed_case_input VALUES
('p-detox-open','post',(SELECT post_id FROM post WHERE title='Bột detox thay bữa giúp giảm 5 kg trong một tuần'),'pending','2026-09-22 08:00+07',NULL,NULL,NULL),
('p-abuse-accepted','post',(SELECT post_id FROM post WHERE title='Ăn chay mà không theo cách của tôi thì đừng tham gia'),'accepted','2026-09-22 09:00+07','lamdv@greenbowl.vn','2026-09-23 10:00+07','Bài công kích thành viên đã được xóa mềm.'),
('p-shop-old','post',(SELECT post_id FROM post WHERE title='Danh sách quán chay cuối tuần ở Sài Gòn'),'rejected','2026-09-20 08:00+07','tungnh@greenbowl.vn','2026-09-21 10:00+07','Bản bài viết lúc kiểm tra chỉ chia sẻ trải nghiệm cá nhân.'),
('p-shop-new','post',(SELECT post_id FROM post WHERE title='Danh sách quán chay cuối tuần ở Sài Gòn'),'pending','2026-09-28 08:00+07',NULL,NULL,NULL),
('p-dinner-rejected','post',(SELECT post_id FROM post WHERE title='Bữa tối đậu hũ và rau hấp đơn giản'),'rejected','2026-09-23 08:00+07','duymk@greenbowl.vn','2026-09-24 10:00+07','Bài chia sẻ bữa ăn hợp lệ, không có quảng cáo.'),
('p-fishsauce-open','post',(SELECT post_id FROM post WHERE title='Nước mắm cá có dùng được cho món thuần chay không?'),'pending','2026-09-25 08:00+07',NULL,NULL,NULL),
('p-supplement-open','post',(SELECT post_id FROM post WHERE title='Mua thực phẩm bổ sung để chữa thiếu máu không cần khám'),'pending','2026-09-26 08:00+07',NULL,NULL,NULL),
('p-debate-open','post',(SELECT post_id FROM post WHERE title='Tranh luận về đồ chay giả mặn'),'pending','2026-09-27 09:00+07',NULL,NULL,NULL),
('c-abuse-accepted','comment',(SELECT comment_id FROM comment WHERE content='Ai chê các quán này thì đúng là chẳng biết ăn uống gì, đừng vào nhóm nữa.'),'accepted','2026-09-20 09:00+07','lamdv@greenbowl.vn','2026-09-21 11:00+07','Đã ẩn bình luận công kích người khác.'),
('c-diet-open','comment',(SELECT comment_id FROM comment WHERE content='Bỏ hẳn bữa tối rồi chỉ ăn rau là cách giảm cân tốt nhất cho mọi người, không cần hỏi ai.'),'pending','2026-09-27 08:00+07',NULL,NULL,NULL),
('c-spam-old','comment',(SELECT comment_id FROM comment WHERE content='Ai muốn ăn chay phải mua bột của mình, nhắn tin riêng để lấy giá và link đặt hàng.'),'rejected','2026-09-20 10:00+07','tungnh@greenbowl.vn','2026-09-21 12:00+07','Ở lần kiểm tra đầu, bình luận chưa có lời mời mua hàng.'),
('c-spam-new','comment',(SELECT comment_id FROM comment WHERE content='Ai muốn ăn chay phải mua bột của mình, nhắn tin riêng để lấy giá và link đặt hàng.'),'pending','2026-09-28 09:00+07',NULL,NULL,NULL),
('c-insult-accepted','comment',(SELECT comment_id FROM comment WHERE content='Đồ ăn của bạn nhìn tệ quá, làm vậy mà cũng đăng lên cho mọi người xem à?'),'accepted','2026-09-22 10:00+07','lamdv@greenbowl.vn','2026-09-23 11:00+07','Đã ẩn bình luận xúc phạm tác giả.'),
('a-detox-open','account',(SELECT account_id FROM account WHERE email='thanhvien17@greenbowl.vn'),'pending','2026-09-28 11:00+07',NULL,NULL,NULL),
('a-spam-accepted','account',(SELECT account_id FROM account WHERE email='thanhvien45@greenbowl.vn'),'accepted','2026-09-22 12:00+07','khoila@greenbowl.vn','2026-09-25 11:50+07','Tài khoản nhiều lần đăng nội dung bán hàng không rõ nguồn gốc; đã tạm khóa.'),
('a-supplement-old','account',(SELECT account_id FROM account WHERE email='thanhvien26@greenbowl.vn'),'rejected','2026-09-19 08:00+07','khoila@greenbowl.vn','2026-09-20 14:00+07','Lần kiểm tra đầu chưa đủ bằng chứng tài khoản quảng cáo sai quy định.'),
('a-supplement-new','account',(SELECT account_id FROM account WHERE email='thanhvien26@greenbowl.vn'),'pending','2026-09-29 08:00+07',NULL,NULL,NULL);

INSERT INTO report_case (target_type,target_id,status,created_at,handled_by,handled_at,resolution_note)
SELECT s.target_type,s.target_id,s.status,s.created_at,a.account_id,s.handled_at,s.resolution_note
FROM seed_case_input s LEFT JOIN account a ON a.email=s.handled_by_email;

CREATE TEMP TABLE seed_report_input (
    case_key text NOT NULL, reporter_no int NOT NULL,
    reason_code report_reason_code_enum NOT NULL, reason_text text NOT NULL,
    PRIMARY KEY (case_key,reporter_no)
) ON COMMIT DROP;

INSERT INTO seed_report_input VALUES
('p-detox-open',1,'spam','Bài yêu cầu nhắn tin mua bột thay bữa.'),
('p-detox-open',2,'other','Khẳng định giảm 5 kg trong một tuần dễ gây hiểu nhầm.'),
('p-detox-open',3,'spam','Có nội dung bán hàng xen với lời khuyên giảm cân.'),
('p-detox-open',4,'other','Khuyên bỏ bữa chính mà không giải thích rủi ro.'),
('p-abuse-accepted',5,'abusive','Tác giả xúc phạm người ăn chay linh hoạt.'),
('p-abuse-accepted',6,'abusive','Bài kêu gọi người khác công kích thành viên.'),
('p-abuse-accepted',7,'other','Nội dung gây căng thẳng không cần thiết trong nhóm.'),
('p-shop-old',8,'spam','Nghi bài giới thiệu quán là quảng cáo.'),
('p-shop-old',9,'other','Nhờ kiểm tra quan hệ của tác giả với quán.'),
('p-shop-new',8,'spam','Bài đã được sửa để thêm mã giới thiệu.'),
('p-shop-new',10,'spam','Link đặt bàn lặp lại ở nhiều đoạn.'),
('p-shop-new',11,'other','Nội dung mới khác bản đã được duyệt trước đây.'),
('p-dinner-rejected',12,'other','Mình chưa rõ bài có phải quảng cáo đậu hũ không.'),
('p-dinner-rejected',13,'spam','Nhờ admin kiểm tra ảnh và tên sản phẩm.'),
('p-fishsauce-open',14,'not_vegan','Bài gọi nước mắm từ cá là thuần chay.'),
('p-fishsauce-open',15,'not_vegan','Người mới ăn chay có thể hiểu sai thành phần.'),
('p-fishsauce-open',16,'other','Cần đính chính thông tin về nguyên liệu từ cá.'),
('p-supplement-open',18,'spam','Bài rao bán viên bổ sung và yêu cầu chuyển khoản.'),
('p-supplement-open',19,'other','Khẳng định có thể thay tư vấn y tế.'),
('p-debate-open',20,'abusive','Đoạn cuối công kích người có ý kiến khác.'),
('p-debate-open',21,'abusive','Cách tranh luận không phù hợp với cộng đồng.'),
('c-abuse-accepted',22,'abusive','Bình luận xua đuổi người khác khỏi nhóm.'),
('c-abuse-accepted',23,'abusive','Ngôn từ công kích người đánh giá quán.'),
('c-diet-open',24,'other','Bình luận khuyên mọi người bỏ bữa tối.'),
('c-diet-open',25,'other','Lời khuyên sức khỏe quá tuyệt đối.'),
('c-spam-old',26,'spam','Lúc đầu mình nghĩ tài khoản đang bán hàng.'),
('c-spam-old',27,'other','Nhờ admin kiểm tra bình luận này.'),
('c-spam-new',26,'spam','Bình luận đã sửa để mời nhắn tin mua bột.'),
('c-spam-new',28,'spam','Có lời kêu gọi mua hàng trong thảo luận.'),
('c-spam-new',29,'other','Nội dung mới chứa thông tin đặt hàng.'),
('c-insult-accepted',30,'abusive','Bình luận chê bai trực tiếp người đăng.'),
('c-insult-accepted',32,'abusive','Cách dùng từ xúc phạm không phù hợp.'),
('a-detox-open',33,'spam','Tài khoản liên tục mời mua bột detox dưới nhiều bài viết.'),
('a-detox-open',34,'other','Trang cá nhân chia sẻ lời hứa giảm cân nhanh thiếu căn cứ.'),
('a-detox-open',35,'spam','Tác giả nhắn tin bán sản phẩm sau khi được hỏi về công thức.'),
('a-spam-accepted',36,'spam','Tài khoản đăng đường dẫn thanh toán không rõ cửa hàng.'),
('a-spam-accepted',37,'other','Nhiều bài đăng của cùng tài khoản đã bị xóa vì rao bán.'),
('a-supplement-old',38,'other','Mình nghi tài khoản quảng cáo thực phẩm bổ sung.'),
('a-supplement-old',39,'spam','Nhờ kiểm tra các bài viết về viên bổ sung.'),
('a-supplement-new',38,'spam','Sau lần từ chối trước, tài khoản tiếp tục mời chuyển khoản mua viên bổ sung.'),
('a-supplement-new',40,'other','Tài khoản khuyên bỏ qua tư vấn y tế để dùng sản phẩm.'),
('a-supplement-new',41,'spam','Nội dung bán hàng xuất hiện ở nhiều thảo luận khác nhau.');

WITH numbered AS (
    SELECT *,row_number() OVER (PARTITION BY case_key ORDER BY reporter_no) AS rn
    FROM seed_report_input
)
INSERT INTO report (case_id,reporter_id,target_type,target_id,reason_code,reason_text,status,handled_by,handled_at,resolution_note,created_at)
SELECT rc.case_id,a.account_id,rc.target_type,rc.target_id,n.reason_code,n.reason_text,
       rc.status,rc.handled_by,rc.handled_at,rc.resolution_note,
       rc.created_at+(n.rn-1)*interval '25 minutes'
FROM numbered n JOIN seed_case_input s ON s.case_key=n.case_key
JOIN report_case rc ON rc.target_type=s.target_type AND rc.target_id=s.target_id AND rc.created_at=s.created_at
JOIN account a ON a.email='thanhvien'||lpad(n.reporter_no::text,2,'0')||'@greenbowl.vn';

INSERT INTO shop (name,address,phone,open_time,close_time,open_days,status,owner_account_id,verification_status,verification_note,verified_at,verified_by,created_by,created_at,updated_at) VALUES
('An Nhiên Vegan','125 Nguyễn Gia Trí, Bình Thạnh, TP.HCM','0908123451','08:00','21:00','T2-CN','active',(SELECT account_id FROM account WHERE email='thanhvien01@greenbowl.vn'),'verified','Đã đối chiếu thông tin cửa hàng.','2026-09-10 10:00+07',(SELECT account_id FROM account WHERE email='duymk@greenbowl.vn'),(SELECT account_id FROM account WHERE email='thanhvien01@greenbowl.vn'),'2026-08-01 09:00+07','2026-09-10 10:00+07'),
('Lá Xanh Kitchen','42 Võ Văn Tần, Quận 3, TP.HCM','0908123452','09:00','21:30','T2-CN','active',(SELECT account_id FROM account WHERE email='thanhvien03@greenbowl.vn'),'verified','Đã xác minh địa chỉ và người phụ trách.','2026-09-11 10:00+07',(SELECT account_id FROM account WHERE email='duymk@greenbowl.vn'),(SELECT account_id FROM account WHERE email='thanhvien03@greenbowl.vn'),'2026-08-02 09:00+07','2026-09-11 10:00+07'),
('Mộc Vegetarian','18 Phan Xích Long, Phú Nhuận, TP.HCM','0908123453','07:30','20:30','T2-CN','active',(SELECT account_id FROM account WHERE email='thanhvien05@greenbowl.vn'),'verified','Đã xác minh menu và thông tin liên hệ.','2026-09-12 10:00+07',(SELECT account_id FROM account WHERE email='duymk@greenbowl.vn'),(SELECT account_id FROM account WHERE email='thanhvien05@greenbowl.vn'),'2026-08-03 09:00+07','2026-09-12 10:00+07'),
('Bếp Hạt Và Rau','210 Điện Biên Phủ, Bình Thạnh, TP.HCM','0908123454','10:00','20:00','T2-T7','renovating',(SELECT account_id FROM account WHERE email='thanhvien06@greenbowl.vn'),'pending','Đang chờ bổ sung ảnh mặt bằng.',NULL,NULL,(SELECT account_id FROM account WHERE email='thanhvien06@greenbowl.vn'),'2026-09-16 09:00+07','2026-09-16 09:00+07'),
('Góc Chay Ban Mai','75 Lê Văn Sỹ, Quận 3, TP.HCM','0908123455','09:00','20:00','T2-CN','inactive',(SELECT account_id FROM account WHERE email='thanhvien09@greenbowl.vn'),'rejected','Số điện thoại chưa xác minh được.',NULL,(SELECT account_id FROM account WHERE email='duymk@greenbowl.vn'),(SELECT account_id FROM account WHERE email='thanhvien09@greenbowl.vn'),'2026-09-17 09:00+07','2026-09-18 10:00+07');

INSERT INTO shop_dish (shop_id,dish_id,dish_category,price,ingredient_note,is_available,created_at,updated_at,created_by,updated_by)
SELECT sh.shop_id,d.dish_id,c.name,45000+(rn-1)*12000,
       'Vui lòng báo trước nếu dị ứng đậu nành hoặc mè.',rn<>4,
       greatest(sh.created_at,'2026-09-12 09:00+07'::timestamptz)+interval '1 day',
       '2026-09-20 09:00+07',sh.owner_account_id,sh.owner_account_id
FROM shop sh
JOIN LATERAL (
    SELECT q.dish_id,q.name,row_number() OVER (ORDER BY q.dish_id) AS rn
    FROM (SELECT dish_id,name FROM dish WHERE status='active'
          ORDER BY md5(sh.shop_id::text||':'||dish_id::text) LIMIT 4) q
) d ON true
JOIN seed_dish_input sd ON sd.name=d.name JOIN category c ON c.name=sd.category_name;

INSERT INTO banned_keyword (keyword,normalized_keyword) VALUES
('kiếm tiền cấp tốc','kiếm tiền cấp tốc'),
('link nhận quà miễn phí','link nhận quà miễn phí'),
('chữa khỏi 100%','chữa khỏi 100%'),
('bỏ bữa để giảm cân','bỏ bữa để giảm cân'),
('mua ngay hôm nay','mua ngay hôm nay'),
('đừng vào nhóm nữa','đừng vào nhóm nữa'),
('chuyển khoản đặt cọc','chuyển khoản đặt cọc'),
('nhắn tin mua bột','nhắn tin mua bột');

INSERT INTO notification (account_id,type,title,content,ref_type,ref_id,is_read,created_at)
SELECT r.reporter_id,'report_result',
       CASE WHEN r.status='accepted' THEN 'Báo cáo đã được chấp nhận' ELSE 'Báo cáo chưa được chấp nhận' END,
       COALESCE(rc.resolution_note,'Admin đã xử lý báo cáo.'),'report',r.report_id,
       false,rc.handled_at+interval '5 minutes'
FROM report r JOIN report_case rc ON rc.case_id=r.case_id WHERE rc.status IN ('accepted','rejected');

INSERT INTO notification (account_id,type,title,content,ref_type,ref_id,is_read,created_at)
SELECT p.account_id,'post_approved','Bài viết đã được duyệt',
       'Bài viết '||p.title||' đã hiển thị trong cộng đồng.','post',p.post_id,true,p.moderated_at+interval '5 minutes'
FROM post p JOIN seed_post_input s ON s.title=p.title WHERE s.n BETWEEN 1 AND 6;

INSERT INTO notification (account_id,type,title,content,ref_type,ref_id,is_read,created_at)
SELECT p.account_id,'post_removed','Bài viết đã bị gỡ',
       'Bài viết vi phạm quy tắc ứng xử đã bị xóa mềm.','post',p.post_id,false,p.deleted_at+interval '5 minutes'
FROM post p WHERE p.title='Ăn chay mà không theo cách của tôi thì đừng tham gia';

INSERT INTO notification (account_id,type,title,content,ref_type,ref_id,is_read,created_at)
SELECT c.author_id,'comment_removed','Bình luận đã bị ẩn',
       'Bình luận công kích thành viên khác đã bị ẩn sau khi kiểm tra.','comment',c.comment_id,false,
       rc.handled_at+interval '5 minutes'
FROM report_case rc JOIN comment c ON rc.target_type='comment' AND rc.target_id=c.comment_id
WHERE rc.status='accepted';

INSERT INTO notification (account_id,type,title,content,ref_type,ref_id,is_read,created_at)
SELECT d.created_by,'dish_approved','Món ăn đã được duyệt',
       'Món '||d.name||' đã được hiển thị.','dish',d.dish_id,true,d.moderated_at+interval '5 minutes'
FROM dish d JOIN seed_dish_input s ON s.name=d.name WHERE s.n BETWEEN 1 AND 5;

INSERT INTO notification (account_id,type,title,content,ref_type,ref_id,is_read,created_at)
SELECT sh.owner_account_id,'shop_verified','Cửa hàng đã xác minh',
       'Cửa hàng '||sh.name||' đã hoàn tất xác minh.','shop',sh.shop_id,false,sh.verified_at+interval '5 minutes'
FROM shop sh WHERE sh.verification_status='verified';

INSERT INTO notification (account_id,type,title,content,ref_type,ref_id,is_read,created_at)
SELECT account_id,'account_locked','Tài khoản tạm khóa',
       'Tài khoản tạm khóa sau khi nội dung vi phạm được kiểm tra.','account',account_id,false,'2026-09-25 12:00+07'
FROM account WHERE email='thanhvien45@greenbowl.vn';

INSERT INTO admin_log (admin_id,action,target_type,target_id,reason,before_value,after_value,ip_address,created_at)
SELECT rc.handled_by,'HANDLE_REPORT_CASE','report',min(r.report_id),rc.resolution_note,
       jsonb_build_object('status','pending'),jsonb_build_object('status',rc.status::text,'case_id',rc.case_id),
       '127.0.0.1',rc.handled_at
FROM report_case rc JOIN report r ON r.case_id=rc.case_id WHERE rc.status IN ('accepted','rejected')
GROUP BY rc.case_id,rc.handled_by,rc.resolution_note,rc.status,rc.handled_at;

INSERT INTO admin_log (admin_id,action,target_type,target_id,reason,after_value,ip_address,created_at)
SELECT verified_by,'VERIFY_SHOP','shop',shop_id,verification_note,
       jsonb_build_object('verification_status','verified'),'127.0.0.1',verified_at
FROM shop WHERE verification_status='verified';

INSERT INTO admin_log (admin_id,action,target_type,target_id,reason,after_value,ip_address,created_at)
SELECT (SELECT account_id FROM account WHERE email='khoila@greenbowl.vn'),
       'LOCK_ACCOUNT','account',account_id,'Tạm khóa để kiểm tra nội dung công kích.',
       jsonb_build_object('status','locked'),'127.0.0.1','2026-09-25 11:55+07'
FROM account WHERE email='thanhvien45@greenbowl.vn';

INSERT INTO daily_quota (subject_type,subject_key,quota_date,posts_viewed,chat_turns,updated_at)
SELECT 'account',a.account_id::text,'2026-09-29',n%5, n%4,'2026-09-29 21:00+07'
FROM (SELECT account_id,row_number() OVER (ORDER BY account_id)::int AS n FROM account
      WHERE role_id=(SELECT role_id FROM role WHERE name='member')) a WHERE n<=20;

INSERT INTO daily_quota (subject_type,subject_key,quota_date,posts_viewed,chat_turns,updated_at) VALUES
('device','guest-browser-001','2026-09-29',3,2,'2026-09-29 21:00+07'),
('device','guest-browser-002','2026-09-29',1,0,'2026-09-29 21:00+07'),
('device','guest-browser-003','2026-09-29',2,3,'2026-09-29 21:00+07');

INSERT INTO meal_plan (account_id,title,start_date,days_count,meals_per_day,source,bmi_snapshot,target_calories_kcal,goal_snapshot,allergy_snapshot,available_ingredients,status,ai_model,prompt_tokens,completion_tokens,created_at,updated_at)
SELECT a.account_id,'Thực đơn chay ba ngày cho '||a.full_name,date '2026-10-01'+x.n,
       3,3,(CASE WHEN x.n=5 THEN 'manual' ELSE 'ai' END)::meal_plan_source_enum,
       p.bmi,p.target_calories_kcal,p.health_goal,
       COALESCE((SELECT jsonb_agg(al.name) FROM allergy al WHERE al.profile_id=p.profile_id),'[]'::jsonb),
       'Đậu hũ, nấm, rau xanh, gạo lứt',
       (CASE WHEN x.n=5 THEN 'draft' ELSE 'saved' END)::meal_plan_status_enum,
       CASE WHEN x.n=5 THEN NULL ELSE 'greenbowl-demo' END,
       CASE WHEN x.n=5 THEN NULL ELSE 320+x.n*20 END,
       CASE WHEN x.n=5 THEN NULL ELSE 170+x.n*15 END,
       '2026-09-25 09:00+07'::timestamptz+x.n*interval '1 day',
       '2026-09-25 09:00+07'::timestamptz+x.n*interval '1 day'
FROM generate_series(1,5) AS x(n)
JOIN account a ON a.email='thanhvien'||lpad(x.n::text,2,'0')||'@greenbowl.vn'
JOIN profile p ON p.account_id=a.account_id;

INSERT INTO meal_plan_item (meal_plan_id,day_no,meal_slot,dish_id,dish_name,description,calories_kcal,nutrition_group,ingredients,is_swapped,original_dish_name)
SELECT mp.meal_plan_id,day_no,slot.meal_slot,d.dish_id,d.name,d.description,d.est_calories_kcal,
       (CASE WHEN slot.meal_slot='breakfast' THEN 'carb' WHEN slot.meal_slot='lunch' THEN 'protein' ELSE 'vegetable' END)::nutrition_group_enum,
       to_jsonb(sd.ingredients),false,NULL
FROM meal_plan mp CROSS JOIN generate_series(1,3) AS days(day_no)
CROSS JOIN (VALUES ('breakfast'::meal_slot_enum),('lunch'::meal_slot_enum),('dinner'::meal_slot_enum)) AS slot(meal_slot)
JOIN seed_dish_input sd ON sd.n=CASE
    WHEN slot.meal_slot='breakfast' THEN CASE WHEN day_no=1 THEN 8 WHEN day_no=2 THEN 9 ELSE 14 END
    WHEN slot.meal_slot='lunch' THEN CASE WHEN day_no=1 THEN 3 WHEN day_no=2 THEN 5 ELSE 6 END
    ELSE CASE WHEN day_no=1 THEN 1 WHEN day_no=2 THEN 10 ELSE 11 END END
JOIN dish d ON d.name=sd.name;

INSERT INTO chat_session (account_id,device_id,is_trial,title,message_count,started_at,last_activity_at,ended_at)
SELECT a.account_id,'member-device-'||x.n,false,
       (ARRAY['Bữa sáng chay','Đạm thực vật','Meal prep cuối tuần','Món ít dầu','Dị ứng đậu nành'])[x.n],
       3,'2026-09-26 08:00+07'::timestamptz+x.n*interval '1 hour',
       '2026-09-26 08:15+07'::timestamptz+x.n*interval '1 hour',
       '2026-09-26 08:15+07'::timestamptz+x.n*interval '1 hour'
FROM generate_series(1,5) AS x(n)
JOIN account a ON a.email='thanhvien'||lpad(x.n::text,2,'0')||'@greenbowl.vn';

INSERT INTO chat_message (chat_session_id,sender,content,status,tokens_used,ai_model,ref_post_id,created_at)
SELECT cs.chat_session_id,
       (CASE WHEN x.n=2 THEN 'bot' ELSE 'user' END)::chat_sender_enum,
       CASE WHEN x.n=1 THEN 'Mình muốn một bữa chay dễ chuẩn bị trong 20 phút.'
            WHEN x.n=2 THEN 'Bạn có thể thử đậu hũ áp chảo với rau và cơm; kiểm tra dị ứng trước khi chọn nguyên liệu.'
            ELSE 'Cảm ơn, mình sẽ thử điều chỉnh theo khẩu phần của mình.' END,
       'ok',CASE WHEN x.n=2 THEN 120 ELSE 25 END,
       CASE WHEN x.n=2 THEN 'greenbowl-demo' ELSE NULL END,
       CASE WHEN x.n=2 THEN (SELECT post_id FROM post WHERE title='Meal prep chay ba ngày cho người bận rộn') ELSE NULL END,
       cs.started_at+x.n*interval '5 minutes'
FROM chat_session cs CROSS JOIN generate_series(1,3) AS x(n);

-- Fail the transaction if the essential demo invariants are broken.
DO $$
BEGIN
    IF (SELECT count(*) FROM account WHERE role_id=(SELECT role_id FROM role WHERE name='admin'))<>4
       OR (SELECT count(*) FROM account WHERE role_id=(SELECT role_id FROM role WHERE name='member'))<>50 THEN
        RAISE EXCEPTION 'Expected 4 admins and 50 members';
    END IF;
    IF (SELECT count(*) FROM profile)<>50 OR (SELECT count(*) FROM report_case)<>17
       OR (SELECT count(*) FROM report)<>42 THEN
        RAISE EXCEPTION 'Profile or report seed count mismatch';
    END IF;
    IF EXISTS (SELECT 1 FROM report r JOIN report_case rc ON rc.case_id=r.case_id
               WHERE r.target_type<>rc.target_type OR r.target_id<>rc.target_id OR r.status<>rc.status) THEN
        RAISE EXCEPTION 'Report and case data mismatch';
    END IF;
    IF EXISTS (SELECT 1 FROM post p WHERE p.vote_count<>(SELECT count(*) FROM post_vote v WHERE v.post_id=p.post_id)
                                  OR p.comment_count<>(SELECT count(*) FROM comment c WHERE c.post_id=p.post_id AND c.status<>'deleted')) THEN
        RAISE EXCEPTION 'Post counters mismatch';
    END IF;
END $$;

COMMIT;
