


'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Upload, FileText, Loader2 } from 'lucide-react';

interface CreatePipelineModalProps {
    onClose: () => void;
    onCreated: () => void;
}

export function CreatePipelineModal({ onClose, onCreated }: CreatePipelineModalProps) {
    const [mode, setMode] = useState<'search' | 'import'>('search');
    const [loading, setLoading] = useState(false);

    // Import mode state
    const [pipelineName, setPipelineName] = useState('');
    const [jdText, setJdText] = useState('');
    const [csvContent, setCsvContent] = useState('');

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setCsvContent(event.target?.result as string);
            };
            reader.readAsText(file);
        }
    };

    const handleCreate = async () => {
        if (mode === 'import') {
            if (!jdText || !csvContent) return;

            setLoading(true);
            try {
                const response = await fetch('/api/v1/pipeline/create/from-import', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                    },
                    body: JSON.stringify({
                        pipeline_name: pipelineName || undefined,
                        jd_text: jdText,
                        candidates_csv: csvContent,
                    }),
                });

                if (response.ok) {
                    onCreated();
                }
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <>
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                onClick={onClose}
            />

            {/* Modal */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-[#111111] border border-white/[0.08] rounded-2xl z-50 overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
                    <h2 className="text-lg font-semibold text-white">Create Pipeline</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-white/60" />
                    </button>
                </div>

                {/* Mode Selector */}
                <div className="px-6 py-4 border-b border-white/[0.08]">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setMode('search')}
                            className={`
                flex-1 p-4 rounded-xl border transition-all
                ${mode === 'search'
                                    ? 'bg-white/[0.06] border-white/20'
                                    : 'border-white/[0.06] hover:border-white/10'
                                }
              `}
                        >
                            <div className="text-2xl mb-2">🔍</div>
                            <h3 className="text-[14px] font-medium text-white mb-1">From Donna Search</h3>
                            <p className="text-[12px] text-white/40">Use search results from Donna</p>
                        </button>

                        <button
                            onClick={() => setMode('import')}
                            className={`
                flex-1 p-4 rounded-xl border transition-all
                ${mode === 'import'
                                    ? 'bg-white/[0.06] border-white/20'
                                    : 'border-white/[0.06] hover:border-white/10'
                                }
              `}
                        >
                            <div className="text-2xl mb-2">📥</div>
                            <h3 className="text-[14px] font-medium text-white mb-1">Import CSV</h3>
                            <p className="text-[12px] text-white/40">Upload candidate LinkedIn URLs</p>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 py-4 max-h-[400px] overflow-y-auto">
                    {mode === 'search' ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/10 flex items-center justify-center">
                                <FileText className="w-8 h-8 text-blue-400" />
                            </div>
                            <h3 className="text-[15px] font-medium text-white mb-2">
                                Start a Search in Donna
                            </h3>
                            <p className="text-[13px] text-white/50 mb-4">
                                Go to Donna, run a search, and create a pipeline from the results
                            </p>

                            <a href="/donna"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-[13px] font-medium rounded-lg transition-colors"
                            >
                                Open Donna
                            </a>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Pipeline Name */}
                            <div>
                                <label className="block text-[13px] text-white/60 mb-2">
                                    Pipeline Name (optional)
                                </label>
                                <input
                                    type="text"
                                    value={pipelineName}
                                    onChange={(e) => setPipelineName(e.target.value)}
                                    placeholder="e.g., Backend Engineers - Dec 2024"
                                    className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[14px] text-white placeholder-white/30 focus:outline-none focus:border-white/20"
                                />
                            </div>

                            {/* Job Description */}
                            <div>
                                <label className="block text-[13px] text-white/60 mb-2">
                                    Job Description *
                                </label>
                                <textarea
                                    value={jdText}
                                    onChange={(e) => setJdText(e.target.value)}
                                    rows={5}
                                    placeholder="Paste the job description here..."
                                    className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[14px] text-white placeholder-white/30 focus:outline-none focus:border-white/20 resize-none"
                                />
                                <p className="text-[11px] text-white/30 mt-1">Minimum 50 characters</p>
                            </div>

                            {/* CSV Upload */}
                            <div>
                                <label className="block text-[13px] text-white/60 mb-2">
                                    Candidate CSV *
                                </label>
                                <div className="border-2 border-dashed border-white/[0.1] rounded-lg p-6 text-center hover:border-white/20 transition-colors">
                                    <input
                                        type="file"
                                        accept=".csv"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                        id="csv-upload"
                                    />
                                    <label htmlFor="csv-upload" className="cursor-pointer">
                                        <Upload className="w-8 h-8 text-white/30 mx-auto mb-2" />
                                        <p className="text-[13px] text-white/60 mb-1">
                                            Drop CSV here or click to upload
                                        </p>
                                        <p className="text-[11px] text-white/30">
                                            Required columns: linkedin_url
                                        </p>
                                    </label>
                                </div>
                                {csvContent && (
                                    <p className="text-[12px] text-green-400 mt-2">
                                        ✓ CSV uploaded ({csvContent.split('\n').length - 1} candidates)
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {mode === 'import' && (
                    <div className="px-6 py-4 border-t border-white/[0.08] flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-[13px] text-white/60 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={!jdText || !csvContent || jdText.length < 50 || loading}
                            className="px-5 py-2 bg-white text-black text-[13px] font-medium rounded-lg hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                        >
                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                            Create Pipeline
                        </button>
                    </div>
                )}
            </motion.div >
        </>
    );
}