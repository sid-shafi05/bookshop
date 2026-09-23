function isOrderFullyReturned(totalItems, returnedItems) {
  const total = Number(totalItems || 0);
  const returned = Number(returnedItems || 0);
  return total > 0 && returned >= total;
}

function hasActiveOrderReturn(requests = []) {
  if (!Array.isArray(requests)) return false;
  return requests.some((request) => ['requested', 'approved', 'processed'].includes(request?.status));
}

module.exports = {
  isOrderFullyReturned,
  hasActiveOrderReturn,
};
