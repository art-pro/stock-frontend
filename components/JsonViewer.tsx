import { useState } from 'react';
import { ChevronRightIcon, ChevronDownIcon, ClipboardIcon, CheckIcon } from '@heroicons/react/24/outline';

interface JsonViewerProps {
  data: string | object;
  title?: string;
}

export default function JsonViewer({ data, title }: JsonViewerProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  // Parse JSON if it's a string
  const jsonData = typeof data === 'string' ? 
    (() => {
      try {
        return JSON.parse(data);
      } catch (e) {
        return { error: 'Invalid JSON', raw: data };
      }
    })() : data;

  const toggleExpand = (path: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpanded(newExpanded);
  };

  const copyToClipboard = () => {
    const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderValue = (value: any, path: string = '', depth: number = 0): React.JSX.Element => {
    if (value === null) return <span className="text-gray-500">null</span>;
    if (value === undefined) return <span className="text-gray-500">undefined</span>;
    
    const indent = depth * 20;

    if (typeof value === 'boolean') {
      return <span className="text-blue-400">{value.toString()}</span>;
    }

    if (typeof value === 'number') {
      return <span className="text-green-400">{value}</span>;
    }

    if (typeof value === 'string') {
      // Truncate long strings
      const displayValue = value.length > 100 ? value.substring(0, 100) + '...' : value;
      return <span className="text-yellow-400">&quot;{displayValue}&quot;</span>;
    }

    if (Array.isArray(value)) {
      const isExpanded = expanded.has(path);
      return (
        <div style={{ marginLeft: indent }}>
          <span 
            className="cursor-pointer hover:bg-gray-700 rounded px-1"
            onClick={() => toggleExpand(path)}
          >
            {isExpanded ? <ChevronDownIcon className="h-3 w-3 inline" /> : <ChevronRightIcon className="h-3 w-3 inline" />}
            <span className="text-gray-400 ml-1">Array[{value.length}]</span>
          </span>
          {isExpanded && (
            <div className="ml-4 mt-1">
              {value.map((item, index) => (
                <div key={index} className="my-1">
                  <span className="text-gray-500">{index}:</span> {renderValue(item, `${path}[${index}]`, depth + 1)}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (typeof value === 'object') {
      const isExpanded = expanded.has(path);
      const keys = Object.keys(value);
      return (
        <div style={{ marginLeft: indent }}>
          <span 
            className="cursor-pointer hover:bg-gray-700 rounded px-1"
            onClick={() => toggleExpand(path)}
          >
            {isExpanded ? <ChevronDownIcon className="h-3 w-3 inline" /> : <ChevronRightIcon className="h-3 w-3 inline" />}
            <span className="text-gray-400 ml-1">Object {`{${keys.length} keys}`}</span>
          </span>
          {isExpanded && (
            <div className="ml-4 mt-1">
              {keys.map((key) => (
                <div key={key} className="my-1">
                  <span className="text-purple-400">&quot;{key}&quot;:</span> {renderValue(value[key], `${path}.${key}`, depth + 1)}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return <span className="text-gray-400">{String(value)}</span>;
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-sm font-medium text-gray-300">{title || 'JSON Data'}</h4>
        <button
          onClick={copyToClipboard}
          className="flex items-center space-x-1 text-xs text-gray-400 hover:text-white transition-colors"
        >
          {copied ? (
            <>
              <CheckIcon className="h-4 w-4 text-green-400" />
              <span className="text-green-400">Copied!</span>
            </>
          ) : (
            <>
              <ClipboardIcon className="h-4 w-4" />
              <span>Copy JSON</span>
            </>
          )}
        </button>
      </div>
      <div className="font-mono text-xs overflow-x-auto max-h-96 overflow-y-auto">
        {renderValue(jsonData)}
      </div>
    </div>
  );
}