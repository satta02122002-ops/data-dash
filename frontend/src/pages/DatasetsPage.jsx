import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import {
  Database, Upload, Loader2, Trash2, Eye, BarChart2,
  CheckCircle, Clock, AlertCircle, RefreshCw,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { datasetApi, dashboardApi } from '../services/api';
import useAuthStore from '../store/authStore';
import clsx from 'clsx';

const STATUS_CONFIG = {
  ready: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20', label: 'Ready' },
  processing: { icon: RefreshCw, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', label: 'Processing' },
  uploaded: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20', label: 'Uploaded' },
  error: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', label: 'Error' },
};

const formatFileSize = (bytes) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export default function DatasetsPage() {
  const { currentWorkspaceId } = useAuthStore();
  const navigate = useNavigate();

  const { data, isLoading, refetch } = useQuery(
    ['datasets', currentWorkspaceId],
    () => datasetApi.list(currentWorkspaceId).then((r) => r.data),
    { enabled: !!currentWorkspaceId, refetchInterval: (d) => {
      const hasProcessing = d?.datasets?.some(ds => ds.status === 'processing' || ds.status === 'uploaded');
      return hasProcessing ? 3000 : false;
    }},
  );

  const handleDelete = async (id) => {
    if (!confirm('Delete this dataset? All associated dashboards will lose their data.')) return;
    try {
      await datasetApi.delete(id);
      toast.success('Dataset deleted');
      refetch();
    } catch {
      toast.error('Failed to delete dataset');
    }
  };

  const handleCreateDashboard = async (dataset) => {
    try {
      const { data: dash } = await dashboardApi.create({
        workspaceId: currentWorkspaceId,
        datasetId: dataset.id,
        name: `${dataset.name} Dashboard`,
        theme: 'light',
      });
      navigate(`/dashboards/${dash.id}/edit`);
    } catch {
      toast.error('Failed to create dashboard');
    }
  };

  const datasets = data?.datasets || [];

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Datasets</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">{datasets.length} dataset{datasets.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => navigate('/datasets/upload')} className="btn-primary flex items-center gap-2 text-sm">
          <Upload size={16} />
          Upload File
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-primary-500" size={32} />
        </div>
      ) : datasets.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 text-center">
          <Database size={48} className="text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No datasets yet</h3>
          <p className="text-gray-500 text-sm mb-6">Upload an Excel or CSV file to get started.</p>
          <button onClick={() => navigate('/datasets/upload')} className="btn-primary flex items-center gap-2">
            <Upload size={16} />
            Upload Your First File
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Type</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Size</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Rows</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Uploaded</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {datasets.map((ds) => {
                const status = STATUS_CONFIG[ds.status] || STATUS_CONFIG.uploaded;
                const StatusIcon = status.icon;
                return (
                  <tr key={ds.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center flex-shrink-0">
                          <Database size={14} className="text-primary-600 dark:text-primary-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{ds.name}</p>
                          <p className="text-xs text-gray-400 truncate">{ds.original_filename}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell">
                      <span className="badge bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 uppercase">
                        {ds.file_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 hidden md:table-cell">{formatFileSize(ds.file_size)}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 hidden md:table-cell">
                      {ds.row_count ? ds.row_count.toLocaleString() : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={clsx('flex items-center gap-1.5 text-xs font-medium w-fit px-2 py-1 rounded-full', status.bg, status.color)}>
                        <StatusIcon size={11} className={ds.status === 'processing' ? 'animate-spin' : ''} />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-400 hidden lg:table-cell">
                      {formatDistanceToNow(new Date(ds.created_at), { addSuffix: true })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 justify-end">
                        {ds.status === 'ready' && (
                          <button
                            onClick={() => handleCreateDashboard(ds)}
                            className="btn-ghost p-2 text-primary-600 dark:text-primary-400"
                            title="Create dashboard"
                          >
                            <BarChart2 size={15} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(ds.id)}
                          className="btn-ghost p-2 text-gray-400 hover:text-red-500"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
