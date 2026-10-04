const test = require('node:test');
const assert = require('node:assert/strict');
const userModel = require('../models/user.model');
const healthProfileModel = require('../models/health-profile.model');

let profile = { id: '42', email: 'member@example.com', fullName: 'Member' };
let updates = [];

userModel.findProfileById = async (accountId) => ({ ...profile, id: accountId });
userModel.findPasswordHashById = async () => null;
userModel.updateProfile = async (accountId, values) => {
  updates.push({ accountId, values });
  return { ...profile, ...values, id: accountId };
};

let savedHealthProfile;
healthProfileModel.saveHealthProfile = async (...args) => {
  savedHealthProfile = args;
  return { consented: true, profile: { dateOfBirth: args[1].dateOfBirth } };
};
let grantedHealthConsent;
healthProfileModel.grantHealthConsent = async (...args) => {
  grantedHealthConsent = args;
  return { consented: true, profile: { id: '8' } };
};

const { saveMyProfile, acceptMyHealthConsent, saveMyHealthProfile } = require('./user.controller');

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
  savedHealthProfile = null;
  grantedHealthConsent = null;
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

test('requires explicit age-warning acknowledgement before saving a minor health profile', async () => {
  const res = createResponse();
  let forwardedError;

  await saveMyHealthProfile({
    account: { id: '42' },
    body: { dateOfBirth: '2010-01-01', consentAccepted: true },
  }, res, (error) => { forwardedError = error; });

  assert.equal(forwardedError, undefined);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /cần xác nhận thông báo chỉ số/);
  assert.equal(savedHealthProfile, null);
});

test('saves a minor health profile after the age-warning acknowledgement', async () => {
  const res = createResponse();
  let forwardedError;

  await saveMyHealthProfile({
    account: { id: '42' },
    body: {
      dateOfBirth: '2010-01-01',
      consentAccepted: true,
      ageWarningAccepted: true,
    },
  }, res, (error) => { forwardedError = error; });

  assert.equal(forwardedError, undefined);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.consented, true);
  assert.equal(savedHealthProfile[0], '42');
  assert.equal(savedHealthProfile[1].dateOfBirth, '2010-01-01');
});

test('does not record health consent when the explicit acknowledgement is missing', async () => {
  const res = createResponse();
  let forwardedError;

  await acceptMyHealthConsent({
    account: { id: '42' },
    body: {},
  }, res, (error) => { forwardedError = error; });

  assert.equal(forwardedError, undefined);
  assert.equal(res.statusCode, 400);
  assert.equal(grantedHealthConsent, null);
});

test('records explicit health consent before legacy profile access', async () => {
  const res = createResponse();
  let forwardedError;

  await acceptMyHealthConsent({
    account: { id: '42' },
    body: { consentAccepted: true },
  }, res, (error) => { forwardedError = error; });

  assert.equal(forwardedError, undefined);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.consented, true);
  assert.deepEqual(grantedHealthConsent[0], '42');
});
