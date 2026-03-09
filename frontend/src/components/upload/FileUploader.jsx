import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, X, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { datasetApi } from '../../services/api';
import useAuthStore from '../../store/authStore';

const ACCEPTED_TYPES = {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'text/csv': ['.csv'],
};

const MAX_SIZE = 50 * 1024 * 1024; // 50MB

export default function FileUploader({ onSuccess }) {
  const { currentWorkspaceId } = useAuthStore();
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    setError('');
    if (rejectedFiles.length > 0) {
      const err = rejectedFiles[0].errors[0];
      setError(err.code === 'file-too-large' ? 'File too large. Max 50MB.' : err.message);
      return;
    }
    const f = acceptedFiles[0];
    setFile(f);
    setName(f.name.replace(/\.[^.]+$/, ''));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_SIZE,
    multiple: false,
  });

  const handleUpload = async () => {
    if (!file || !currentWorkspaceId) return;

    setUploading(true);
    setProgress(0);
    setError('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('workspaceId', currentWorkspaceId);
    formData.append('name', name || file.name);

    try {
      const { data } = await datasetApi.upload(formData, setProgress);
      toast.success('File uploaded! Processing in background...');
      onSuccess?.(data);
    } catch (err) {
      const msg = err.response?.data?.error || 'Upload failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    setName('');
    setError('');
    setProgress(0);
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      {!file ? (
        <div
          {...getRootProps()}
          className={clsx(
            'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200',
            isDragActive
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
              : 'border-gray-200 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-500 hover:bg-gray-50 dark:hover:bg-gray-800/50'
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-3">
            <div className={clsx(
              'w-16 h-16 rounded-full flex items-center justify-center transition-colors',
              isDragActive ? 'bg-primary-100 dark:bg-primary-900/40' : 'bg-gray-100 dark:bg-gray-700'
            )}>
              <Upload size={28} className={isDragActive ? 'text-primary-600' : 'text-gray-400'} />
            </div>
            <div>
              <p className="text-base font-medium text-gray-900 dark:text-white">
                {isDragActive ? 'Drop your file here' : 'Drag & drop your file'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                or <span className="text-primary-600 font-medium">browse to upload</span>
              </p>
            </div>
            <div className="flex items-center gap-4 mt-2">
              {['.xlsx', '.xls', '.csv'].map((ext) => (
                <span key={ext} className="badge bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                  {ext}
                </span>
              ))}
              <span className="badge bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">Max 50MB</span>
            </div>
          </div>
        </div>
      ) : (
        /* File selected state */
        <div className="border border-gray-200 dark:border-gray-600 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
              <FileSpreadsheet size={20} className="text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{file.name}</p>
              <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            {!uploading && (
              <button onClick={removeFile} className="text-gray-400 hover:text-red-500 p-1">
                <X size={16} />
              </button>
            )}
          </div>

          {/* Progress bar */}
          {uploading && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Uploading...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                <div
                  className="bg-primary-600 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dataset name */}
      {file && !uploading && (
        <div>
          <label className="label">Dataset Name</label>
          <input
            type="text"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Sales Data"
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 px-3 py-2.5 rounded-lg">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Upload button */}
      {file && (
        <button
          onClick={handleUpload}
          disabled={uploading || !name}
          className="btn-primary w-full flex items-center justify-center gap-2 h-11"
        >
          {uploading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload size={16} />
              Upload & Process
            </>
          )}
        </button>
      )}
    </div>
  );
}
