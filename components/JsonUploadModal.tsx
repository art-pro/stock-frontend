'use client';

import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, DocumentArrowUpIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import axios from 'axios';

interface JsonUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function JsonUploadModal({ isOpen, onClose, onSuccess }: JsonUploadModalProps) {
  const [jsonContent, setJsonContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonContent(content);
      validateJson(content);
    };
    reader.readAsText(file);
  };

  const validateJson = (content: string) => {
    setError('');
    setValidationErrors([]);
    
    try {
      const data = JSON.parse(content);
      
      if (!Array.isArray(data)) {
        setError('JSON must be an array of stock objects');
        return false;
      }

      const errors: string[] = [];
      
      data.forEach((stock, index) => {
        if (!stock.ticker) {
          errors.push(`Stock at index ${index}: ticker is required`);
        }
        if (!stock.company_name) {
          errors.push(`Stock at index ${index}: company_name is required`);
        }
        if (stock.current_price !== undefined && typeof stock.current_price !== 'number') {
          errors.push(`Stock at index ${index}: current_price must be a number`);
        }
        if (stock.fair_value !== undefined && typeof stock.fair_value !== 'number') {
          errors.push(`Stock at index ${index}: fair_value must be a number`);
        }
      });

      if (errors.length > 0) {
        setValidationErrors(errors);
        return false;
      }

      return true;
    } catch (e) {
      setError('Invalid JSON format');
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!validateJson(jsonContent)) {
      return;
    }

    setLoading(true);
    try {
      const data = JSON.parse(jsonContent);
      const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/stocks/bulk-update`,
        { stocks: data },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 200) {
        onSuccess();
        onClose();
        setJsonContent('');
      }
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to update stocks');
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = (withData: boolean) => {
    const template = withData ? 
      [
        {
          ticker: "AAPL",
          company_name: "Apple Inc.",
          isin: "US0378331005",
          sector: "Technology",
          current_price: 175.50,
          currency: "USD",
          fair_value: 200.00,
          upside_potential: 13.96,
          downside_risk: -15.00,
          probability_positive: 0.65,
          expected_value: 7.58,
          beta: 1.25,
          volatility: 28.5,
          pe_ratio: 29.5,
          eps_growth_rate: 5.5,
          debt_to_ebitda: 1.8,
          dividend_yield: 0.5,
          b_ratio: 0.93,
          kelly_fraction: 15.2,
          half_kelly_suggested: 7.6,
          shares_owned: 100,
          avg_price_local: 150.00,
          buy_zone_min: 160.00,
          buy_zone_max: 170.00,
          assessment: "Hold",
          update_frequency: "daily",
          data_source: "Manual",
          fair_value_source: "Analyst Consensus",
          comment: "Strong fundamentals, waiting for better entry point"
        },
        {
          ticker: "MSFT",
          company_name: "Microsoft Corporation",
          isin: "US5949181045",
          sector: "Technology",
          current_price: 380.00,
          currency: "USD",
          fair_value: 420.00,
          upside_potential: 10.53,
          downside_risk: -12.00,
          probability_positive: 0.70,
          expected_value: 6.97,
          beta: 1.10,
          volatility: 25.0,
          pe_ratio: 32.0,
          eps_growth_rate: 8.0,
          debt_to_ebitda: 1.2,
          dividend_yield: 0.8,
          b_ratio: 0.88,
          kelly_fraction: 12.5,
          half_kelly_suggested: 6.25,
          shares_owned: 50,
          avg_price_local: 350.00,
          buy_zone_min: 360.00,
          buy_zone_max: 375.00,
          assessment: "Add",
          update_frequency: "weekly",
          data_source: "Manual",
          fair_value_source: "DCF Analysis",
          comment: "Cloud growth continues to impress"
        }
      ] :
      [
        {
          ticker: "",
          company_name: "",
          isin: "",
          sector: "",
          current_price: 0,
          currency: "USD",
          fair_value: 0,
          upside_potential: 0,
          downside_risk: 0,
          probability_positive: 0,
          expected_value: 0,
          beta: 0,
          volatility: 0,
          pe_ratio: 0,
          eps_growth_rate: 0,
          debt_to_ebitda: 0,
          dividend_yield: 0,
          b_ratio: 0,
          kelly_fraction: 0,
          half_kelly_suggested: 0,
          shares_owned: 0,
          avg_price_local: 0,
          buy_zone_min: 0,
          buy_zone_max: 0,
          assessment: "",
          update_frequency: "daily",
          data_source: "Manual",
          fair_value_source: "",
          comment: ""
        }
      ];

    const dataStr = JSON.stringify(template, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = withData ? 'stock_template_example.json' : 'stock_template_empty.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
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
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="div" className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium leading-6 text-white">
                    Upload Stock Data JSON
                  </h3>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </Dialog.Title>

                <div className="mt-2">
                  <div className="flex gap-4 mb-4">
                    <button
                      onClick={() => downloadTemplate(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      <DocumentTextIcon className="h-5 w-5" />
                      Download Example Template
                    </button>
                    <button
                      onClick={() => downloadTemplate(false)}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                    >
                      <DocumentTextIcon className="h-5 w-5" />
                      Download Empty Template
                    </button>
                  </div>

                  <div className="border-2 border-dashed border-gray-600 rounded-lg p-4">
                    <label className="flex flex-col items-center cursor-pointer">
                      <DocumentArrowUpIcon className="h-12 w-12 text-gray-400 mb-2" />
                      <span className="text-gray-300">Click to upload or drag and drop</span>
                      <span className="text-gray-500 text-sm">JSON files only</span>
                      <input
                        type="file"
                        className="hidden"
                        accept=".json"
                        onChange={handleFileUpload}
                      />
                    </label>
                  </div>

                  {jsonContent && (
                    <div className="mt-4">
                      <h4 className="text-white mb-2">JSON Content:</h4>
                      <textarea
                        value={jsonContent}
                        onChange={(e) => {
                          setJsonContent(e.target.value);
                          validateJson(e.target.value);
                        }}
                        className="w-full h-64 p-2 bg-gray-700 text-gray-300 rounded font-mono text-sm"
                      />
                    </div>
                  )}

                  {error && (
                    <div className="mt-4 p-3 bg-red-900/50 border border-red-600 rounded">
                      <p className="text-red-300">{error}</p>
                    </div>
                  )}

                  {validationErrors.length > 0 && (
                    <div className="mt-4 p-3 bg-yellow-900/50 border border-yellow-600 rounded">
                      <p className="text-yellow-300 mb-2">Validation Errors:</p>
                      <ul className="list-disc list-inside text-yellow-300 text-sm">
                        {validationErrors.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                    onClick={onClose}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    onClick={handleSubmit}
                    disabled={!jsonContent || loading || validationErrors.length > 0}
                  >
                    {loading ? 'Uploading...' : 'Upload & Update'}
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