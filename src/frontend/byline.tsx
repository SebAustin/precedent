import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Heading, Link, Lozenge, SectionMessage, Spinner, Stack, Text } from '@forge/react';
import type { IssueReference } from '../byline/references';
import type { BylineState } from '../byline/service';
import { call } from './invokeResult';

type LozengeAppearance = 'removed' | 'success' | 'moved' | 'default' | 'inprogress';

function ReferenceList({ title, refs, appearance }: { title: string; refs: readonly IssueReference[]; appearance: LozengeAppearance }) {
  if (refs.length === 0) return null;
  return (
    <Stack space="space.050">
      <Heading size="xsmall">{title}</Heading>
      {refs.map((r) => (
        <Text key={r.key}>
          <Lozenge appearance={appearance}>{r.key}</Lozenge> <Link href={`/browse/${r.key}`} openNewTab>{r.summary}</Link>
        </Text>
      ))}
    </Stack>
  );
}

const App = () => {
  const [state, setState] = useState<BylineState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    call<BylineState>('getByline').then(setState, (e: Error) => setError(e.message));
  }, []);

  if (error) {
    return (
      <SectionMessage appearance="warning" title="Precedent couldn't load references">
        <Text>{error}</Text>
      </SectionMessage>
    );
  }
  if (!state) return <Spinner label="Loading references" />;
  if (!state.isDecision) {
    return <Text>This page isn't a Decision. Label a page "decision" and add a Status table to track it with Precedent.</Text>;
  }

  const g = state.groups;
  const total = g ? g.open.length + g.acknowledged.length + g.superseding.length + g.dismissed.length + g.related.length : 0;
  if (!g || total === 0) return <Text>No Jira issues have been checked against this decision yet.</Text>;

  return (
    <Stack space="space.200">
      <ReferenceList title="Open conflicts" refs={g.open} appearance="removed" />
      <ReferenceList title="Proposed superseding this decision" refs={g.superseding} appearance="moved" />
      <ReferenceList title="Acknowledged (work respects the decision)" refs={g.acknowledged} appearance="success" />
      <ReferenceList title="Dismissed as not a conflict" refs={g.dismissed} appearance="default" />
      <ReferenceList title="Related work" refs={g.related} appearance="inprogress" />
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
