const test = require('node:test');
const assert = require('node:assert/strict');
const { isOrderFullyReturned, hasActiveOrderReturn } = require('../utils/returnState');

test('full return is recognized when every order item is approved or processed', () => {
  assert.equal(isOrderFullyReturned(3, 3), true);
  assert.equal(isOrderFullyReturned(3, 2), false);
});

test('an order with any active return request blocks new return requests', () => {
  assert.equal(hasActiveOrderReturn([{ status: 'requested' }]), true);
  assert.equal(hasActiveOrderReturn([{ status: 'approved' }]), true);
  assert.equal(hasActiveOrderReturn([{ status: 'rejected' }]), false);
  assert.equal(hasActiveOrderReturn([]), false);
});
