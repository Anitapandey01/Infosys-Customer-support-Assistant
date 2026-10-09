import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Database, FileText, RefreshCw, X, History, BookOpen } from 'lucide-react';
import { fetchDocumentContentApi, fetchDocumentFileApi, fetchDocumentHistoryApi, fetchDocumentsApi } from '../services/api';

export interface BackendDocument {
  document_id: number;
  document_name: string;
  document_type: string;
  version: number;
  status: string;
  filename: string;
  uploaded_by: string;
}

export interface PolicyManagementViewProps {
  onDocumentsLoaded?: (documents: BackendDocument[]) => void;
}

interface DocumentPage {
  page_number: number;
  text: string;
}

export const PolicyManagementView: React.FC<PolicyManagementViewProps> = ({ onDocumentsLoaded }) => {
  const [documents, setDocuments] = useState<BackendDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<BackendDocument | null>(null);
  const [history, setHistory] = useState<BackendDocument[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [pages, setPages] = useState<DocumentPage[]>([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const loadDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchDocumentsApi();
      setDocuments(result.documents);
      onDocumentsLoaded?.(result.documents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load knowledge documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const latestDocuments = useMemo(() => {
    const latest = new Map<string, BackendDocument>();
    documents.forEach((document) => {
      const existing = latest.get(document.document_name);
      if (!existing || document.version > existing.version) latest.set(document.document_name, document);
    });
    return Array.from(latest.values()).sort((a, b) => a.document_name.localeCompare(b.document_name));
  }, [documents]);

  const openDetails = async (document: BackendDocument) => {
    setSelectedDocument(document);
    setHistory([]);
    setPages([]);
    setContentError(null);
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
    setHistoryLoading(true);
    setContentLoading(true);

    const [historyResult, contentResult] = await Promise.allSettled([
      fetchDocumentHistoryApi(document.document_name),
      fetchDocumentContentApi(document.document_id),
      fetchDocumentFileApi(document.document_id),
    ]);

    if (historyResult.status === 'fulfilled') setHistory(historyResult.value.versions);
    if (contentResult.status === 'fulfilled') {
      setPages(contentResult.value.pages);
    } else {
      setContentError(contentResult.reason instanceof Error ? contentResult.reason.message : 'Unable to extract document text.');
    }

    const fileResult = await Promise.resolve((await Promise.allSettled([fetchDocumentFileApi(document.document_id)]))[0]);
    if (fileResult.status === 'fulfilled') {
      setPdfUrl(URL.createObjectURL(fileResult.value));
    } else if (contentResult.status === 'rejected') {
      setContentError(fileResult.reason instanceof Error ? fileResult.reason.message : 'Unable to open the PDF document.');
    }

    setHistoryLoading(false);
    setContentLoading(false);
  };

  return (
    <div className="p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-6 h-6 text-sky-400" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Policy Knowledge Base</h1>
          </div>
          <p className="text-sm text-slate-400 mt-2">Read the actual company policy and support documents available to authorized users. Document changes are restricted to Admin Audit.</p>
        </div>
        <button type="button" onClick={loadDocuments} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-60">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><p className="text-[11px] text-slate-500">Documents</p><p className="text-2xl font-bold text-white mt-1">{latestDocuments.length}</p></div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><p className="text-[11px] text-slate-500">Versions</p><p className="text-2xl font-bold text-white mt-1">{documents.length}</p></div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><p className="text-[11px] text-slate-500">Active</p><p className="text-2xl font-bold text-emerald-300 mt-1">{documents.filter((item) => item.status === 'active').length}</p></div>
      </div>

      {error && <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-300"><AlertCircle className="w-4 h-4" />{error}</div>}

      <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800"><h2 className="font-semibold text-white">Policy Documents</h2><p className="text-xs text-slate-500 mt-1">Read-only view. Use <strong>Read Document</strong> to read the actual PDF contents. Only Admin Audit can upload or change company documents.</p></div>
        {loading ? <div className="p-10 text-center text-sm text-slate-500">Loading knowledge base...</div> : latestDocuments.length === 0 ? <div className="p-12 text-center"><FileText className="w-10 h-10 text-slate-700 mx-auto" /><h3 className="text-sm font-semibold text-white mt-4">No policy documents found</h3><p className="text-xs text-slate-500 mt-2">Documents uploaded by an administrator will appear here.</p></div> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-slate-950/70"><tr className="text-[11px] uppercase tracking-wider text-slate-500"><th className="px-5 py-3">Document</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Version</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Uploaded By</th><th className="px-5 py-3">Action</th></tr></thead>
            <tbody className="divide-y divide-slate-800">{latestDocuments.map((document) => <tr key={document.document_id} className="hover:bg-slate-800/30"><td className="px-5 py-4"><div className="flex items-center gap-3"><FileText className="w-4 h-4 text-sky-400" /><div><p className="text-sm font-medium text-slate-200">{document.document_name}</p><p className="text-[11px] text-slate-500">{document.filename}</p></div></div></td><td className="px-5 py-4 text-xs text-slate-300 uppercase">{document.document_type}</td><td className="px-5 py-4 text-xs text-slate-300">v{document.version}</td><td className="px-5 py-4 text-xs text-emerald-300">{document.status}</td><td className="px-5 py-4 text-xs text-slate-400">{document.uploaded_by}</td><td className="px-5 py-4"><button type="button" onClick={() => openDetails(document)} className="inline-flex items-center gap-1.5 rounded-lg border border-sky-700 bg-sky-950 px-3 py-2 text-[11px] font-semibold text-sky-200 hover:bg-sky-900"><BookOpen className="w-3.5 h-3.5" />Read Document</button></td></tr>)}</tbody>
          </table></div>
        )}
      </div>

      {selectedDocument && <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setSelectedDocument(null)}><div className="w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 p-6 border-b border-slate-800"><div><h2 className="text-lg font-bold text-white">{selectedDocument.document_name}</h2><p className="text-xs text-slate-500 mt-1">Actual document content · {selectedDocument.filename} · v{selectedDocument.version}</p></div><button type="button" onClick={() => setSelectedDocument(null)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400"><X className="w-4 h-4" /></button></div>
        <div className="max-h-[calc(92vh-95px)] overflow-y-auto p-6 space-y-6">
          {contentLoading ? <div className="py-16 text-center text-sm text-slate-400">Opening PDF document...</div> : <>
            {pdfUrl && <div className="rounded-xl border border-slate-700 bg-white overflow-hidden"><iframe title={`PDF document: ${selectedDocument.filename}`} src={pdfUrl} className="w-full h-[70vh]" /></div>}
            {pages.length > 0 && <div className="space-y-5"><h3 className="text-sm font-semibold text-white">Extracted Document Text</h3>{pages.map((page) => <section key={page.page_number} className="rounded-xl border border-slate-800 bg-slate-950 p-5"><div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-sky-400">Page {page.page_number}</div><p className="whitespace-pre-wrap text-sm leading-7 text-slate-200">{page.text}</p></section>)}</div>}
            {!pdfUrl && pages.length === 0 && <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">{contentError || 'Unable to open this PDF document.'}</div>}
          </>}

          <div className="border-t border-slate-800 pt-5"><h3 className="text-sm font-semibold text-white flex items-center gap-2"><History className="w-4 h-4 text-indigo-400" />Version History</h3>{historyLoading ? <p className="text-xs text-slate-500 mt-3">Loading...</p> : history.length === 0 ? <p className="text-xs text-slate-500 mt-3">No version history available.</p> : <div className="mt-3 space-y-2">{history.map((item) => <div key={item.document_id} className="flex justify-between gap-3 rounded-xl bg-slate-950 p-3"><span className="text-xs text-slate-200">Version {item.version} · {item.filename}</span><span className="text-[11px] text-slate-500">{item.status}</span></div>)}</div>}</div>
        </div>
      </div></div>}
    </div>
  );
};
