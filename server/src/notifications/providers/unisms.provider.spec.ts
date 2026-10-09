import { ConfigService } from '@nestjs/config';
import { UniSmsProvider } from './unisms.provider';
import { SmsProviderError } from './sms-provider';

describe('UniSmsProvider', () => {
  const values: Record<string, string> = {
    SMS_ENABLED: 'true',
    UNISMS_API_SECRET: 'test-secret-never-live',
    UNISMS_SENDER_ID: 'DCLA',
    UNISMS_BASE_URL: 'https://example.invalid/api',
    SMS_REQUEST_TIMEOUT_MS: '1000',
  };
  const config = {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
  const provider = new UniSmsProvider(config);
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  const response = (status: number, body: unknown) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });

  it('uses the documented Basic Auth and single-SMS payload', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        message: { reference_id: 'msg_test', status: 'sent' },
      }),
    });

    await expect(
      provider.send({
        recipient: '+639171234567',
        content: 'Test only',
        notificationId: 'notification-id',
        idempotencyKey: 'loan:loan-id:created',
      }),
    ).resolves.toEqual({
      providerMessageId: 'msg_test',
      status: 'sent',
      failureReason: null,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.invalid/api/sms',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from('test-secret-never-live:').toString('base64')}`,
        }),
      }),
    );
    const request = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(JSON.parse(request.body)).toMatchObject({
      recipient: '+639171234567',
      content: 'Test only',
      sender_id: 'DCLA',
    });
  });

  it.each([1847, 0])(
    'retrieves and preserves the account credit balance %s',
    async (credits) => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(response(200, { sms_credits: credits }));

      await expect(provider.getCredits()).resolves.toEqual({ credits });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.invalid/api/account',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Basic ${Buffer.from('test-secret-never-live:').toString('base64')}`,
          }),
        }),
      );
    },
  );

  it.each([
    ['missing', {}],
    ['null', { sms_credits: null }],
    ['string', { sms_credits: '1847' }],
    ['negative', { sms_credits: -1 }],
    ['fractional', { sms_credits: 1.5 }],
    ['NaN', { sms_credits: Number.NaN }],
    ['infinite', { sms_credits: Number.POSITIVE_INFINITY }],
    ['unsafe', { sms_credits: Number.MAX_SAFE_INTEGER + 1 }],
  ])('rejects a malformed %s account credit value', async (_label, body) => {
    global.fetch = jest.fn().mockResolvedValue(response(200, body));

    await expect(provider.getCredits()).rejects.toMatchObject({
      code: 'UNISMS_INVALID_ACCOUNT_RESPONSE',
      message: 'UniSMS returned an invalid account response.',
      retryable: false,
    } satisfies Partial<SmsProviderError>);
  });

  it.each([
    [401, 'UNISMS_AUTHENTICATION_FAILED'],
    [403, 'UNISMS_AUTHENTICATION_FAILED'],
    [503, 'UNISMS_UNAVAILABLE'],
  ])('sanitizes account lookup HTTP %s failures', async (status, code) => {
    global.fetch = jest.fn().mockResolvedValue(
      response(status, {
        error: {
          message:
            'Provider detail containing test-secret-never-live and Basic dGVzdC1zZWNyZXQtbmV2ZXItbGl2ZTo=',
        },
      }),
    );

    const error = await provider.getCredits().catch((value) => value);
    expect(error).toMatchObject({ code });
    expect(error.message).not.toContain('test-secret-never-live');
    expect(error.message).not.toContain('dGVzdC1zZWNyZXQ');
  });

  it('maps an account network failure to a safe provider error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('private DNS detail'));

    await expect(provider.getCredits()).rejects.toMatchObject({
      code: 'UNISMS_NETWORK_ERROR',
      message: 'UniSMS could not be reached.',
      retryable: true,
    } satisfies Partial<SmsProviderError>);
  });

  it('times out an unresponsive account request', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn(
      (_input, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }),
    ) as jest.MockedFunction<typeof fetch>;

    const expectation = expect(provider.getCredits()).rejects.toMatchObject({
      code: 'UNISMS_TIMEOUT',
      message: 'UniSMS request timed out.',
      retryable: true,
    } satisfies Partial<SmsProviderError>);
    await jest.advanceTimersByTimeAsync(1000);

    await expectation;
  });

  it('maps an authentication response to a permanent provider error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    });
    await expect(provider.getStatus('msg_test')).rejects.toMatchObject({
      code: 'UNISMS_AUTHENTICATION_FAILED',
      retryable: false,
    } satisfies Partial<SmsProviderError>);
  });

  it.each(['sent', 'pending', 'retrying', 'failed'] as const)(
    'maps the recognized provider status %s exactly',
    async (status) => {
      global.fetch = jest.fn().mockResolvedValue(
        response(200, {
          message: {
            reference_id: 'msg_test',
            status,
            fail_reason: status === 'failed' ? 'Delivery failed' : null,
          },
        }),
      );

      await expect(provider.getStatus('msg_test')).resolves.toEqual({
        providerMessageId: 'msg_test',
        status,
        failureReason: status === 'failed' ? 'Delivery failed' : null,
      });
    },
  );

  it.each([
    ['unknown', { message: { reference_id: 'msg_test', status: 'delivered' } }],
    ['missing', { message: { reference_id: 'msg_test' } }],
  ])('does not treat a %s provider status as sent', async (_label, body) => {
    global.fetch = jest.fn().mockResolvedValue(response(200, body));

    await expect(provider.getStatus('msg_test')).rejects.toMatchObject({
      code: 'UNISMS_UNKNOWN_STATUS',
      retryable: true,
    } satisfies Partial<SmsProviderError>);
  });

  it('rejects a malformed successful provider response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('malformed JSON');
      },
    });

    await expect(provider.getStatus('msg_test')).rejects.toMatchObject({
      code: 'UNISMS_INVALID_RESPONSE',
      retryable: true,
    } satisfies Partial<SmsProviderError>);
  });

  it.each([400, 422])(
    'retains bounded and sanitized diagnostics for HTTP %s',
    async (status) => {
      global.fetch = jest.fn().mockResolvedValue(
        response(status, {
          error: {
            code: 'invalid_content',
            message:
              'Unsupported content for +639171234567 using test-secret-never-live\nBasic dGVzdC1zZWNyZXQtbmV2ZXItbGl2ZTo=',
          },
        }),
      );

      const error = await provider
        .getStatus('msg_test')
        .catch((value) => value);
      expect(error).toMatchObject({
        code: 'UNISMS_REQUEST_REJECTED:INVALID_CONTENT',
        retryable: false,
      });
      expect(error.message).toContain(`HTTP ${status}`);
      expect(error.message).toContain('Unsupported content');
      expect(error.message).toContain('[REDACTED_RECIPIENT]');
      expect(error.message).not.toContain('test-secret-never-live');
      expect(error.message).not.toContain('dGVzdC1zZWNyZXQ');
      expect(error.message.length).toBeLessThanOrEqual(500);
    },
  );

  it.each([
    [429, 'UNISMS_RATE_LIMITED'],
    [503, 'UNISMS_UNAVAILABLE'],
  ])('maps HTTP %s to a retryable diagnostic error', async (status, code) => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(response(status, { message: 'Try again later' }));

    const error = await provider.getStatus('msg_test').catch((value) => value);
    expect(error).toMatchObject({ code, retryable: true });
    expect(error.message).toContain(`HTTP ${status}`);
    expect(error.message).toContain('Try again later');
  });

  it('retains the HTTP status when the provider error body is malformed', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => {
        throw new SyntaxError('malformed JSON');
      },
    });

    const error = await provider.getStatus('msg_test').catch((value) => value);
    expect(error).toMatchObject({
      code: 'UNISMS_REQUEST_REJECTED',
      retryable: false,
    });
    expect(error.message).toContain('HTTP 422');
  });

  it('maps a network failure to a retryable provider error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    await expect(provider.getStatus('msg_test')).rejects.toMatchObject({
      code: 'UNISMS_NETWORK_ERROR',
      retryable: true,
    } satisfies Partial<SmsProviderError>);
  });
});
