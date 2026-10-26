// Tùng: điều phối text Moderation, giữ controller post cũ để các route còn lại dùng nguyên trạng.
const model = require('../models/postContent.model');
const { PostError } = require('../models/post.model');
const { parsePostInput, PostInputError } = require('../utils/postInput');
const { parseId, parseRequestId, parseCommentInput, submissionFingerprint } = require('../utils/postContentInput');
const { POST_CLOUD_NAME } = require('../config/cloudinary');
const { youTubeRejectMessage } = require('../utils/youtubeCheck');
const { moderateText } = require('../utils/openaiModeration');
const { evaluateRules } = require('../utils/postContentRules');

function actorId(req) {
  if (!req.account?.id) throw new PostError(401, 'Vui lòng đăng nhập để gửi nội dung.');
  return String(req.account.id);
}

const handle = (fn) => async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  res.vary('Authorization');
  try {
    await fn(req, res);
  } catch (error) {
    if (error instanceof PostInputError) {
      return res.status(400).json({ code: 'INVALID_INPUT', message: error.message });
    }
    if (error instanceof PostError) {
      return res.status(error.status).json({ code: error.code, message: error.message });
    }
    // Không log raw SQL/provider response, nội dung người dùng hoặc secret.
    console.error('[postContent]', error.code || error.name || 'UNEXPECTED');
    return res.status(500).json({ message: 'Có lỗi xảy ra, vui lòng thử lại sau.' });
  }
};

async function createPost(req, res) {
  const authorId = actorId(req);
  const input = parsePostInput(req.body, { cloudName: POST_CLOUD_NAME });
  const requestId = parseRequestId(req.body?.requestId);
  const submission = { kind: 'post', actorId: authorId, requestId,
    fingerprint: submissionFingerprint('post', input), input };
  await model.precheck(submission);
  const previous = await model.findSubmission(submission);
  if (previous) return res.status(200).json(previous);
  if (input.youtubeUrl) {
    const rejected = await youTubeRejectMessage(input.youtubeUrl);
    if (rejected) throw new PostError(400, rejected);
  }
  const text = `${input.title}\n\n${input.content}`;
  const providerResult = await moderateText(text);
  const result = await evaluateRules({ kind: 'post', text, providerResult });
  const created = await model.createModeratedPost({ ...submission, result });
  return res.status(created.replayed ? 200 : 201).json(created);
}

async function addComment(req, res) {
  const authorId = actorId(req);
  const input = parseCommentInput(req.params.id, req.body);
  const submission = { kind: 'comment', actorId: authorId, requestId: input.requestId,
    fingerprint: submissionFingerprint('comment', input), input };
  await model.precheck(submission);
  const previous = await model.findSubmission(submission);
  if (previous) return res.status(200).json(previous);
  const providerResult = await moderateText(input.content);
  const result = await evaluateRules({ kind: 'comment', text: input.content, providerResult });
  const created = await model.createModeratedComment({ ...submission, result });
  return res.status(created.replayed ? 200 : 201).json(created);
}

async function getComments(req, res) {
  const postId = parseId(req.params.id, 'Mã bài viết');
  res.json(await model.findVisibleComments(postId, req.account?.id ?? null));
}

module.exports = { createPost: handle(createPost), addComment: handle(addComment), getComments: handle(getComments) };
