-- Các hàng chờ kiểm duyệt bài viết và báo cáo.
-- Người vận hành xác định đúng nhánh Neon trước khi chạy toàn bộ file cùng một session.
-- Script dùng một transaction; lỗi sẽ làm toàn bộ thay đổi trong transaction bị hủy.
-- Nếu có tiêu đề trùng, script dừng để kiểm tra. Nếu tất cả tiêu đề của lần chạy
-- trước đã bị đổi hoặc xóa, cần kiểm tra lịch sử trước khi cân nhắc chạy lại.

BEGIN;

DO $moderation_queues$
DECLARE
  pending_titles text[] := ARRAY[
    'Bữa sáng nhẹ với đậu hũ và rau củ',
    'Một tuần chuẩn bị bữa trưa mang đi',
    'Cách mình nấu nước dùng rau củ trong',
    'Gợi ý bảo quản nấm tươi trong tủ lạnh',
    'Mâm cơm chay cho ngày mưa'
  ];
  pending_contents text[] := ARRAY[
    'Sáng nay mình áp chảo đậu hũ với ít dầu, thêm cà chua và rau xà lách. Ăn cùng bánh mì nguyên cám vừa nhanh vừa đủ no. Mọi người thường dùng loại sốt nào cho món này?',
    'Cuối tuần mình sơ chế đậu, rửa rau và chia thành từng hộp nhỏ. Đến sáng chỉ cần nấu cơm, thêm rau theo mùa và một món đậu là có bữa trưa mang đi. Rau lá mình để riêng để giữ độ giòn.',
    'Mình thường dùng củ cải trắng, cà rốt, bắp và hành tây để nấu nước dùng. Cho nguyên liệu vào nước lạnh, đun nhỏ lửa rồi lọc qua rây. Nước ngọt thanh, hợp để nấu bún hoặc canh.',
    'Nấm mua về mình bỏ phần bị dập, để trong túi giấy ở ngăn mát và chỉ rửa ngay trước khi nấu. Cách này giúp nấm khô ráo hơn; mình cũng cố gắng dùng hết trong vài ngày.',
    'Trời mưa mình nấu canh bí đỏ với đậu phộng, thêm đĩa rau luộc và đậu hũ kho nấm. Bữa cơm đơn giản nhưng ấm bụng. Nhà mọi người có món chay nào hay nấu vào ngày mưa không?'
  ];
  target_titles text[] := ARRAY[
    'Giảm giá đồ gia dụng trong tuần này',
    'Nhận tư vấn mua bán điện thoại cũ',
    'Cách đăng ký nhận ưu đãi mua sắm',
    'Chia sẻ mẹo chọn phụ kiện xe máy',
    'Thông tin chương trình giới thiệu bạn bè'
  ];
  target_contents text[] := ARRAY[
    'Mình đang thanh lý một số đồ gia dụng. Ai cần xem danh sách và giá thì nhắn riêng, mình gửi thông tin chi tiết.',
    'Mình nhận hỗ trợ chọn điện thoại cũ theo nhu cầu và ngân sách. Có thể nhắn riêng để trao đổi về mẫu máy và tình trạng.',
    'Ai muốn nhận thông tin ưu đãi mua sắm hằng tuần thì để lại lời nhắn, mình sẽ gửi hướng dẫn đăng ký.',
    'Mình tổng hợp vài kinh nghiệm chọn gương và giá đỡ cho xe máy. Khi mua nên xem kích thước tương thích và kiểm tra độ chắc của khớp nối.',
    'Mình có chương trình giới thiệu bạn bè mua hàng, ai quan tâm có thể nhắn để nhận thông tin và điều kiện áp dụng.'
  ];
  post_reason_codes text[] := ARRAY['spam', 'wrong_topic', 'spam', 'wrong_topic', 'spam'];
  post_reasons text[] := ARRAY[
    'Bài đăng chủ yếu mời liên hệ mua đồ, không liên quan đến nội dung cộng đồng.',
    'Nội dung tư vấn điện thoại không liên quan đến chủ đề ăn chay.',
    'Bài kêu gọi nhắn riêng để nhận ưu đãi, không chia sẻ nội dung về ăn chay.',
    'Bài chia sẻ phụ kiện xe máy, không liên quan đến chủ đề của cộng đồng.',
    'Nội dung chủ yếu mời tham gia chương trình mua hàng qua giới thiệu.'
  ];
  comment_contents text[] := ARRAY[
    'Ai muốn nhận danh sách ưu đãi thì nhắn riêng cho mình nhé, mình gửi ngay.',
    'Đăng quảng cáo thế này mà cũng đăng được, người đăng chẳng biết gì cả.',
    'Mọi người nhắn riêng cho mình để nhận thông tin bán hàng nhé.',
    'Viết bài kiểu này mà cũng đăng lên, đọc mất thời gian thật.',
    'Ai cần thông tin khuyến mãi thì liên hệ riêng với mình để nhận bảng giá.'
  ];
  comment_reason_codes text[] := ARRAY['spam', 'abusive', 'spam', 'abusive', 'spam'];
  comment_reasons text[] := ARRAY[
    'Bình luận mời liên hệ nhận ưu đãi, không liên quan đến bài viết.',
    'Bình luận công kích người đăng thay vì góp ý về nội dung quảng cáo.',
    'Bình luận quảng bá bán hàng và mời liên hệ riêng.',
    'Bình luận chê bai người đăng, không đưa ra góp ý cụ thể.',
    'Bình luận quảng bá khuyến mãi và mời liên hệ nhận bảng giá.'
  ];
  account_ids bigint[] := ARRAY[]::bigint[];
  candidate record;
  category_id_value bigint;
  pending_post_id bigint;
  target_post_id bigint;
  comment_id_value bigint;
  post_case_id bigint;
  comment_case_id bigint;
  reporter_id_value bigint;
  i integer;
BEGIN
  PERFORM pg_advisory_xact_lock(19760427, 20261106);

  IF (SELECT count(DISTINCT title) FROM unnest(pending_titles || target_titles) AS t(title)) <> 10 THEN
    RAISE EXCEPTION 'Danh sách tiêu đề không duy nhất; không có dữ liệu nào được thêm.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.post WHERE title = ANY(pending_titles || target_titles)) THEN
    RAISE EXCEPTION 'Có tiêu đề đã tồn tại; kiểm tra lịch sử và dữ liệu trước khi chạy lại.';
  END IF;

  FOR candidate IN
    SELECT a.account_id
    FROM public.account a
    JOIN public.role r ON r.role_id = a.role_id
    WHERE r.name = 'member' AND a.status = 'active'
    ORDER BY random()
    LIMIT 5
    FOR SHARE OF a
  LOOP
    account_ids := array_append(account_ids, candidate.account_id);
  END LOOP;
  IF cardinality(account_ids) <> 5 THEN
    RAISE EXCEPTION 'Không đủ 5 tài khoản member đang hoạt động.';
  END IF;

  SELECT c.category_id INTO category_id_value
  FROM public.category c
  WHERE c.name = 'Kinh nghiệm' AND c.is_active
  ORDER BY c.category_id
  LIMIT 1
  FOR SHARE OF c;
  IF category_id_value IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy chủ đề Kinh nghiệm đang hoạt động.';
  END IF;

  FOR i IN 1..5 LOOP
    reporter_id_value := account_ids[(i % 5) + 1];

    INSERT INTO public.post (account_id, post_type, title, content, status)
    VALUES (account_ids[i], 'blog', pending_titles[i], pending_contents[i], 'pending')
    RETURNING post_id INTO pending_post_id;
    INSERT INTO public.post_category (post_id, category_id)
    VALUES (pending_post_id, category_id_value);

    INSERT INTO public.post (account_id, post_type, title, content, status, published_at)
    VALUES (account_ids[i], 'blog', target_titles[i], target_contents[i], 'public', now())
    RETURNING post_id INTO target_post_id;
    INSERT INTO public.post_category (post_id, category_id)
    VALUES (target_post_id, category_id_value);

    INSERT INTO public.comment (post_id, author_id, content, status)
    VALUES (target_post_id, account_ids[i], comment_contents[i], 'public')
    RETURNING comment_id INTO comment_id_value;
    UPDATE public.post SET comment_count = comment_count + 1 WHERE post_id = target_post_id;

    INSERT INTO public.report_case (target_type, target_id, status)
    VALUES ('post', target_post_id, 'pending')
    RETURNING case_id INTO post_case_id;
    INSERT INTO public.report (case_id, reporter_id, target_type, target_id, reason_code, reason_text, status)
    VALUES (post_case_id, reporter_id_value, 'post', target_post_id,
            post_reason_codes[i]::report_reason_code_enum, post_reasons[i], 'pending');
    UPDATE public.post SET status = 'reported' WHERE post_id = target_post_id AND status = 'public';

    INSERT INTO public.report_case (target_type, target_id, status)
    VALUES ('comment', comment_id_value, 'pending')
    RETURNING case_id INTO comment_case_id;
    INSERT INTO public.report (case_id, reporter_id, target_type, target_id, reason_code, reason_text, status)
    VALUES (comment_case_id, reporter_id_value, 'comment', comment_id_value,
            comment_reason_codes[i]::report_reason_code_enum, comment_reasons[i], 'pending');
  END LOOP;

  RAISE NOTICE 'Đã chuẩn bị dữ liệu; kiểm tra kết quả COMMIT để xác nhận hoàn tất.';
END;
$moderation_queues$;

COMMIT;
