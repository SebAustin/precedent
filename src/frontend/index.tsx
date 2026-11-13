import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Button, Inline, Lozenge, SectionMessage, Spinner, Stack, Text } from '@forge/react';
import type { ResolutionKind } from '../resolve/resolutions';
import type { PanelState } from '../resolve/service';
import { rovo, view } from '@forge/bridge';
import { call } from './invokeResult';
import { VerdictCard } from './VerdictCard';

function Summary({ state }: { state: PanelState }) {
  const { openConflicts, verdicts } = state.view;
  const resolved = verdicts.filter((v) => v.verdict === 'Conflicts' && v.resolution).length;
  const related = verdicts.filter((v) => v.verdict === 'Related').length;

  if (openConflicts > 0) {
    return (
      <Lozenge appearance="removed" isBold>
        {`${openConflicts} conflict${openConflicts > 1 ? 's' : ''} with past decisions`}
      </Lozenge>
    );
  }
  if (resolved > 0) return <Lozenge appearance="success">All conflicts resolved</Lozenge>;
  if (related > 0) return <Lozenge appearance="inprogress">{`${related} related decision${related > 1 ? 's' : ''}`}</Lozenge>;
  if (state.view.dismissedCount > 0) return <Lozenge appearance="success">No open conflicts</Lozenge>;
  return <Lozenge appearance="success">No precedent found</Lozenge>;
}

const App = () => {
  const [state, setState] = useState<PanelState | undefined>(undefined);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    call<PanelState>('getPanel').then(setState, (e: Error) => setError(e.message));
  }, []);

  const run = async (work: () => Promise<PanelState>, failure: string) => {
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

  const handleCheck = () => run(() => call<PanelState>('checkNow'), 'Check failed');

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
    run(() => call<PanelState>('resolveConflict', { kind, pageId, note }), 'Could not save your response');

  if (state === undefined && !error) return <Spinner label="Loading Precedent" />;

  const check = state?.check;
  return (
    <Stack space="space.200">
      {state && check ? <Summary state={state} /> : <Text>This issue hasn't been checked yet.</Text>}
      {error && (
        <SectionMessage appearance="warning" title="Precedent couldn't complete that">
          <Text>{error}</Text>
        </SectionMessage>
      )}
      {state?.view.verdicts.map((v) => (
        <VerdictCard
          key={v.pageId}
          verdict={v}
          draftUrl={state.drafts[v.pageId]}
          isBusy={isBusy}
          onResolve={handleResolve(v.pageId)}
        />
      ))}
      {state && state.view.hiddenCount > 0 && (
        <Text size="small" color="color.text.subtlest">
          {`${state.view.hiddenCount} related decision${state.view.hiddenCount > 1 ? 's are' : ' is'} in a space you can't access`}
        </Text>
      )}
      {state && state.view.dismissedCount > 0 && (
        <Text size="small" color="color.text.subtlest">
          {`${state.view.dismissedCount} dismissed conflict${state.view.dismissedCount > 1 ? 's' : ''} hidden`}
        </Text>
      )}
      <Inline space="space.100" alignBlock="center">
        <Button onClick={handleCheck} isDisabled={isBusy}>
          {isBusy ? 'Working…' : check ? 'Check again' : 'Check now'}
        </Button>
        <Button appearance="subtle" onClick={handleAsk}>
          Ask Precedent
        </Button>
        {check && (
          <Text size="small" color="color.text.subtlest">
            Checked {new Date(check.checkedAt).toLocaleString()}
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
