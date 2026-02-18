const mockApiInstance = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
};

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(() => mockApiInstance),
  },
}));

jest.mock('js-cookie', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    remove: jest.fn(),
  },
}));

function loadApiModule() {
  let moduleRef: any;
  jest.isolateModules(() => {
    moduleRef = require('./api');
  });
  return moduleRef;
}

describe('api subsystem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('serializes selected ids for getBatch endpoint', async () => {
    mockApiInstance.get.mockResolvedValue({ data: [] });
    const { stockAPI } = loadApiModule();

    await stockAPI.getBatch([1, 5, 8], 3);

    expect(mockApiInstance.get).toHaveBeenCalledWith('/stocks/batch', {
      params: { ids: '1,5,8', portfolio_id: 3 },
    });
  });

  it('caches portfolio summary responses by key', async () => {
    mockApiInstance.get.mockResolvedValue({
      data: { summary: {}, stocks: [] },
    });
    const { portfolioAPI } = loadApiModule();

    await portfolioAPI.getSummary();
    await portfolioAPI.getSummary();

    expect(mockApiInstance.get).toHaveBeenCalledTimes(1);
  });

  it('invalidates cached portfolio summary when requested', async () => {
    mockApiInstance.get.mockResolvedValue({
      data: { summary: {}, stocks: [] },
    });
    const { portfolioAPI, invalidateCache } = loadApiModule();

    await portfolioAPI.getSummary();
    invalidateCache('portfolio');
    await portfolioAPI.getSummary();

    expect(mockApiInstance.get).toHaveBeenCalledTimes(2);
  });

  it('operationsAPI.create calls POST /operations with body and optional portfolio_id', async () => {
    mockApiInstance.post.mockResolvedValue({
      data: { id: 1, operation_type: 'Deposit', currency: 'USD', amount: 100 },
    });
    const { operationsAPI } = loadApiModule();
    const payload = {
      operation_type: 'Deposit' as const,
      currency: 'USD',
      quantity: 100,
      trade_date: '15.02.2026',
    };

    await operationsAPI.create(payload);
    expect(mockApiInstance.post).toHaveBeenCalledWith('/operations', payload, { params: {} });

    mockApiInstance.post.mockClear();
    await operationsAPI.create(payload, 5);
    expect(mockApiInstance.post).toHaveBeenCalledWith('/operations', payload, {
      params: { portfolio_id: 5 },
    });
  });

  it('operationsAPI.list calls GET /operations with optional portfolio_id', async () => {
    mockApiInstance.get.mockResolvedValue({ data: [] });
    const { operationsAPI } = loadApiModule();

    await operationsAPI.list();
    expect(mockApiInstance.get).toHaveBeenCalledWith('/operations', { params: {} });

    mockApiInstance.get.mockClear();
    await operationsAPI.list(3);
    expect(mockApiInstance.get).toHaveBeenCalledWith('/operations', { params: { portfolio_id: 3 } });
  });
});
