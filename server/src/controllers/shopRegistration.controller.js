// Tùng — Sprint 2: session là nguồn owner; controller không chứa SQL.
const { createShopRegistrationModel } = require('../models/shopRegistration.model');
const { handle, actorFrom } = require('../utils/shopWorkflow');
const model = createShopRegistrationModel();

module.exports = {
  getContext: handle(req => model.getContext(actorFrom(req))),
  prepareImageUpload: handle(req => model.prepareImageUpload(actorFrom(req))),
  markReviewNotificationSeen: handle(req => model.markReviewNotificationSeen(req.params.notificationId, actorFrom(req))),
  register: handle(req => model.register(req.body, actorFrom(req)), 201),
  resubmit: handle(req => model.resubmit(req.body, actorFrom(req))),
};
