import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';

import { getAvailablePort } from './port.ts';

test('getAvailablePort selects the next free port when the preferred port is busy', async () => {
  const preferredPort = 40200 + Math.floor(Math.random() * 1000);
  const occupiedServer = net.createServer();

  await new Promise<void>((resolve) => {
    occupiedServer.listen(preferredPort, '127.0.0.1', () => resolve());
  });

  const port = await getAvailablePort(preferredPort);

  assert.notEqual(port, preferredPort);
  assert.ok(port >= preferredPort);

  await new Promise<void>((resolve, reject) => {
    occupiedServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
});
