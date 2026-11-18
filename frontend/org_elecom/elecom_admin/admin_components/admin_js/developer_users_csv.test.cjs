const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

async function scenario(failAt) {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, { textContent: '', style: {}, disabled: false, hidden: false, events: {}, classList: { add() {}, remove() {} }, addEventListener(name, callback) { this.events[name] = callback; }, setAttribute() {}, querySelectorAll() { return []; } });
    return elements.get(id);
  }
  const offsets = [], updates = [];
  const progress = element('developerUsersCsvProgressBar');
  progress.setAttribute = (name, value) => { if (name === 'aria-valuenow') updates.push(value); };
  const context = {
    document: { getElementById: element },
    bootstrap: { Modal: class { show() {} hide() {} } },
    window: { addEventListener() {} },
    FormData: class { constructor() { this.data = {}; } append(key, value) { this.data[key] = value; } },
    fetch: async (url, options) => {
      let result;
      if (url.includes('?page=1')) result = { ok: true, csrf_token: 'token' };
      else if (options.body.data.preview === '1') result = { ok: true, total: 620, created: 620, updated: 0, file_digest: 'digest', batch_size: 250 };
      else {
        const offset = Number(options.body.data.offset);
        offsets.push(offset);
        if (offset === failAt) throw new Error('Connection interrupted');
        const count = Math.min(250, 620 - offset);
        result = { ok: true, total: 620, processed: offset + count, created: count, updated: 0 };
      }
      return { ok: true, json: async () => result };
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'developer_users_csv.js'), 'utf8'), context);
  element('developerUsersCsvFile').files = [{}];
  await element('developerUsersCsvFile').events.change();
  assert.match(element('developerUsersCsvSummary').textContent, /620 accounts/);
  await element('developerUsersCsvCommit').events.click();
  assert.equal(element('developerUsersCsvImport').disabled, false);
  if (failAt === undefined) {
    assert.deepEqual(offsets, [0, 250, 500]);
    assert.deepEqual(updates, ['0', '40', '81', '100']);
    assert.match(element('developerUsersCsvError').textContent, /620 of 620 saved/);
  } else {
    assert.deepEqual(offsets, [0, 250]);
    assert.match(element('developerUsersCsvError').textContent, /250 of 620 accounts were confirmed saved/);
    assert.match(element('developerUsersCsvError').textContent, /last batch may also have saved/);
  }
}
(async () => { await scenario(); await scenario(250); console.log('CSV progress and partial failure checks passed.'); })().catch(error => { console.error(error); process.exitCode = 1; });
