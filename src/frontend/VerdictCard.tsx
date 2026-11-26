import React, { useState } from 'react';
import { Box, Button, Inline, Link, Lozenge, SectionMessage, Stack, Text, Textfield, User, xcss } from '@forge/react';
import type { DecisionPeople } from '../graph/service';
import type { AnnotatedVerdict, ResolutionKind } from '../resolve/resolutions';
import { call } from './invokeResult';

const quoteStyle = xcss({
  borderLeftWidth: 'border.width.selected',
  borderLeftStyle: 'solid',
  borderLeftColor: 'color.border',
  paddingInlineStart: 'space.100',
});

type Props = {
  verdict: AnnotatedVerdict;
  draftUrl?: string;
  isBusy: boolean;
  onResolve: (kind: ResolutionKind, note?: string) => void;
};

function ResolvedNote({ verdict, draftUrl }: { verdict: AnnotatedVerdict; draftUrl?: string }) {
  const r = verdict.resolution;
  if (!r) return null;
  const when = new Date(r.at).toLocaleDateString();
  return (
    <Inline space="space.050" alignBlock="center" shouldWrap>
      <Text size="small">{r.kind === 'Acknowledge' ? 'Acknowledged by' : 'Supersession proposed by'}</Text>
      <User accountId={r.accountId} />
      <Text size="small">on {when}.</Text>
      {draftUrl && (
        <Link href={draftUrl} openNewTab>
          Open the draft decision
        </Link>
      )}
    </Inline>
  );
}

/** Optional Teamwork Graph enrichment: contributors to the Decision page and their teams. */
function WhoKnows({ pageId }: { pageId: string }) {
  const [people, setPeople] = useState<DecisionPeople | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLoad = async () => {
    setIsLoading(true);
    try {
      setPeople(await call<DecisionPeople>('getDecisionPeople', { pageId }));
    } catch (e: unknown) {
      setPeople({ status: 'unavailable', reason: e instanceof Error ? e.message : 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!people) {
    return (
      <Button appearance="subtle" spacing="compact" isDisabled={isLoading} onClick={handleLoad}>
        {isLoading ? 'Asking Teamwork Graph…' : 'Who knows about this?'}
      </Button>
    );
  }
  if (people.status !== 'ok') {
    return (
      <Text size="small" color="color.text.subtlest">
        {people.status === 'empty' ? 'Teamwork Graph has no contributors for this decision yet.' : 'Teamwork Graph is not available on this site.'}
      </Text>
    );
  }
  return (
    <Stack space="space.050">
      <Text size="small" color="color.text.subtle">People who shaped this decision (Teamwork Graph):</Text>
      {people.people.map((p) => (
        <Inline key={p.accountId} space="space.050" alignBlock="center" shouldWrap>
          <User accountId={p.accountId} />
          {p.teams.length > 0 && <Text size="small">· {p.teams.map((t) => t.displayName).join(', ')}</Text>}
        </Inline>
      ))}
    </Stack>
  );
}

function ResolutionControls({ isBusy, onResolve }: Pick<Props, 'isBusy' | 'onResolve'>) {
  const [isDismissing, setIsDismissing] = useState(false);
  const [reason, setReason] = useState('');

  if (isDismissing) {
    return (
      <Stack space="space.100">
        <Textfield
          placeholder="Why isn't this a conflict?"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <Inline space="space.100">
          <Button appearance="primary" isDisabled={isBusy || !reason.trim()} onClick={() => onResolve('Dismiss', reason)}>
            Dismiss
          </Button>
          <Button onClick={() => setIsDismissing(false)}>Cancel</Button>
        </Inline>
      </Stack>
    );
  }

  return (
    <Inline space="space.100" shouldWrap>
      <Button appearance="primary" isDisabled={isBusy} onClick={() => onResolve('Acknowledge')}>
        Acknowledge
      </Button>
      <Button isDisabled={isBusy} onClick={() => onResolve('Supersede')}>
        Propose superseding
      </Button>
      <Button appearance="subtle" isDisabled={isBusy} onClick={() => setIsDismissing(true)}>
        Not a conflict
      </Button>
    </Inline>
  );
}

const decisionHref = (verdict: AnnotatedVerdict): string =>
  verdict.url ?? `/wiki/pages/viewpage.action?pageId=${verdict.pageId}`;

/**
 * A Lapsed Verdict (GLOSSARY.md): its Decision is no longer a Precedent. Shown
 * quietly and never resolvable; a Supersede recorded on it reads as the success
 * it was, since that Supersession is what made the Verdict lapse.
 */
function LapsedCard({ verdict }: { verdict: AnnotatedVerdict }) {
  const lapse = verdict.lapsed;
  const why =
    lapse?.reason === 'Superseded'
      ? lapse.supersededBy
        ? `This decision was superseded by “${lapse.supersededBy}”.`
        : 'This decision was superseded.'
      : 'This decision is no longer an accepted decision.';
  const r = verdict.resolution;
  return (
    <Stack space="space.050">
      <Inline space="space.100" alignBlock="center" shouldWrap>
        <Lozenge>No longer accepted</Lozenge>
        <Link href={decisionHref(verdict)} openNewTab>
          {verdict.title}
        </Link>
      </Inline>
      <Text size="small" color="color.text.subtle">
        {why}
      </Text>
      {r?.kind === 'Supersede' && lapse?.reason === 'Superseded' && (
        <Inline space="space.050" alignBlock="center" shouldWrap>
          <Text size="small">Superseded as proposed from this issue by</Text>
          <User accountId={r.accountId} />
          <Text size="small">on {new Date(r.at).toLocaleDateString()}.</Text>
        </Inline>
      )}
    </Stack>
  );
}

export function VerdictCard({ verdict, draftUrl, isBusy, onResolve }: Props) {
  if (verdict.lapsed) return <LapsedCard verdict={verdict} />;

  const isConflict = verdict.verdict === 'Conflicts';
  const isOpenConflict = isConflict && !verdict.resolution;
  const appearance = isOpenConflict ? 'error' : isConflict ? 'success' : 'information';
  const title = isOpenConflict
    ? 'Conflicts with an accepted decision'
    : isConflict
      ? 'Conflict resolved'
      : 'Related decision';

  return (
    <SectionMessage appearance={appearance} title={title}>
      <Stack space="space.100">
        <Link href={decisionHref(verdict)} openNewTab>
          {verdict.title}
        </Link>
        <Box xcss={quoteStyle}>
          <Text>“{verdict.citation}”</Text>
        </Box>
        {isOpenConflict && <Text>{verdict.explanation ?? verdict.reason}</Text>}
        {!isConflict && <Text>{verdict.reason}</Text>}
        <Text size="small" color="color.text.subtle">
          Decided {verdict.decidedOn} by {verdict.deciders.join(', ')}
        </Text>
        {verdict.isEdited && (
          <Text size="small" color="color.text.warning">
            This decision was edited since the last check. Use “Check again” to re-check against its current wording.
          </Text>
        )}
        <ResolvedNote verdict={verdict} draftUrl={draftUrl} />
        <WhoKnows pageId={verdict.pageId} />
        {isOpenConflict && <ResolutionControls isBusy={isBusy} onResolve={onResolve} />}
      </Stack>
    </SectionMessage>
  );
}
