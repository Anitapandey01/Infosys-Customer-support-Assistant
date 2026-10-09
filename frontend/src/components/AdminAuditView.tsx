import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, FileText, History, RefreshCw, ShieldAlert, User, Upload } from 'lucide-react';
import { fetchDocumentHistoryApi, fetchDocumentsApi, uploadDocumentApi } from '../services/api';

interface DocumentRecord {
  document_id: number;
  document_name: string;
  document_type: string;
  version: number;
  status: string;
  filename: string;
  uploaded_by: string;
}

export const AdminAuditView: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [history, setHistory] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentName, setDocumentName] = useState('');
  const [documentType, setDocumentType] = useState('policy');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAudit = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchDocumentsApi();
      setDocuments(result.documents);
      if (selectedName) {
        const selectedStillExists = result.documents.some(
          (document) => document.document_name === selectedName
        );
        if (!selectedStillExists) {
          setSelectedName(null);
          setHistory([]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document audit history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAudit();
  }, []);

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedFile) { setUploadError('Please select a PDF document.'); return; }
    if (selectedFile.type !== 'application/pdf') { setUploadError('Only PDF files are allowed.'); return; }
    if (!documentName.trim()) { setUploadError('Please enter a document name.'); return; }
    setUploading(true);
    setUploadError(null);
    try {
      await uploadDocumentApi(selectedFile, documentName.trim(), documentType);
      setSelectedFile(null);
      setDocumentName('');
      setDocumentType('policy');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadAudit();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Document upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const openHistory = async (documentName: string) => {
    setSelectedName(documentName);
    setHistoryLoading(true);
    setError(null);
    try {
      const result = await fetchDocumentHistoryApi(documentName);
      setHistory(result.versions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document history.');
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const latestFirst = [...documents].sort((a, b) => b.document_id - a.document_id);

  return (
    <div className="p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-amber-400" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Admin Audit</h1>
          </div>
          <p className="text-sm text-slate-400 mt-2">
            Review document uploads and version history using the existing Documents backend records.
          </p>
        </div>
        <button
          type="button"
          onClick={loadAudit}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Audit
        </button>
      </div>

      <div className="rounded-2xl border border-indigo-500/20 bg-slate-900 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Upload className="w-5 h-5 text-indigo-400" />
          <div>
            <h2 className="font-semibold text-white">Upload Policies / Folder</h2>
            <p className="text-[11px] text-amber-300 mt-1">Admin only</p>
          </div>
        </div>
        <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <label className="md:col-span-2"><span className="block text-[11px] text-slate-500 mb-1">PDF Document</span><input ref={fileInputRef} type="file" accept="application/pdf,.pdf" onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} className="block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white" /></label>
          <label><span className="block text-[11px] text-slate-500 mb-1">Document Name</span><input value={documentName} onChange={(event) => setDocumentName(event.target.value)} placeholder="Refund Policy" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-indigo-500" /></label>
          <label><span className="block text-[11px] text-slate-500 mb-1">Type</span><select value={documentType} onChange={(event) => setDocumentType(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-indigo-500"><option value="policy">Policy</option><option value="faq">FAQ</option><option value="support">Support</option></select></label>
          <button type="submit" disabled={uploading} className="md:col-span-4 justify-self-start inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"><Upload className="w-4 h-4" />{uploading ? 'Uploading & Indexing...' : 'Upload Document'}</button>
        </form>
        {uploadError && <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300"><AlertCircle className="w-4 h-4" />{uploadError}</div>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">Document Records</p>
          <p className="text-3xl font-bold text-white mt-2">{documents.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">Active Versions</p>
          <p className="text-3xl font-bold text-emerald-300 mt-2">{documents.filter((item) => item.status === 'active').length}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">Unique Documents</p>
          <p className="text-3xl font-bold text-sky-300 mt-2">
            {new Set(documents.map((item) => item.document_name)).size}
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="font-semibold text-white">Document Upload History</h2>
          <p className="text-xs text-slate-500 mt-1">
            Every row comes from the backend <code>/documents/</code> records.
          </p>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">Loading audit records...</div>
        ) : latestFirst.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-10 h-10 text-slate-700 mx-auto" />
            <p className="text-sm font-semibold text-white mt-4">No document uploads yet</p>
            <p className="text-xs text-slate-500 mt-2">Uploaded Knowledge Base documents will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead className="bg-slate-950/70">
                <tr className="text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">Document</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Version</th>
                  <th className="px-5 py-3">Uploaded By</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">History</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {latestFirst.map((document) => (
                  <tr key={document.document_id} className="hover:bg-slate-800/30">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-sky-400" />
                        <div>
                          <p className="text-sm font-medium text-slate-200">{document.document_name}</p>
                          <p className="text-[11px] text-slate-500">{document.filename}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-300">Document Uploaded</td>
                    <td className="px-5 py-4 text-xs text-slate-300">v{document.version}</td>
                    <td className="px-5 py-4 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1.5"><User className="w-3.5 h-3.5" />{document.uploaded_by}</span>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-300">{document.status}</td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => openHistory(document.document_name)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-[11px] font-semibold text-slate-200 hover:bg-slate-800"
                      >
                        <History className="w-3.5 h-3.5" />
                        View History
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedName && (
        <div className="rounded-2xl border border-indigo-500/20 bg-slate-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-white">Version History: {selectedName}</h2>
              <p className="text-xs text-slate-500 mt-1">Data from <code>/documents/history/{selectedName}</code></p>
            </div>
            <button type="button" onClick={() => { setSelectedName(null); setHistory([]); }} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400">
              ×
            </button>
          </div>
          {historyLoading ? (
            <div className="p-8 text-center text-sm text-slate-500">Loading version history...</div>
          ) : (
            <div className="divide-y divide-slate-800">
              {history.map((version) => (
                <div key={version.document_id} className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-200">Version {version.version}</p>
                    <p className="text-xs text-slate-500 mt-1">{version.filename} · {version.document_type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-300">{version.uploaded_by}</p>
                    <p className="text-[11px] text-slate-500 mt-1">{version.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
