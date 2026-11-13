import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Box,
  Button,
  Inline,
  Link,
  Lozenge,
  SectionMessage,
  Spinner,
  Stack,
  Text,
  xcss,
} from '@forge/react';
import type { CheckResult, CitedVerdict } from '../check/types';
import { call } from './invokeResult';

const quoteStyle = xcss({
  borderLeftWidth: 'border.width.selected',
  borderLeftStyle: 'solid',
  borderLeftColor: 'color.border',
  paddingInlineStart: 'space.100',
});

function Summary({ result }: { result: CheckResult }) {
  const conflicts = result.verdicts.filter((v) => v.verdict === 'Conflicts').length;
  const related = result.verdicts.length - conflicts;

  if (conflicts > 0) {
    return <Lozenge appearance="removed" isBold>{`${conflicts} conflict${conflicts > 1 ? 's' : ''} with past decisions`}</Lozenge>;
  }
  if (related > 0) return <Lozenge appearance="inprogress">{`${related} related decision${related > 1 ? 's' : ''}`}</Lozenge>;
  return <Lozenge appearance="success">No precedent found</Lozenge>;
}

function VerdictCard({ verdict }: { verdict: CitedVerdict }) {
  const isConflict = verdict.verdict === 'Conflicts';
  const body = (
    <Stack space="space.100">
      <Link href={`/wiki/pages/viewpage.action?pageId=${verdict.pageId}`} openNewTab>
        {verdict.title}
      </Link>
      <Box xcss={quoteStyle}>
        <Text>“{verdict.citation}”</Text>
      </Box>
      <Text>{verdict.explanation ?? verdict.reason}</Text>
      <Text size="small" color="color.text.subtle">
        Decided {verdict.decidedOn} by {verdict.deciders.join(', ')}
      </Text>
    </Stack>
  );

  return isConflict ? (
    <SectionMessage appearance="error" title="Conflicts with an accepted decision">
      {body}
    </SectionMessage>
  ) : (
    <SectionMessage appearance="information" title="Related decision">
      {body}
    </SectionMessage>
  );
}

const App = () => {
  const [result, setResult] = useState<CheckResult | null | undefined>(undefined);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    call<CheckResult | null>('getCheck').then(setResult, (e: Error) => setError(e.message));
  }, []);

  const handleCheck = async () => {
    setIsChecking(true);
    setError(null);
    try {
      setResult(await call<CheckResult>('checkNow'));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Check failed');
    } finally {
      setIsChecking(false);
    }
  };

  if (result === undefined && !error) return <Spinner label="Loading Precedent" />;

  return (
    <Stack space="space.200">
      {result ? <Summary result={result} /> : <Text>This issue hasn't been checked yet.</Text>}
      {error && (
        <SectionMessage appearance="warning" title="Precedent couldn't check this issue">
          <Text>{error}</Text>
        </SectionMessage>
      )}
      {result?.verdicts.map((v) => <VerdictCard key={v.pageId} verdict={v} />)}
      <Inline space="space.100" alignBlock="center">
        <Button onClick={handleCheck} isDisabled={isChecking}>
          {isChecking ? 'Checking…' : result ? 'Check again' : 'Check now'}
        </Button>
        {result && (
          <Text size="small" color="color.text.subtlest">
            Checked {new Date(result.checkedAt).toLocaleString()}
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

