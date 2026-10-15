const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../org_elecom/elecom_admin/admin_components/admin_js/elecom_reports.js'), 'utf8');
function functionSource(name, nextName) {
  const start = source.search(new RegExp(`  (?:async )?function ${name}\\(`));
  const endOffset = source.slice(start).search(new RegExp(`  (?:async )?function ${nextName}\\(`));
  const end = start + endOffset;
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end);
}

function harness() {
  const tables = new Map();
  let saved = false;
  class Pdf {
    internal = {pageSize: {getWidth: () => 297, getHeight: () => 210}};
    getNumberOfPages() {return 1;}
    setPage() {}
    save() {saved = true;}
  }
  const context = vm.createContext({
    window: {jspdf: {jsPDF: Pdf}},
    mergeDuplicateCandidates: value => value,
    sortByReportOrder: value => value,
    rankedCandidates: value => [...value].sort((a,b) => b.votes - a.votes),
    sortOrgEntries: value => value,
    sortPositionEntries: value => value,
    orgDisplayName: value => value,
    candidateName: value => value.name || 'Candidate',
    candidateStatus: () => 'Ranked',
    reportScopeLabel: () => 'Test Election',
    formatDate: String,
    formatDateTime: () => '2026-10-15',
    loadPdfImageDataUrl: async () => '',
    drawPdfHeader() {}, drawPdfText() {},
    drawPdfTable(doc, title, columns, rows, y) {tables.set(title, rows); return y + 20;},
  });
  vm.runInContext([
    functionSource('pct', 'showAlert'),
    functionSource('enrichReport', 'barRows'),
    functionSource('exportStructuredPdfReport', 'renderPdfPageToCanvas'),
  ].join('\n'), context);
  return {context, tables, saved: () => saved};
}

const candidate = {name: 'Test Candidate', organization: 'USG', position: 'President', votes: 30};
const sample = {
  totals: {total_votes: 31, distinct_voters: 31, total_voters: 1643},
  by_org: {USG: 256, SITE: 176, PAFE: 5, AFPROTECHS: 20},
  by_pos: {President: 119, 'Vice President': 60, 'General Secretary': 59,
    'Associate Secretary': 60, Treasurer: 51, Auditor: 41, PIO: 29,
    'BSIT Representative': 8, 'BTLED Representative': 1, 'BFPT Representative': 29},
  candidates: [candidate],
};

test('PDF group shares use the attached report selection totals, leaving candidates unchanged', async () => {
  const h = harness();
  const enriched = h.context.enrichReport(sample);
  assert.equal(enriched.totalOrgVotes, 457);
  assert.equal(enriched.totalPositionVotes, 457);
  await h.context.exportStructuredPdfReport(sample, 'regression');
  assert.equal(h.saved(), true);
  assert.equal(h.tables.get('Organization Results')[0].share, '56%');
  assert.equal(h.tables.get('Position Results')[0].share, '26%');
  assert.equal(h.tables.get('Candidate Results')[0].pct, '96.8%');
  for (const title of ['Organization Results', 'Position Results']) {
    const percentages = h.tables.get(title).map(row => parseFloat(row.share));
    assert.ok(percentages.every(value => value >= 0 && value <= 100));
    assert.ok(Math.abs(percentages.reduce((a,b) => a+b, 0) - 100) <= 0.5);
  }
});

test('organization and position totals remain independent and accept numeric strings', async () => {
  const h = harness();
  await h.context.exportStructuredPdfReport({...sample, by_org: {A: '3', B: '1'}, by_pos: {X: '8', Y: '2'}}, 'test');
  assert.equal(h.tables.get('Organization Results')[0].share, '75%');
  assert.equal(h.tables.get('Position Results')[0].share, '80%');
});

test('zero and absent grouped totals do not produce NaN or Infinity', async () => {
  const h = harness();
  await h.context.exportStructuredPdfReport({...sample, by_org: {A: 0}, by_pos: {X: 0}}, 'zero');
  assert.equal(h.tables.get('Organization Results')[0].share, '0%');
  assert.equal(h.tables.get('Position Results')[0].share, '0%');
  const empty = h.context.enrichReport({totals: {}, candidates: []});
  assert.equal(empty.totalOrgVotes, 0);
  assert.equal(empty.totalPositionVotes, 0);
});

test('preview and text export use the same corrected grouped denominators', () => {
  assert.match(source, /simpleRows\(orgEntries, enriched\.totalOrgVotes,/);
  assert.match(source, /simpleRows\(posEntries, enriched\.totalPositionVotes,/);
  const text = source.slice(source.indexOf("rows.push('ORGANIZATION RESULTS')"), source.indexOf("rows.push('CANDIDATE RESULTS')"));
  assert.match(text, /pct\(votes, enriched\.totalOrgVotes\)/);
  assert.match(text, /pct\(votes, enriched\.totalPositionVotes\)/);
  assert.doesNotMatch(text, /pct\(votes, enriched\.totalVotes\)/);
});
