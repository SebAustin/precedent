import { describe, expect, test } from 'vitest';
import type { Decision } from './decision';
import { parseDecisionPage, renderDecisionPage, withStatus } from './decisionPage';

const mongoDecision: Decision = {
  title: 'Postgres for all transactional data',
  statement: 'We will not adopt MongoDB; Postgres stores all transactional data.',
  rationale: 'Ledger correctness needs multi-row transactions & strict schemas.',
  deciders: ['Priya Nair', 'Tom Becker'],
  decidedOn: '2026-03-04',
  status: 'Accepted',
  tags: ['database', 'storage'],
};

describe('renderDecisionPage', () => {
  test('wraps the fields in a page-properties (details) macro', () => {
    const body = renderDecisionPage(mongoDecision);

    expect(body).toContain('<ac:structured-macro ac:name="details"');
    expect(body).toContain('<th>Status</th><td>Accepted</td>');
    expect(body).toContain('<th>Decided on</th><td>2026-03-04</td>');
  });

  test('escapes XML-significant characters in user text', () => {
    const body = renderDecisionPage({ ...mongoDecision, statement: 'a < b & "c"' });

    expect(body).toContain('a &lt; b &amp; &quot;c&quot;');
    expect(body).not.toContain('a < b');
  });

  test('omits the Supersedes row when the Decision supersedes nothing', () => {
    expect(renderDecisionPage(mongoDecision)).not.toContain('Supersedes');
  });
});

describe('parseDecisionPage', () => {
  test('round-trips every field through render and parse', () => {
    const withSupersedes: Decision = { ...mongoDecision, supersedes: 'Old choice' };

    const result = parseDecisionPage(withSupersedes.title, renderDecisionPage(withSupersedes));

    expect(result).toEqual({ ok: true, decision: withSupersedes });
  });

  test('tolerates whitespace and paragraph-wrapped cells that Confluence adds', () => {
    const body = `
      <ac:structured-macro ac:name="details" ac:schema-version="1"><ac:rich-text-body>
      <table><tbody>
        <tr><th><p>Status</p></th><td><p> Accepted </p></td></tr>
        <tr><th>Decided on</th><td>2026-03-04</td></tr>
        <tr><th>Deciders</th><td>Priya Nair</td></tr>
        <tr><th>Tags</th><td></td></tr>
      </tbody></table></ac:rich-text-body></ac:structured-macro>
      <h2>Decision</h2>
      <p>Use Postgres.</p>
      <h2>Rationale</h2>
      <p>Transactions.</p>`;

    const result = parseDecisionPage('T', body);

    expect(result).toEqual({
      ok: true,
      decision: {
        title: 'T',
        statement: 'Use Postgres.',
        rationale: 'Transactions.',
        deciders: ['Priya Nair'],
        decidedOn: '2026-03-04',
        status: 'Accepted',
        tags: [],
      },
    });
  });

  test('parses the storage body exactly as Confluence returns it after save', () => {
    // Captured from the dev site: Confluence adds ac:macro-id to the details macro.
    const stored =
      '<ac:structured-macro ac:name="details" ac:schema-version="1" ac:macro-id="4cb4a184-9502-465f-a8e6-4b27586d06f6"><ac:rich-text-body><table><tbody><tr><th>Status</th><td>Superseded</td></tr><tr><th>Decided on</th><td>2024-06-18</td></tr><tr><th>Deciders</th><td>Tom Becker</td></tr><tr><th>Tags</th><td>architecture, services</td></tr></tbody></table></ac:rich-text-body></ac:structured-macro><h2>Decision</h2><p>New capabilities are built as modules inside the core monolith rather than as separate services.</p><h2>Rationale</h2><p>With six engineers, operating more services cost more than it saved.</p>';

    const result = parseDecisionPage('New capabilities start inside the core monolith', stored);

    expect(result.ok && result.decision.status).toBe('Superseded');
    expect(result.ok && result.decision.tags).toEqual(['architecture', 'services']);
  });

  test('rejects an unknown status', () => {
    const body = renderDecisionPage(mongoDecision).replace('<td>Accepted</td>', '<td>Rejected</td>');

    const result = parseDecisionPage(mongoDecision.title, body);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors).toContain('Unknown status "Rejected"');
  });

  test('reports every missing required field', () => {
    const result = parseDecisionPage('T', '<p>Just prose, no properties.</p>');

    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors).toEqual([
      'Missing "Status" property',
      'Missing "Decided on" property',
      'Missing "Decision" section',
    ]);
  });

  test('rejects a malformed date', () => {
    const body = renderDecisionPage({ ...mongoDecision, decidedOn: 'March 4th' });

    const result = parseDecisionPage(mongoDecision.title, body);

    expect(!result.ok && result.errors).toContain('"Decided on" must be YYYY-MM-DD, got "March 4th"');
  });

  test('decodes entities back to plain text', () => {
    const body = renderDecisionPage({ ...mongoDecision, rationale: 'R&D <fast>' });

    const result = parseDecisionPage(mongoDecision.title, body);

    expect(result.ok && result.decision.rationale).toBe('R&D <fast>');
  });
});

describe('withStatus', () => {
  test('changes only the Status cell and keeps human-added content', () => {
    const body = `${renderDecisionPage(mongoDecision)}<h2>Discussion</h2><p>Notes added by a human.</p>`;

    const updated = withStatus(body, 'Superseded');

    expect(parseDecisionPage(mongoDecision.title, updated)).toEqual({
      ok: true,
      decision: { ...mongoDecision, status: 'Superseded' },
    });
    expect(updated).toContain('<p>Notes added by a human.</p>');
  });

  test('handles paragraph-wrapped cells written by the Confluence editor', () => {
    const body = '<table><tbody><tr><th><p>Status</p></th><td><p>Accepted</p></td></tr></tbody></table>';

    expect(withStatus(body, 'Superseded')).toBe(
      '<table><tbody><tr><th><p>Status</p></th><td>Superseded</td></tr></tbody></table>'
    );
  });

  test('handles cells rewritten by the Confluence editor with local-id attributes', () => {
    // Captured from the dev site after a human edited the page in the editor.
    const body =
      '<table data-layout="default" ac:local-id="d9ec87c95243"><tbody><tr ac:local-id="4802c2a0bbea"><th ac:local-id="89d5dd67cef0"><p local-id="6dedaf1cf39d">Status</p></th><td ac:local-id="cca8767bb798"><p local-id="eb8ffd8226fa">Accepted</p></td></tr></tbody></table>';

    const updated = withStatus(body, 'Superseded');

    expect(updated).toContain('<td ac:local-id="cca8767bb798">Superseded</td>');
    expect(updated).toContain('<p local-id="6dedaf1cf39d">Status</p>');
  });

  test('throws when the page has no Status property to change', () => {
    expect(() => withStatus('<p>No table</p>', 'Superseded')).toThrow('no Status property');
  });
});
