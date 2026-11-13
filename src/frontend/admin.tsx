import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Button,
  Heading,
  Inline,
  Lozenge,
  ProgressBar,
  SectionMessage,
  Stack,
  Text,
} from '@forge/react';
import type { WorkspaceStatus, WorkspaceSummary } from '../sample/plan';
import { EvalSection } from './EvalSection';
import { call } from './invokeResult';

type Phase = 'idle' | 'seeding' | 'confirmRemove' | 'removing';

const STATUS_LABEL: Record<WorkspaceStatus, { text: string; appearance: 'default' | 'inprogress' | 'success' | 'removed' }> = {
  empty: { text: 'Not loaded', appearance: 'default' },
  partial: { text: 'Partially loaded', appearance: 'inprogress' },
  complete: { text: 'Loaded', appearance: 'success' },
  blocked: { text: 'Blocked', appearance: 'removed' },
};

const App = () => {
  const [summary, setSummary] = useState<WorkspaceSummary | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    call<WorkspaceSummary>('getSampleWorkspace').then(setSummary, (e: Error) => setError(e.message));
  }, []);

  const handleLoad = async () => {
    setPhase('seeding');
    setError(null);
    try {
      let current = await call<WorkspaceSummary>('seedSampleStep');
      setSummary(current);
      while (current.status === 'partial' || current.status === 'empty') {
        const before = current.created;
        current = await call<WorkspaceSummary>('seedSampleStep');
        setSummary(current);
        if (current.created === before) throw new Error('Seeding made no progress; check the app logs.');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Seeding failed');
    } finally {
      setPhase('idle');
    }
  };

  const handleRemove = async () => {
    setPhase('removing');
    setError(null);
    try {
      setSummary(await call<WorkspaceSummary>('removeSampleWorkspace'));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Removal failed');
    } finally {
      setPhase('idle');
    }
  };

  const isBusy = phase === 'seeding' || phase === 'removing';
  const label = summary ? STATUS_LABEL[summary.status] : null;

  return (
    <Stack space="space.200">
      <Heading size="medium">Sample Workspace</Heading>
      <Text>
        Creates "Lumen Pay", a fictional fintech team: a Confluence space of 7 Decisions and a Jira project of 10
        Proposals, so you can try Precedent on an empty site. Both are created as you and can be removed here.
      </Text>

      {summary && label && (
        <Inline space="space.100" alignBlock="center">
          <Lozenge appearance={label.appearance}>{label.text}</Lozenge>
          <Text>
            {summary.created} of {summary.total} items
          </Text>
        </Inline>
      )}
      {summary && phase === 'seeding' && <ProgressBar value={summary.created / summary.total} />}

      {summary?.status === 'blocked' && (
        <SectionMessage appearance="warning" title="Sample Workspace can't be loaded">
          <Text>{summary.reason}</Text>
        </SectionMessage>
      )}
      {error && (
        <SectionMessage appearance="error" title="Something went wrong">
          <Text>{error}</Text>
        </SectionMessage>
      )}

      {phase === 'confirmRemove' ? (
        <SectionMessage appearance="warning" title="Remove the Sample Workspace?">
          <Stack space="space.100">
            <Text>The LUMENPAY Jira project and Confluence space move to the trash.</Text>
            <Inline space="space.100">
              <Button appearance="danger" onClick={handleRemove}>
                Remove
              </Button>
              <Button onClick={() => setPhase('idle')}>Cancel</Button>
            </Inline>
          </Stack>
        </SectionMessage>
      ) : (
        <Inline space="space.100">
          <Button
            appearance="primary"
            isDisabled={isBusy || !summary || summary.status === 'complete' || summary.status === 'blocked'}
            onClick={handleLoad}
          >
            {phase === 'seeding' ? 'Loading…' : 'Load sample workspace'}
          </Button>
          <Button
            isDisabled={isBusy || !summary || summary.status === 'empty' || summary.status === 'blocked'}
            onClick={() => setPhase('confirmRemove')}
          >
            {phase === 'removing' ? 'Removing…' : 'Remove'}
          </Button>
        </Inline>
      )}

      <EvalSection isEnabled={summary?.status === 'complete'} />
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
