import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Button, Inline, Lozenge, SectionMessage, Spinner, Stack, Text } from '@forge/react';
import type { ResolutionKind, ResolutionView } from '../resolve/resolutions';
import { rovo, view } from '@forge/bridge';
import { call } from './invokeResult';
import { VerdictCard } from './VerdictCard';

/** Headline lozenge. Counts come from the Resolution module; the panel never recomputes them. */
function Summary({ view }: { view: ResolutionView }) {
  const { open, resolved, related, dismissed } = view.counts;

  if (open > 0) {
    return (
      <Lozenge appearance="removed" isBold>
        {`${open} conflict${open > 1 ? 's' : ''} with past decisions`}
      </Lozenge>
    );
  }
  if (resolved > 0) return <Lozenge appearance="success">All conflicts resolved</Lozenge>;
  if (related > 0) return <Lozenge appearance="inprogress">{`${related} related decision${related > 1 ? 's' : ''}`}</Lozenge>;
  if (dismissed > 0) return <Lozenge appearance="success">No open conflicts</Lozenge>;
  return <Lozenge appearance="success">No precedent found</Lozenge>;
}

const App = () => {
  const [state, setState] = useState<ResolutionView | undefined>(undefined);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    call<ResolutionView>('getPanel').then(setState, (e: Error) => setError(e.message));
  }, []);

  const run = async (work: () => Promise<ResolutionView>, failure: string) => {
    setIsBusy(true);
    setError(null);
    try {
      setState(await work());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : failure);
    } finally {
      setIsBusy(false);
    }
  };

  const handleCheck = () => run(() => call<ResolutionView>('checkNow'), 'Check failed');

  /** Opens the Precedent Rovo agent in the chat sidebar, primed with this issue. */
  const handleAsk = async () => {
    try {
      const context = await view.getContext();
      const issueKey = (context.extension as { issue?: { key?: string } }).issue?.key ?? 'this issue';
      await rovo.open({
        type: 'forge',
        agentKey: 'precedent-agent',
        agentName: 'Precedent',
        prompt: `Explain the precedent check for ${issueKey} and what I should do about it.`,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Rovo is not available on this site');
    }
  };
  const handleResolve = (pageId: string) => (kind: ResolutionKind, note?: string) =>
    run(() => call<ResolutionView>('resolveConflict', { kind, pageId, note }), 'Could not save your response');

  if (state === undefined && !error) return <Spinner label="Loading Precedent" />;

  const isChecked = state?.isChecked ?? false;
  return (
    <Stack space="space.200">
      {state && isChecked ? <Summary view={state} /> : <Text>This issue hasn't been checked yet.</Text>}
      {error && (
        <SectionMessage appearance="warning" title="Precedent couldn't complete that">
          <Text>{error}</Text>
        </SectionMessage>
      )}
      {state?.verdicts.map((v) => (
        <VerdictCard
          key={v.pageId}
          verdict={v}
          draftUrl={state.drafts[v.pageId]}
          isBusy={isBusy}
          onResolve={handleResolve(v.pageId)}
        />
      ))}
      {state && state.counts.hidden > 0 && (
        <Text size="small" color="color.text.subtlest">
          {/* Neutral on purpose: a hidden Decision may be a Conflict (and still count in the
              sidebar lozenge), so don't call it "related". */}
          {`${state.counts.hidden} matching decision${state.counts.hidden > 1 ? 's are' : ' is'} in a space you can't access`}
        </Text>
      )}
      {state && state.counts.dismissed > 0 && (
        <Text size="small" color="color.text.subtlest">
          {`${state.counts.dismissed} dismissed conflict${state.counts.dismissed > 1 ? 's' : ''} hidden`}
        </Text>
      )}
      <Inline space="space.100" alignBlock="center">
        <Button onClick={handleCheck} isDisabled={isBusy}>
          {isBusy ? 'Working…' : isChecked ? 'Check again' : 'Check now'}
        </Button>
        <Button appearance="subtle" onClick={handleAsk}>
          Ask Precedent
        </Button>
        {state?.checkedAt && (
          <Text size="small" color="color.text.subtlest">
            Checked {new Date(state.checkedAt).toLocaleString()}
          </Text>
        )}
      </Inline>
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
