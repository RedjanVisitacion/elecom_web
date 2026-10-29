/* Run with node frontend/org_elecom/elecom_admin/tests/turnout.test.cjs. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const base = path.resolve(__dirname, '../admin_components/admin_js');
const dashboard = fs.readFileSync(path.join(base, 'admin_dashboard.js'), 'utf8');
const participationCode = dashboard.slice(dashboard.indexOf('  let turnoutHasTotals'), dashboard.indexOf('  let dashboardLoading'));
const insights = fs.readFileSync(path.join(base, 'dashboard_insights.js'), 'utf8');
function setup() {
  const elements = new Map();
  const element = id => {
    if (id === 'turnoutDataTable') return null;
    if (!elements.has(id)) elements.set(id, { hidden: true, textContent: '', style: { setProperty(key, value) { this[key] = value; } }, setAttribute(key, value) { this[key] = value; }, removeAttribute(key) { delete this[key]; } });
    return elements.get(id);
  };
  element('turnoutEmptyTitle').textContent = 'Loading hourly activity';
  const handlers = {};
  let chart;
  class Chart {
    constructor(canvas, config) { Object.assign(this, config); this.updateCount = 0; chart = this; }
    update() { this.updateCount++; }
    destroy() { this.destroyed = true; }
  }
  const window = { Chart, addEventListener(event, handler) { handlers[event] = handler; } };
  const context = vm.createContext({ window, Chart, document: { getElementById: element }, fmt: value => Number(value).toLocaleString('en-US'), setText: (el, value) => { if (el) el.textContent = value; } });
  vm.runInContext(participationCode + insights, context);
  return { element, handlers, window, context, get chart() { return chart; }, render: value => { context.metrics = value; return vm.runInContext('renderTurnout(metrics)', context); } };
}
const payload = hourly => ({ election: { status: 'Closed', start_at: '2026-10-29T08:00:00+08:00', end_at: '2026-10-29T17:00:00+08:00' }, turnout: { scope: 'historical', hourly } });
const hour = (count, extra = {}) => ({ hour: '2026-10-29T09:00:00+08:00', count, ...extra });
let tests = 0;
function test(name, fn) { fn(); tests++; console.log('PASS:', name); }
test('31 / 1643 formats to 1.9%, and updates both progress indicators', () => {
  const s = setup(); assert.equal(s.render({ total_cast_votes: 31, total_voters: 1643 }), true);
  assert.equal(s.element('turnoutPercent').textContent, '1.9%');
  assert.equal(s.element('turnoutSummary').textContent, '31 voted / 1,643 total voters');
  assert.equal(s.element('turnoutRingCount').textContent, '31');
  assert.equal(s.element('turnoutProgressFill').style.width, `${31 / 1643 * 100}%`);
  s.render({ total_cast_votes: 32, total_voters: 1643 }); assert.equal(s.element('turnoutRingCount').textContent, '32');
});
test('zero registered voters avoids division by zero', () => {
  const s = setup(); s.render({ total_cast_votes: 0, total_voters: 0 });
  assert.equal(s.element('turnoutPercent').textContent, '0.0%'); assert.equal(s.element('turnoutProgressFill').style.width, '0%');
});
test('missing totals are unknown, and failed refresh preserves last success', () => {
  const s = setup(); assert.equal(s.render(null), false); assert.equal(s.element('turnoutPercent').textContent, '—');
  s.render({ total_cast_votes: 31, total_voters: 1643 }); s.render(null); assert.equal(s.element('turnoutPercent').textContent, '1.9%');
});
test('missing hourly data keeps participation and an honest empty state', () => {
  const s = setup(); s.render({ total_cast_votes: 31, total_voters: 1643 }); s.handlers['elecom:dashboard']({ detail: { turnout: null } });
  assert.equal(s.element('turnoutPlot').hidden, true); assert.equal(s.element('turnoutEmpty').hidden, false);
  assert.match(s.element('turnoutEmptyTitle').textContent, /unavailable/); assert.equal(s.element('turnoutRingCount').textContent, '31');
});
test('genuine zero hours produce a real zero line', () => {
  const s = setup(); s.handlers['elecom:dashboard']({ detail: payload([hour(0)]) });
  assert.equal(s.element('turnoutPlot').hidden, false); assert.equal(s.chart.data.datasets[0].data[0], 0);
  assert.equal(s.element('turnoutActivityState').textContent, 'Zero votes reported');
});
test('withheld and unavailable counts stay gaps beside real observations', () => {
  const s = setup(); s.handlers['elecom:dashboard']({ detail: payload([hour(null, { withheld: true }), hour(7), hour(null)]) });
  assert.equal(JSON.stringify(s.chart.data.datasets[0].data), '[null,7,null]'); assert.equal(s.chart.data.datasets[0].spanGaps, false);
});
test('fully withheld hours never become a fabricated line', () => {
  const s = setup(); s.handlers['elecom:dashboard']({ detail: payload([hour(null, { withheld: true })]) });
  assert.equal(s.element('turnoutPlot').hidden, true); assert.match(s.element('turnoutEmptyTitle').textContent, /protected/);
});
test('closed election activity is constrained to its schedule', () => {
  const s = setup(); s.handlers['elecom:dashboard']({ detail: payload([hour(5), { hour: '2026-10-30T08:00:00+08:00', count: 12 }]) });
  assert.equal(JSON.stringify(s.chart.data.datasets[0].data), '[5]'); assert.match(s.element('turnoutLineCaption').textContent, /Historical/);
});
test('initial API error removes the indefinite loading message', () => {
  const s = setup(); s.handlers['elecom:dashboard-error'](); assert.match(s.element('turnoutEmptyTitle').textContent, /could not load/);
});
test('missing chart library reports unavailable instead of zero activity', () => {
  const s = setup(); s.window.Chart = null; s.handlers['elecom:dashboard']({ detail: payload([hour(0)]) });
  assert.equal(s.element('turnoutPlot').hidden, true); assert.equal(s.element('turnoutEmptyTitle').textContent, 'Chart could not load');
});
console.log(`${tests} turnout tests passed.`);
