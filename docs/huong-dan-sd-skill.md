Cơ chế nạp skill của Copilot (4 đường):
1. Instructions — .github/copilot-instructions.md: auto cho MỌI câu hỏi, cả nhóm (đã có ✓)
2. Prompt files — .github/prompts/*.prompt.md: tạo file lệnh tái sử dụng, gõ /tên trong chat:
---
agent: 'agent'
description: 'Dựng UI theo UI kit của nhóm'
---
Dựng giao diện: ${input:mota}
Tuân thủ #file:docs/skill-ai-gen-code.md + #file:docs/skill-ui-kit.md.
BẮT BUỘC: liệt kê component sẽ dùng TRƯỚC khi code; KHÔNG tự tạo component mới; thiếu thì hỏi lại.
3. Agent Skills — .github/skills/<tên>/SKILL.md: Copilot tự nạp khi thấy liên quan (đúng nghĩa "skill" của VS Code mới; nhiều tool khác đọc AGENTS.md)
4. Thủ công — gõ #file:docs/skill-ui-kit.md hoặc #folder:client/src/components ngay trong câu hỏi

Câu lệnh mẫu để "bắt chọn đúng component" (dán thẳng vào Copilot Chat):
Dựng trang Hồ sơ người dùng theo #file:docs/skill-ui-kit.md + #file:docs/skill-ai-gen-code.md. Đọc danh mục, LIỆT KÊ component sẽ dùng trước khi code (ghi rõ lý do), trả lời đủ 📁→🧩→💻→✅. Không tự chế component — thiếu thì hỏi lại.

Và khi nhận kết quả, soi 2 điểm: (1) nó có ghi rõ component nào không (vd "xác nhận xoá → ConfirmDialog"); (2) có em nào tự chế không → nhắc "dùng lại từ kit, không tự tạo" là nó sửa ngay. Bộ kit JSDoc rất kỹ nên nếu AI đọc file thật thì props khớp 100%.
