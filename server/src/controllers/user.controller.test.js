const test = require('node:test');
const assert = require('node:assert/strict');
const userModel = require('../models/user.model');

let profile = { id: '42', email: 'member@example.com', fullName: 'Member' };
let updates = [];

userModel.findProfileById = async (accountId) => ({ ...profile, id: accountId });
userModel.findPasswordHashById = async () => null;
userModel.updateProfile = async (accountId, values) => {
  updates.push({ accountId, values });
  return { ...profile, ...values, id: accountId };
};

const { saveMyProfile } = require('./user.controller');

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test.beforeEach(() => {
  profile = { id: '42', email: 'member@example.com', fullName: 'Member' };
  updates = [];
});

test('rejects a changed email in a direct profile API request', async () => {
  const res = createResponse();
  let forwardedError;

  await saveMyProfile({
    account: { id: '42' },
    body: { fullName: 'Member Name', email: 'another@example.com' },
  }, res, (error) => { forwardedError = error; });

  assert.equal(forwardedError, undefined);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, 'Email đăng nhập không thể thay đổi sau khi tạo tài khoản.');
  assert.equal(updates.length, 0);
});

test('preserves the email when a legacy client resubmits the unchanged value', async () => {
  const res = createResponse();
  let forwardedError;

  await saveMyProfile({
    account: { id: '42' },
    body: { fullName: 'Member Name', email: ' MEMBER@example.com ' },
  }, res, (error) => { forwardedError = error; });

  assert.equal(forwardedError, undefined);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.email, 'member@example.com');
  assert.deepEqual(updates, [{
    accountId: '42',
    values: { fullName: 'Member Name', passwordHash: null },
  }]);
});
