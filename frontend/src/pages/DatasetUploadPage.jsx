import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { ArrowRight, CheckCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import FileUploader from '../components/upload/FileUploader';
import { datasetApi, dashboardApi } from '../services/api';
import useAuthStore from '../store/authStore';

const STEPS = ['Upload File', 'Processing', 'Choose Visualizations', 'Dashboard Ready'];

export default function DatasetUploadPage() {
  const navigate = useNavigate();
  const { currentWorkspaceId } = useAuthStore();
  const [step, setStep] = useState(0);
  const [uploadedDataset, setUploadedDataset] = useState(null);
  const [selectedWidgets, setSelectedWidgets] = useState([]);
  const [dashboardName, setDashboardName] = useState('');

  // Poll dataset status after upload
  const { data: datasetStatus } = useQuery(
    ['datasetStatus', uploadedDataset?.id],
    () => datasetApi.get(uploadedDataset.id).then((r) => r.data),
    {
      enabled: !!uploadedDataset && step === 1,
      refetchInterval: (d) => (d?.status === 'ready' || d?.status === 'error' ? false : 2000),
      onSuccess: (d) => {
        if (d.status === 'ready') setStep(2);
        if (d.status === 'error') toast.error(`Processing failed: ${d.error_message}`);
      },
    }
  );

  // Get suggestions after ready
  const { data: suggestions, isLoading: loadingSuggestions } = useQuery(
    ['suggestions', uploadedDataset?.id],
    () => datasetApi.suggestions(uploadedDataset.id).then((r) => r.data),
    {
      enabled: !!uploadedDataset && step === 2,
      onSuccess: (data) => {
        // Auto-select recommended widgets
        const recommended = [
          ...data.suggestions.kpis.slice(0, 4),
          ...data.suggestions.charts.filter((c) => c.recommended).slice(0, 4),
        ];
        setSelectedWidgets(recommended.map((w) => w.id));
        setDashboardName(`${datasetStatus?.name || 'My'} Dashboard`);
      },
    }
  );

  const handleUploadSuccess = (dataset) => {
    setUploadedDataset(dataset);
    setStep(1);
  };

  const toggleWidget = (id) => {
    setSelectedWidgets((prev) =>
      prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]
    );
  };

  const handleCreateDashboard = async () => {
    if (!selectedWidgets.length) {
      toast.error('Select at least one widget');
      return;
    }

    try {
      const { data: dashboard } = await dashboardApi.create({
        workspaceId: currentWorkspaceId,
        datasetId: uploadedDataset.id,
        name: dashboardName || 'My Dashboard',
        theme: 'light',
      });

      // Add selected widgets
      const allSuggestions = [
        ...(suggestions?.suggestions?.kpis || []),
        ...(suggestions?.suggestions?.charts || []),
      ];

      const selected = allSuggestions.filter((s) => selectedWidgets.includes(s.id));
      const autoLayout = suggestions?.suggestions?.auto_layout || [];

      for (let i = 0; i < selected.length; i++) {
        const widget = selected[i];
        const layoutItem = autoLayout.find((l) => l.widget_id === widget.id);
        await dashboardApi.addWidget(dashboard.id, {
          type: widget.type,
          title: widget.title,
          config: widget.config,
          position: layoutItem
            ? { x: layoutItem.x, y: layoutItem.y, w: layoutItem.w, h: layoutItem.h }
            : { x: (i % 3) * 4, y: Math.floor(i / 3) * 3, w: 4, h: 3 },
        });
      }

      toast.success('Dashboard created!');
      navigate(`/dashboards/${dashboard.id}/edit`);
    } catch (err) {
      toast.error('Failed to create dashboard');
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      {/* Steps indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                i < step ? 'bg-green-500 text-white' :
                i === step ? 'bg-primary-600 text-white' :
                'bg-gray-100 dark:bg-gray-700 text-gray-400'
              }`}>
                {i < step ? <CheckCircle size={14} /> : i + 1}
              </div>
              <span className={`text-sm font-medium hidden sm:block ${i === step ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
                {s}
              </span>
            </div>
            {i < STEPS.length - 1 && <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step 0: Upload */}
      {step === 0 && (
        <div className="card p-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Upload your data file</h2>
          <p className="text-gray-500 text-sm mb-6">Supports Excel (.xlsx, .xls) and CSV files up to 50MB</p>
          <FileUploader onSuccess={handleUploadSuccess} />
        </div>
      )}

      {/* Step 1: Processing */}
      {step === 1 && (
        <div className="card p-12 flex flex-col items-center text-center">
          <Loader2 size={48} className="animate-spin text-primary-500 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Processing your data</h2>
          <p className="text-gray-500 text-sm">
            Cleaning data, detecting column types, and analyzing patterns...
          </p>
          {datasetStatus && (
            <div className="mt-6 text-xs text-gray-400 space-y-1">
              <p>Status: <span className="font-medium text-gray-600 dark:text-gray-300">{datasetStatus.status}</span></p>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Choose visualizations */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Choose your visualizations</h2>
            <p className="text-gray-500 text-sm mb-4">
              We analyzed your data and suggest these visualizations. Select what to include.
            </p>

            {/* Dataset summary */}
            {suggestions && (
              <div className="flex flex-wrap gap-3 mb-4">
                {[
                  { label: 'Rows', value: suggestions.summary?.total_rows?.toLocaleString() },
                  { label: 'Columns', value: suggestions.summary?.total_columns },
                  { label: 'Numeric', value: suggestions.summary?.numeric_columns },
                  { label: 'Date', value: suggestions.summary?.date_columns },
                  { label: 'Categories', value: suggestions.summary?.categorical_columns },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-lg">
                    <span className="text-xs text-gray-500">{label}: </span>
                    <span className="text-xs font-semibold text-gray-900 dark:text-white">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {loadingSuggestions ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary-500" /></div>
          ) : suggestions ? (
            <>
              {/* KPI suggestions */}
              {suggestions.suggestions?.kpis?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">
                    KPI Cards
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {suggestions.suggestions.kpis.map((kpi) => (
                      <button
                        key={kpi.id}
                        onClick={() => toggleWidget(kpi.id)}
                        className={`text-left p-3 rounded-xl border-2 transition-all ${
                          selectedWidgets.includes(kpi.id)
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <p className="text-xs text-gray-500 mb-1">{kpi.metric?.toUpperCase()}</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{kpi.title}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Chart suggestions */}
              {suggestions.suggestions?.charts?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">
                    Charts & Visualizations
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {suggestions.suggestions.charts.map((chart) => (
                      <button
                        key={chart.id}
                        onClick={() => toggleWidget(chart.id)}
                        className={`text-left p-4 rounded-xl border-2 transition-all ${
                          selectedWidgets.includes(chart.id)
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="badge bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400 uppercase text-xs">
                            {chart.type}
                          </span>
                          {chart.recommended && (
                            <span className="badge bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-xs">
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{chart.title}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Dashboard name + create */}
              <div className="card p-6">
                <div className="mb-4">
                  <label className="label">Dashboard Name</label>
                  <input type="text" className="input" value={dashboardName}
                    onChange={(e) => setDashboardName(e.target.value)} placeholder="My Dashboard" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">{selectedWidgets.length} widget{selectedWidgets.length !== 1 ? 's' : ''} selected</span>
                  <button
                    onClick={handleCreateDashboard}
                    disabled={!selectedWidgets.length}
                    className="btn-primary flex items-center gap-2"
                  >
                    Create Dashboard
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
