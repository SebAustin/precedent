import { describe, expect, test } from 'vitest';
import { adfToText, contentHash, proposalText } from './proposal';

describe('adfToText', () => {
  test('joins text from nested ADF paragraphs', () => {
    const adf = {
      type: 'doc',
      version: 1,
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Store events' }, { type: 'text', text: ' in Mongo.' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Fast' }] }] }] },
      ],
    };

    expect(adfToText(adf)).toBe('Store events in Mongo.\nFast');
  });

  test('returns empty text for missing or malformed descriptions', () => {
    expect(adfToText(null)).toBe('');
    expect(adfToText('plain string')).toBe('plain string');
    expect(adfToText({ type: 'doc' })).toBe('');
  });
});

describe('contentHash', () => {
  const proposal = { issueKey: 'LP-1', summary: 'Use Mongo', description: 'For ledger events' };

  test('is stable for identical text', () => {
    expect(contentHash(proposal)).toBe(contentHash({ ...proposal }));
  });

  test('changes when the summary or description changes', () => {
    expect(contentHash(proposal)).not.toBe(contentHash({ ...proposal, description: 'For audit logs' }));
  });

  test('ignores the issue key and surrounding whitespace', () => {
    expect(contentHash(proposal)).toBe(contentHash({ ...proposal, issueKey: 'LP-2', summary: ' Use Mongo  ' }));
  });
});

describe('proposalText', () => {
  test('combines summary and description', () => {
    expect(proposalText({ issueKey: 'X', summary: 'S', description: 'D' })).toBe('S\n\nD');
  });
});
