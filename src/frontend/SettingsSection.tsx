import React, { useEffect, useState } from 'react';
import { Button, Checkbox, Heading, Inline, SectionMessage, Spinner, Stack, Text } from '@forge/react';
import type { DecisionSpaceSettings } from '../settings/store';
import { call } from './invokeResult';

/** Lets an admin choose which Confluence spaces are Decision Spaces. */
export function SettingsSection() {
  const [settings, setSettings] = useState<DecisionSpaceSettings | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    call<DecisionSpaceSettings>('getDecisionSpaceSettings').then(
      (s) => {
        setSettings(s);
        setSelected([...s.selected]);
      },
      (e: Error) => setMessage({ ok: false, text: e.message })
    );
  }, []);

  const toggle = (key: string) =>
    setSelected((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]));

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const saved = await call<DecisionSpaceSettings>('saveDecisionSpaces', { spaceKeys: selected });
      setSettings(saved);
      setSelected([...saved.selected]);
      setMessage({ ok: true, text: 'Decision Spaces saved. New checks use them right away.' });
    } catch (e: unknown) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Saving failed' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Stack space="space.150">
      <Heading size="small">Decision Spaces</Heading>
      <Text>
        Precedent only reads Decisions (pages labelled "decision") from the Confluence spaces you choose here. People
        only ever see Decisions they are allowed to read.
      </Text>
      {!settings && !message && <Spinner label="Loading spaces" />}
      {settings?.isDefault && (
        <Text size="small" color="color.text.subtle">
          Not configured yet — using the Sample Workspace space.
        </Text>
      )}
      {settings && (
        <Stack space="space.050">
          {settings.available.map((space) => (
            <Checkbox
              key={space.key}
              label={`${space.name} (${space.key})`}
              isChecked={selected.includes(space.key)}
              onChange={() => toggle(space.key)}
            />
          ))}
        </Stack>
      )}
      {message && (
        <SectionMessage appearance={message.ok ? 'success' : 'error'}>
          <Text>{message.text}</Text>
        </SectionMessage>
      )}
      <Inline space="space.100">
        <Button appearance="primary" onClick={handleSave} isDisabled={!settings || isSaving || selected.length === 0}>
          {isSaving ? 'Saving…' : 'Save Decision Spaces'}
        </Button>
      </Inline>
    </Stack>
  );
}
