import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, CodeBracketIcon } from '@heroicons/react/24/outline';
import JsonViewer from './JsonViewer';

interface DataSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  source: 'alphavantage' | 'grok';
  data: {
    ticker: string;
    companyName: string;
    fetchedAt: string | null;
    dataSource: string;
    fairValueSource: string;
    currentPrice: number;
    fairValue: number;
    currency: string;
    lastUpdated: string;
    rawJson?: string;
  };
}

export default function DataSourceModal({ isOpen, onClose, source, data }: DataSourceModalProps) {
  const [showRawJson, setShowRawJson] = useState(false);
  const isAlphaVantage = source === 'alphavantage';
  const fetchedAt = isAlphaVantage ? data.fetchedAt : data.fetchedAt;
  
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-75" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-gray-800 p-6 text-left align-middle shadow-xl transition-all border border-gray-700">
                <Dialog.Title
                  as="div"
                  className="flex items-center justify-between mb-6"
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 ${isAlphaVantage ? 'bg-blue-500/20' : 'bg-purple-500/20'} rounded-lg flex items-center justify-center`}>
                      {isAlphaVantage ? (
                        <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-white">
                        {isAlphaVantage ? 'Alpha Vantage Data' : 'Grok AI Analysis'}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {data.ticker} - {data.companyName}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-300 transition-colors"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </Dialog.Title>

                <div className="space-y-6">
                  {/* Fetch Information */}
                  <div className="bg-gray-900 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-300 mb-3">Data Retrieval</h4>
                    {fetchedAt ? (
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-400">Last Fetched:</span>
                          <span className="text-sm text-white">
                            {new Date(fetchedAt).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-400">Time:</span>
                          <span className="text-sm text-white">
                            {new Date(fetchedAt).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              timeZoneName: 'short'
                            })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-400">Age:</span>
                          <span className="text-sm text-white">
                            {getDataAge(fetchedAt)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">No data has been fetched from this source yet</p>
                    )}
                  </div>

                  {/* Data Retrieved */}
                  {fetchedAt && (
                    <div className="bg-gray-900 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-300 mb-3">
                        {isAlphaVantage ? 'Market Data Retrieved' : 'Analysis Results'}
                      </h4>
                      <div className="space-y-2">
                        {isAlphaVantage ? (
                          <>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-400">Current Price:</span>
                              <span className="text-sm text-white font-mono">
                                {data.currentPrice.toFixed(2)} {data.currency}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-400">Market Cap:</span>
                              <span className="text-sm text-gray-300">Real-time data</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-400">Volume:</span>
                              <span className="text-sm text-gray-300">Daily trading volume</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-400">52-Week Range:</span>
                              <span className="text-sm text-gray-300">Historical highs/lows</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-400">Beta:</span>
                              <span className="text-sm text-gray-300">Market correlation</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-400">Fair Value:</span>
                              <span className="text-sm text-white font-mono">
                                {data.fairValue.toFixed(2)} {data.currency}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-400">AI Model:</span>
                              <span className="text-sm text-gray-300">Grok-4-fast-reasoning</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-400">Analysis Type:</span>
                              <span className="text-sm text-gray-300">Probabilistic EV optimization</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-400">Factors Analyzed:</span>
                              <span className="text-sm text-gray-300">Financials, sentiment, technicals</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-400">Confidence:</span>
                              <span className="text-sm text-gray-300">Based on ½-Kelly sizing</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Source Information */}
                  <div className="bg-gray-900 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-300 mb-3">Source Details</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-400">Primary Source:</span>
                        <span className="text-sm text-white">{data.dataSource}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-400">Fair Value Source:</span>
                        <span className="text-sm text-white">{data.fairValueSource || 'Not specified'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-400">Last System Update:</span>
                        <span className="text-sm text-white">
                          {new Date(data.lastUpdated).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* API Status */}
                  <div className="bg-gray-900 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-300 mb-3">API Status</h4>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm text-green-400">
                        {isAlphaVantage ? 'Alpha Vantage API' : 'Grok AI API'} Connected
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {isAlphaVantage 
                        ? 'Real-time market data and financial metrics'
                        : 'Advanced AI analysis and predictive modeling'}
                    </p>
                  </div>

                  {/* Raw JSON Viewer Button */}
                  {data.rawJson && (
                    <div className="mt-4">
                      <button
                        onClick={() => setShowRawJson(!showRawJson)}
                        className="flex items-center space-x-2 w-full bg-gray-800 hover:bg-gray-700 rounded-lg px-4 py-3 transition-colors"
                      >
                        <CodeBracketIcon className="h-5 w-5 text-blue-400" />
                        <span className="text-sm font-medium text-gray-300">
                          {showRawJson ? 'Hide' : 'View'} Raw JSON Response
                        </span>
                        <span className="ml-auto text-xs text-gray-500">
                          {showRawJson ? '▲' : '▼'}
                        </span>
                      </button>
                      
                      {showRawJson && (
                        <div className="mt-4">
                          <JsonViewer 
                            data={data.rawJson} 
                            title={`${isAlphaVantage ? 'Alpha Vantage' : 'Grok AI'} Raw Response`}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-gray-600 bg-gray-700 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    onClick={onClose}
                  >
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

function getDataAge(fetchedAt: string): string {
  const now = new Date();
  const fetched = new Date(fetchedAt);
  const diffMs = now.getTime() - fetched.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffMins > 0) {
    return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
}