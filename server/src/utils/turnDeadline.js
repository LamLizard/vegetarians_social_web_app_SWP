// Khoi's code (07/11/2026): tách mốc hạn của lượt chat để test được — 20s tới chữ đầu tiên,
// 45s tổng khi câu trả lời đã bắt đầu stream (người dùng đã thấy nội dung).
const FIRST_TEXT_MS = 20000;
const STREAM_TOTAL_MS = 45000;
const TURN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createTurnDeadline({ firstTextMs = FIRST_TEXT_MS, totalMs = STREAM_TOTAL_MS, now = () => Date.now() } = {}) {
  return function turnDeadline(req, res, next) {
    const controller = new AbortController();
    const startedAt = now();
    req.turnSignal = controller.signal;
    req.turnDeadlineAt = startedAt + firstTextMs;
    let timer = null;
    let closed = false;
    const expire = () => {
      controller.abort();
      if (res.destroyed || res.writableEnded) return;
      const turnId = typeof req.body?.turnId === 'string' && TURN_ID.test(req.body.turnId)
        ? req.body.turnId : undefined;
      if (!res.headersSent) {
        return res.status(503).json({ code: req.admissionStarted ? 'OUTCOME_UNKNOWN' : 'DEADLINE_EXCEEDED',
          message: 'Hết thời gian chờ. Trạng thái lượt có thể chưa rõ.',
          ...(!req.admissionStarted ? { admitted: false } : {}), ...(turnId ? { turnId } : {}) });
      }
      if (turnId) res.write(`event: error\ndata: ${JSON.stringify({ turnId, code: 'DEADLINE_EXCEEDED', message: 'Hết thời gian chờ.', partial: true })}\n\n`);
      return res.end();
    };
    const schedule = (ms) => {
      clearTimeout(timer);
      timer = setTimeout(expire, Math.max(0, startedAt + ms - now()));
    };
    // Khoi's code (07/11/2026): controller gọi khi byte chữ đầu tiên đã tới client.
    req.extendTurnDeadline = () => {
      if (closed || req.turnDeadlineAt > startedAt + firstTextMs) return;
      req.turnDeadlineAt = startedAt + totalMs;
      schedule(totalMs);
    };
    schedule(firstTextMs);
    const finish = () => { closed = true; clearTimeout(timer); controller.abort(); };
    res.once('finish', finish);
    res.once('close', finish);
    return next();
  };
}

module.exports = { createTurnDeadline, FIRST_TEXT_MS, STREAM_TOTAL_MS };
