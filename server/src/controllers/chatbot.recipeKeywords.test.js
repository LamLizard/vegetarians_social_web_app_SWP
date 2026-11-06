// Khoi's code (06/11/2026): test chọn từ khoá tìm công thức — không lấy từ xưng hô/đệm làm từ khoá món.
const test = require('node:test');
const assert = require('node:assert/strict');
const { plain } = require('../models/chatContext.model');
const { recipeKeywords } = require('./chatbot.controller');

const folds = (terms) => terms.map(plain);

test('"chỉ tao làm nấm kho nước dừa": bỏ "chi"/"tao", ưu tiên cụm 2 từ', () => {
  const terms = recipeKeywords({ subject: null, nearTerms: [] }, 'chỉ tao làm nấm kho nước dừa');
  const folded = folds(terms);
  assert.equal(folded.includes('chi'), false);
  assert.equal(folded.includes('tao'), false);
  assert.ok(folded.includes('nuoc dua'), folded.join(' | '));
  assert.ok(folded.includes('nam'), folded.join(' | '));
  assert.ok(terms.length <= 6);
});

test('cụm món của classifier đứng đầu, sau đó tới cụm 2 từ rồi từ đơn', () => {
  const terms = recipeKeywords({ subject: 'nấm kho nước dừa', nearTerms: [] }, 'chỉ tao làm nấm kho nước dừa');
  assert.equal(terms[0], 'nấm kho nước dừa');
  assert.equal(plain(terms[1]), 'nam kho');
  assert.equal(terms.length, 6);
});

test('câu khác: giữ cụm "canh chua"/"nấm rơm", bỏ "dạy"/"mình"/"với"', () => {
  const folded = folds(recipeKeywords({ subject: null, nearTerms: [] }, 'dạy mình nấu canh chua chay với nấm rơm'));
  assert.ok(folded.includes('canh chua'), folded.join(' | '));
  assert.ok(folded.includes('nam rom'), folded.join(' | '));
  for (const stop of ['day', 'minh', 'voi', 'nau', 'chay']) assert.equal(folded.includes(stop), false, stop);
});

test('từ đệm không lọt vào, danh sách không trùng và tối đa 6 term', () => {
  const terms = recipeKeywords({ subject: null, nearTerms: [] }, 'chỉ tao bày mình làm món nấm kho nước dừa ngon');
  const folded = folds(terms);
  assert.ok(terms.length <= 6);
  assert.equal(folded.includes('bay'), false);
  assert.equal(new Set(folded).size, folded.length);
});

// Khoi's code (06/11/2026): tên món có từ 2 chữ cái; nửa còn lại không đứng riêng (tránh "tiếu" ↔ "Tiêu đen").
test('"hủ tiếu chay ăn với gì ngon" → chỉ còn cụm "hủ tiếu"', () => {
  assert.deepEqual(folds(recipeKeywords({ subject: null, nearTerms: [] }, 'hủ tiếu chay ăn với gì ngon')), ['hu tieu']);
});

test('"mì xào" và "cá kho" là cụm; từ đơn ≥ 3 chữ cái khác vẫn giữ', () => {
  const folded = folds(recipeKeywords({ subject: null, nearTerms: [] }, 'cách làm mì xào chay với nấm rơm'));
  assert.ok(folded.includes('mi xao'), folded.join(' | '));
  assert.equal(folded.includes('xao'), false);
  assert.ok(folded.includes('nam rom') && folded.includes('nam'), folded.join(' | '));
});

// Khoi's code (06/11/2026): có cookDish thì chỉ lấy từ khoá từ tên món ("định" từng khớp nhầm "Men dinh dưỡng").
test('cookDish "chè bưởi": bỏ phần khẩu phần/định lượng của câu', () => {
  const terms = recipeKeywords({ cookDish: 'chè bưởi', subject: null, nearTerms: [] },
    'chè bưởi cho 1 nhà 6 ng ăn thì định lượng bao nhiêu, làm ntn ?');
  assert.deepEqual(folds(terms), ['che buoi', 'che', 'buoi']);
});

test('không có cookDish: "định lượng"/"ntn" không thành từ khoá', () => {
  const folded = folds(recipeKeywords({ subject: null, nearTerms: [] }, 'định lượng đậu hũ cho 6 người ntn'));
  for (const stop of ['dinh', 'luong', 'dinh luong', 'ntn']) assert.equal(folded.includes(stop), false, stop);
  assert.ok(folded.includes('dau hu'), folded.join(' | '));
});
