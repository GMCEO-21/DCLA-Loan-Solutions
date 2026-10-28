import { createCorsOptions, shouldTrustPlatformProxy } from './http.config';

function evaluateOrigin(
  configuredOrigin: string | undefined,
  requestOrigin: string,
  nodeEnv = 'production',
): Promise<boolean> {
  const options = createCorsOptions({
    NODE_ENV: nodeEnv,
    CLIENT_URL: configuredOrigin,
  });

  return new Promise((resolve, reject) => {
    if (typeof options.origin !== 'function') {
      reject(new Error('Expected a CORS origin callback.'));
      return;
    }
    options.origin(requestOrigin, (error, allowed) => {
      if (error) reject(error);
      else resolve(Boolean(allowed));
    });
  });
}

describe('HTTP configuration', () => {
  it('allows a configured production origin', async () => {
    await expect(
      evaluateOrigin('https://app.example.com', 'https://app.example.com'),
    ).resolves.toBe(true);
  });

  it('rejects an unapproved production origin', async () => {
    await expect(
      evaluateOrigin('https://app.example.com', 'https://random.example.com'),
    ).rejects.toThrow('not allowed by CORS');
  });

  it('retains explicit localhost origins in development', async () => {
    await expect(
      evaluateOrigin(undefined, 'http://localhost:5173', 'development'),
    ).resolves.toBe(true);
  });

  it('trusts one platform proxy hop only in production', () => {
    expect(shouldTrustPlatformProxy({ NODE_ENV: 'production' })).toBe(true);
    expect(shouldTrustPlatformProxy({ NODE_ENV: 'development' })).toBe(false);
  });
});
