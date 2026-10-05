import net from 'node:net';

function isPortTaken(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net.createServer();

    tester.once('error', (error: NodeJS.ErrnoException) => {
      resolve(error.code === 'EADDRINUSE' || error.code === 'EACCES');
    });

    tester.once('listening', () => {
      tester.close(() => resolve(false));
    });

    tester.listen(port, host);
  });
}

export async function getAvailablePort(preferredPort: number, host = '0.0.0.0'): Promise<number> {
  let port = preferredPort;
  const maxAttempts = 20;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const taken = await isPortTaken(port, host);
    if (!taken) {
      return port;
    }
    port += 1;
  }

  throw new Error(`No available port found starting from ${preferredPort}`);
}
