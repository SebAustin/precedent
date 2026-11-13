import React, { useState } from 'react';
import { Button, DynamicTable, Heading, Inline, Lozenge, ProgressBar, SectionMessage, Stack, Text } from '@forge/react';
import type { ProposalEvalResult } from '../check/sampleEval';
import { call } from './invokeResult';

type Props = { isEnabled: boolean };

const HEAD = {
  cells: [
    { key: 'result', content: 'Result' },
    { key: 'proposal', content: 'Proposal' },
    { key: 'verdicts', content: 'Verdicts' },
    { key: 'issues', content: 'Mismatch' },
  ],
};

function verdictSummary(r: ProposalEvalResult): string {
  return r.verdicts.length === 0 ? 'None' : r.verdicts.map((v) => `${v.verdict}: ${v.title}`).join(' · ');
}

function toRow(r: ProposalEvalResult) {
  return {
    key: r.proposalKey,
    cells: [
      { key: 'result', content: <Lozenge appearance={r.passed ? 'success' : 'removed'}>{r.passed ? 'Pass' : 'Fail'}</Lozenge> },
      { key: 'proposal', content: `${r.issueKey ?? '—'} ${r.summary}` },
      { key: 'verdicts', content: verdictSummary(r) },
      { key: 'issues', content: [...r.missing.map((m) => `missing ${m}`), ...r.unexpected.map((u) => `unexpected ${u}`)].join('; ') },
    ],
  };
}

/** Runs the real Verdict pipeline over the Sample Workspace and scores it. */
export function EvalSection({ isEnabled }: Props) {
  const [results, setResults] = useState<ProposalEvalResult[]>([]);
  const [total, setTotal] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setIsRunning(true);
    setError(null);
    setResults([]);
    try {
      const keys = await call<string[]>('listEvalProposals');
      setTotal(keys.length);
      const collected: ProposalEvalResult[] = [];
      for (const proposalKey of keys) {
        collected.push(await call<ProposalEvalResult>('evalSampleProposal', { proposalKey }));
        setResults([...collected]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Evaluation failed');
    } finally {
      setIsRunning(false);
    }
  };

  const passed = results.filter((r) => r.passed).length;

  return (
    <Stack space="space.150">
      <Heading size="small">Verdict evaluation</Heading>
      <Text>
        Re-checks every sample Proposal with the live pipeline (Forge LLM) and compares the Verdicts with the expected
        ones. Each run costs a few cents of LLM usage.
      </Text>
      <Inline space="space.100" alignBlock="center">
        <Button onClick={handleRun} isDisabled={!isEnabled || isRunning}>
          {isRunning ? 'Evaluating…' : 'Run evaluation'}
        </Button>
        {results.length > 0 && (
          <Lozenge appearance={passed === results.length ? 'success' : 'moved'} isBold>
            {`${passed} / ${results.length} passed`}
          </Lozenge>
        )}
      </Inline>
      {isRunning && total > 0 && <ProgressBar value={results.length / total} />}
      {error && (
        <SectionMessage appearance="error" title="Evaluation stopped">
          <Text>{error}</Text>
        </SectionMessage>
      )}
      {results.length > 0 && <DynamicTable head={HEAD} rows={results.map(toRow)} />}
    </Stack>
  );
}
