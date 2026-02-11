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
});
