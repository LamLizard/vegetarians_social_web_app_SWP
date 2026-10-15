// Tùng — Sprint 2: management chỉ thao tác Shop/menu của actor đã xác thực.
const { createShopManagementModel } = require('../models/shopManagement.model');
const { handle, actorFrom } = require('../utils/shopWorkflow');
const model = createShopManagementModel();

module.exports = {
  getMine: handle(req => model.getMine(actorFrom(req))),
  requestIdentity: handle(req => model.requestIdentity(req.body, actorFrom(req))),
  updateSchedule: handle(req => model.updateSchedule(req.body, actorFrom(req))),
  listMenu: handle(req => model.listMenu(actorFrom(req))),
  addMenu: handle(req => model.addMenu(req.body, actorFrom(req)), 201),
  updateMenu: handle(req => model.updateMenu(req.params.shopDishId, req.body, actorFrom(req))),
  removeMenu: handle(req => model.removeMenu(req.params.shopDishId, req.body, actorFrom(req))),
  listDishes: handle(req => model.listDishes(req.query, actorFrom(req))),
  prepareMenuImageUpload: handle(req => model.prepareMenuImageUpload(actorFrom(req))),
};
