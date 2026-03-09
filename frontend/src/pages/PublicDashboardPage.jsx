import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from 'react-query';
import { Loader2, Zap } from 'lucide-react';
import { dashboardApi } from '../services/api';
import DashboardGrid from '../components/dashboard/DashboardGrid';

export default function PublicDashboardPage() {
  const { shareToken } = useParams();
  const [activeFilters, setActiveFilters] = useState({});

  const { data: dashboard, isLoading, error } = useQuery(
    ['publicDashboard', shareToken],
    () => dashboardApi.getPublic(shareToken).then((r) => r.data),
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary-500" size={32} />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard not found</h1>
          <p className="text-gray-500">This dashboard may have been deleted or made private.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-background-light dark:bg-background-dark ${dashboard.theme === 'dark' ? 'dark' : ''}`}>
      {/* Header */}
      <header className="bg-white dark:bg-surface-dark border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{dashboard.name}</h1>
            {dashboard.dataset_name && (
              <p className="text-sm text-gray-400 mt-0.5">Source: {dashboard.dataset_name}</p>
            )}
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <Zap size={14} className="text-primary-500" />
            <span className="text-xs">Powered by DataDash</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <DashboardGrid
          widgets={dashboard.widgets || []}
          datasetId={dashboard.dataset_id}
          filePath={dashboard.cleaned_file_path || dashboard.file_path}
          filters={activeFilters}
          isEditing={false}
        />
      </main>
    </div>
  );
}
