import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Text } from '@forge/react';
import { invoke } from '@forge/bridge';

const App = () => {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // invoke() may wrap the body with metadata; unwrap to the plain string.
    invoke<string>('getText').then((res) =>
      setMessage(typeof res === 'string' ? res : res.body)
    );
  }, []);

  return <Text>{message ?? 'Loading…'}</Text>;
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
