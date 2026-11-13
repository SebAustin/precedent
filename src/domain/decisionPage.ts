/**
 * Converts a Decision to and from Confluence storage format.
 *
 * Layout: a page-properties ("details") macro holding a two-column table of
 * metadata, followed by "Decision" and "Rationale" h2 sections. Humans edit the
 * page normally in Confluence; Precedent parses it back. Parsing is tolerant of
 * the whitespace and <p> wrappers Confluence's editor adds.
 */
import { type Decision, type DecisionStatus, isDecisionStatus } from './decision';

export type ParseResult =
  | { readonly ok: true; readonly decision: Decision }
  | { readonly ok: false; readonly errors: readonly string[] };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const LIST_SEPARATOR = ', ';

const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ESCAPES[ch] ?? ch);
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/** Strips tags, decodes entities and collapses whitespace. */
function toPlainText(fragment: string): string {
  return decodeXml(fragment.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function splitList(text: string): string[] {
  return text
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function propertyRow(name: string, value: string): string {
  return `<tr><th>${name}</th><td>${escapeXml(value)}</td></tr>`;
}

export function renderDecisionPage(decision: Decision): string {
  const rows = [
    propertyRow('Status', decision.status),
    propertyRow('Decided on', decision.decidedOn),
    propertyRow('Deciders', decision.deciders.join(LIST_SEPARATOR)),
    propertyRow('Tags', decision.tags.join(LIST_SEPARATOR)),
    ...(decision.supersedes ? [propertyRow('Supersedes', decision.supersedes)] : []),
  ];

  return [
    '<ac:structured-macro ac:name="details" ac:schema-version="1"><ac:rich-text-body>',
    `<table><tbody>${rows.join('')}</tbody></table>`,
    '</ac:rich-text-body></ac:structured-macro>',
    `<h2>Decision</h2><p>${escapeXml(decision.statement)}</p>`,
    `<h2>Rationale</h2><p>${escapeXml(decision.rationale)}</p>`,
  ].join('');
}

/** Reads every <th>name</th><td>value</td> row into a name → plain-text map. */
function readProperties(body: string): ReadonlyMap<string, string> {
  const rowPattern = /<tr[^>]*>\s*<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/g;
  return new Map(
    [...body.matchAll(rowPattern)].map((m) => [toPlainText(m[1]), toPlainText(m[2])] as const)
  );
}

/** Returns the plain text between <h2>heading</h2> and the next <h2> (or end). */
function readSection(body: string, heading: string): string | undefined {
  const sections = body.split(/<h2[^>]*>/).slice(1);
  const match = sections.find((section) => {
    const [title] = section.split(/<\/h2>/);
    return toPlainText(title) === heading;
  });
  if (match === undefined) return undefined;
  const content = toPlainText(match.split(/<\/h2>/).slice(1).join(''));
  return content.length > 0 ? content : undefined;
}

export function parseDecisionPage(title: string, body: string): ParseResult {
  const props = readProperties(body);
  const errors: string[] = [];

  const status = props.get('Status');
  if (status === undefined) errors.push('Missing "Status" property');
  else if (!isDecisionStatus(status)) errors.push(`Unknown status "${status}"`);

  const decidedOn = props.get('Decided on');
  if (decidedOn === undefined) errors.push('Missing "Decided on" property');
  else if (!ISO_DATE.test(decidedOn)) {
    errors.push(`"Decided on" must be YYYY-MM-DD, got "${decidedOn}"`);
  }

  const statement = readSection(body, 'Decision');
  if (statement === undefined) errors.push('Missing "Decision" section');

  if (errors.length > 0 || status === undefined || !isDecisionStatus(status)) {
    return { ok: false, errors };
  }

  const supersedes = props.get('Supersedes');
  return {
    ok: true,
    decision: {
      title,
      statement: statement as string,
      rationale: readSection(body, 'Rationale') ?? '',
      deciders: splitList(props.get('Deciders') ?? ''),
      decidedOn: decidedOn as string,
      status,
      tags: splitList(props.get('Tags') ?? ''),
      ...(supersedes ? { supersedes } : {}),
    },
  };
}

/**
 * Returns the page body with only the Status cell changed, so everything else
 * a human wrote on the page is preserved.
 */
export function withStatus(body: string, status: DecisionStatus): string {
  const statusRow = /(<th[^>]*>\s*(?:<p[^>]*>)?\s*Status\s*(?:<\/p>)?\s*<\/th>\s*<td[^>]*>)[\s\S]*?(<\/td>)/;
  if (!statusRow.test(body)) throw new Error('Decision page has no Status property to change.');
  return body.replace(statusRow, `$1${escapeXml(status)}$2`);
}
