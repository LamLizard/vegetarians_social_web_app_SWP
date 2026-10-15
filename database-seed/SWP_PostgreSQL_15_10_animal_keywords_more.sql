-- Khoi's code (15/10/2026): thêm từ chỉ động vật còn thiếu (thử "bánh mì chó", "mèo", "dế" không bị tô đỏ).
-- Chỉ để CẢNH BÁO (tô đỏ, Admin xem lại), không chặn gửi. normalized_keyword = chữ thường, GIỮ DẤU.
-- Chạy lại không tạo trùng (NOT EXISTS). Server tự đọc lại danh sách sau tối đa 60 giây, không cần khởi động lại.
INSERT INTO banned_keyword (keyword, normalized_keyword, category)
SELECT w, w, 'animal'
FROM unnest(ARRAY[
  'chó', 'mèo', 'chuột', 'rắn', 'thỏ', 'ngựa', 'nai', 'trâu', 'bê', 'nghé',
  'chim cút', 'bồ câu', 'đà điểu', 'dế', 'nhộng', 'châu chấu', 'cào cào', 'ốc sên',
  'ba ba', 'rùa', 'cá sấu', 'sứa', 'tép', 'ruốc', 'cáy', 'dăm bông', 'thịt xông khói'
]) AS t(w)
WHERE NOT EXISTS (
  SELECT 1 FROM banned_keyword b WHERE b.category = 'animal' AND b.normalized_keyword = t.w
);

-- Kiểm tra số từ động vật hiện có
SELECT count(*) AS animal_words FROM banned_keyword WHERE category = 'animal';
