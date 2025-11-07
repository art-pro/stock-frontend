'use client';

import { useState } from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';

interface TooltipProps {
  text: string;
  className?: string;
}

export default function Tooltip({ text, className = '' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        className="ml-1 text-gray-400 hover:text-gray-300 focus:outline-none"
        aria-label="More information"
      >
        <InformationCircleIcon className="h-4 w-4" />
      </button>
      
      {isVisible && (
        <div className="absolute z-10 w-64 p-2 mt-2 text-sm text-white bg-gray-900 border border-gray-700 rounded-lg shadow-lg -left-28 top-5">
          <div className="relative">
            {text}
            <div className="absolute -top-4 left-28 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-gray-700"></div>
          </div>
        </div>
      )}
    </div>
  );
}