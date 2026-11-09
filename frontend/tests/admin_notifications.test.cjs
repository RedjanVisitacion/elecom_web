const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const store = new Map(), handlers = {}, notices = [];
const context = {
  window: { ElecomToast: { show: (...args) => notices.push(args) } },
  localStorage: { getItem: key => store.get(key) ?? null, setItem: (key,value) => store.set(key,value) },
  document: { addEventListener: (name,fn) => { handlers[name]=fn; }, getElementById: () => null, dispatchEvent: () => {} },
  fetch: async () => ({ ok:true, json:async () => ({ok:true,account:'admin',configured:false}) }),
  Event: class Event {}, console,
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../org_elecom/elecom_admin/admin_components/admin_js/admin_notifications.js'),'utf8'), context);
(async () => {
  const notifications = context.window.ElecomAdminNotifications;
  await notifications.init();
  notifications.receive([{id:'existing'}]);
  assert.equal(notices.length,0,'First load must not replay existing alerts');
  notifications.receive([{id:'existing'},{id:'fresh',title:'New filing',body:'Review documents'}]);
  assert.equal(notices.length,1);
  notifications.receive([{id:'fresh'}]);
  assert.equal(notices.length,1,'Polling must not repeat an alert');
  handlers.change({target:{id:'adminInAppAlerts',checked:false}});
  notifications.receive([{id:'another',title:'Quiet'}]);
  assert.equal(notices.length,1,'In-app preference must suppress toasts');
  console.log('Browser notification tests passed: baseline, new alert, deduplication, preference.');
})();
