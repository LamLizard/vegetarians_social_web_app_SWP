// Tùng — Sprint 2: Admin từ session, submissionId từ URL và expectedSubmissionId từ form.
const { createShopVerificationModel } = require('../models/shopVerification.model');
const { handle, actorFrom } = require('../utils/shopWorkflow');
const model = createShopVerificationModel();

module.exports = {
  list: handle(req => model.list(req.query, actorFrom(req))),
  detail: handle(req => model.detail(req.params.submissionId, actorFrom(req))),
  decide: handle(req => model.decide(req.params.submissionId, req.body, actorFrom(req))),
};
