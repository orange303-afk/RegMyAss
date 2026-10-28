import 'fake-indexeddb/auto';

// Global mock for chrome APIs in tests
if (typeof globalThis.chrome === 'undefined') {
  const listeners: Record<string, Function[]> = {};

  (globalThis as any).chrome = {
    runtime: {
      sendMessage: vi.fn().mockResolvedValue({}),
      onMessage: {
        addListener: vi.fn((cb) => {
          listeners['onMessage'] = listeners['onMessage'] || [];
          listeners['onMessage'].push(cb);
        }),
        removeListener: vi.fn(),
      },
      getURL: vi.fn((path: string) => `chrome-extension://mock-id/${path}`),
      lastError: null,
    },
    tabs: {
      query: vi.fn().mockResolvedValue([{ id: 1, url: 'https://example.com' }]),
      create: vi.fn().mockResolvedValue({ id: 2 }),
      update: vi.fn().mockResolvedValue({ id: 1 }),
      sendMessage: vi.fn().mockResolvedValue({}),
      onUpdated: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockResolvedValue(undefined),
      },
      sync: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
      },
    },
    alarms: {
      create: vi.fn(),
      clear: vi.fn(),
      onAlarm: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    notifications: {
      create: vi.fn().mockResolvedValue('notif-1'),
    },
  };
}
