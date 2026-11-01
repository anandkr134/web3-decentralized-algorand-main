import React from 'react';

export default function LoadingBounties() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="h-8 w-48 bg-gray-200 dark:bg-zinc-800 rounded mb-2 animate-pulse"></div>
          <div className="h-4 w-72 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse"></div>
        </div>
        <div className="h-10 w-32 bg-gray-200 dark:bg-zinc-800 rounded-md animate-pulse"></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-800 p-6 flex flex-col h-[280px]">
            <div className="flex justify-between items-start mb-4">
              <div className="h-6 w-3/4 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse"></div>
              <div className="h-5 w-16 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse"></div>
            </div>
            
            <div className="space-y-2 mb-6 flex-grow">
              <div className="h-4 w-full bg-gray-200 dark:bg-zinc-800 rounded animate-pulse"></div>
              <div className="h-4 w-5/6 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse"></div>
              <div className="h-4 w-4/6 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse"></div>
            </div>
            
            <div className="border-t border-gray-100 dark:border-zinc-800 pt-4 mt-auto">
              <div className="flex justify-between items-center mb-4">
                <div className="space-y-1">
                  <div className="h-3 w-10 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse"></div>
                  <div className="h-4 w-16 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse"></div>
                </div>
                <div className="space-y-1 text-right">
                  <div className="h-3 w-14 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse ml-auto"></div>
                  <div className="h-4 w-20 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse ml-auto"></div>
                </div>
              </div>
              <div className="h-10 w-full bg-gray-200 dark:bg-zinc-800 rounded animate-pulse"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
