
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FileText,
    Plus,
    Trash2,
    Upload,
    Loader2,
    ChevronRight,
    ChevronDown,
    AlertCircle,
    CheckCircle2,
    User,
    DollarSign,
    Clock,
    MapPin,
    FileUp,
    X,
    Sparkles,
    Linkedin
} from 'lucide-react';

import { createManualImport } from '@/utils/api/conversationApiV2';

interface CandidateEntry {
    id: string;
    linkedin_url: string;
    expected_salary: string;
    current_salary: string;
    notice_period: string;
    preferred_location: string;
    notes: string;
    resume_file: File | null;
    resume_filename: string;
    isValid: boolean;
    error?: string;
}

const createEmptyCandidate = (): CandidateEntry => ({
    id: `cand_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    linkedin_url: '',
    expected_salary: '',
    current_salary: '',
    notice_period: '',
    preferred_location: '',
    notes: '',
    resume_file: null,
    resume_filename: '',
    isValid: false,
});

export function ManualImportPanel() {
    const router = useRouter();
    const { token } = useAuth();

    // JD State
    const [jdText, setJdText] = useState('');
    const [jdFile, setJdFile] = useState<File | null>(null);
    const [pipelineName, setPipelineName] = useState('');

    // Candidates State
    const [candidates, setCandidates] = useState<CandidateEntry[]>([createEmptyCandidate()]);

    // UI State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedCandidate, setExpandedCandidate] = useState<string | null>(candidates[0].id);

    // Validate LinkedIn URL
    const validateLinkedInUrl = (url: string): boolean => {
        if (!url.trim()) return false;
        const pattern = /^(https?:\/\/)?(www\.)?linkedin\.com\/in\/[\w-]+\/?$/i;
        return pattern.test(url.trim());
    };

    // Update candidate
    const updateCandidate = (id: string, field: keyof CandidateEntry, value: any) => {
        setCandidates(prev => prev.map(c => {
            if (c.id !== id) return c;

            const updated = { ...c, [field]: value };

            // Validate on URL change
            if (field === 'linkedin_url') {
                const isValid = validateLinkedInUrl(value);
                updated.isValid = isValid;
                updated.error = isValid || !value.trim() ? undefined : 'Invalid LinkedIn URL format';
            }

            return updated;
        }));
    };

    // Add candidate
    const addCandidate = () => {
        const newCandidate = createEmptyCandidate();
        setCandidates(prev => [...prev, newCandidate]);
        setExpandedCandidate(newCandidate.id);
    };

    // Remove candidate
    const removeCandidate = (id: string) => {
        if (candidates.length <= 1) return;
        setCandidates(prev => prev.filter(c => c.id !== id));
        if (expandedCandidate === id) {
            setExpandedCandidate(candidates.find(c => c.id !== id)?.id || null);
        }
    };

    // Handle resume upload
    const handleResumeUpload = (id: string, file: File) => {
        if (file.size > 5 * 1024 * 1024) {
            alert('Resume must be less than 5MB');
            return;
        }

        setCandidates(prev => prev.map(c => {
            if (c.id !== id) return c;
            return { ...c, resume_file: file, resume_filename: file.name };
        }));
    };

    // Handle JD file upload
    const handleJdUpload = async (file: File) => {
        setJdFile(file);

        // Read file content
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            setJdText(content);
        };
        reader.readAsText(file);
    };

    // Convert file to base64
    const fileToBase64 = async (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const result = reader.result as string;
                resolve(result.split(',')[1]); // Remove data:... prefix
            };
            reader.onerror = reject;
        });
    };

    // Submit
    const handleSubmit = async () => {
        if (!token) {
            setError('Please login to continue');
            return;
        }

        // Validate
        const validCandidates = candidates.filter(c => c.isValid);

        if (validCandidates.length === 0) {
            setError('Add at least one valid candidate with LinkedIn URL');
            return;
        }

        if (!jdText || jdText.length < 50) {
            setError('Please provide a job description (minimum 50 characters)');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Prepare candidates data
            const candidatesData = await Promise.all(
                validCandidates.map(async (c) => {
                    let resume_base64: string | undefined;

                    if (c.resume_file) {
                        resume_base64 = await fileToBase64(c.resume_file);
                    }

                    return {
                        linkedin_url: c.linkedin_url.trim(),
                        expected_salary: c.expected_salary || undefined,
                        current_salary: c.current_salary || undefined,
                        notice_period: c.notice_period || undefined,
                        preferred_location: c.preferred_location || undefined,
                        notes: c.notes || undefined,
                        resume_base64,
                        resume_filename: c.resume_filename || undefined,
                    };
                })
            );

            // Call API
            const result = await createManualImport(token, {
                jd_text: jdText,
                candidates: candidatesData,
                pipeline_name: pipelineName || undefined,
                auto_scrape: true,
            });

            // Navigate to results page
            router.push(`/results/${result.session_id}`);

        } catch (err: any) {
            setError(err.message || 'Import failed');
        } finally {
            setLoading(false);
        }
    };

    const validCount = candidates.filter(c => c.isValid).length;
    const isFormValid = validCount > 0 && jdText.length >= 50;

    return (
        <div className="px-6 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Left: Job Description */}
                <div className="space-y-6">
                    <div>
                        <h2 className="text-lg font-semibold text-white mb-2">Job Description</h2>
                        <p className="text-[14px] text-white/50">
                            Paste the JD or upload a file. This helps us match and score candidates.
                        </p>
                    </div>

                    {/* Pipeline Name */}
                    <div>
                        <label className="block text-[13px] text-white/60 mb-2">
                            Pipeline Name (optional)
                        </label>
                        <input
                            type="text"
                            value={pipelineName}
                            onChange={(e) => setPipelineName(e.target.value)}
                            placeholder="e.g., Senior Engineers - Dec 2024"
                            className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-[14px] text-white placeholder-white/30 focus:outline-none focus:border-white/20 transition-colors"
                        />
                    </div>

                    {/* JD Upload Area */}
                    <div className="border-2 border-dashed border-white/[0.1] rounded-xl p-6 hover:border-white/20 transition-colors">
                        <input
                            type="file"
                            accept=".txt,.pdf,.doc,.docx"
                            onChange={(e) => e.target.files?.[0] && handleJdUpload(e.target.files[0])}
                            className="hidden"
                            id="jd-upload"
                        />
                        <label htmlFor="jd-upload" className="cursor-pointer text-center block">
                            <FileUp className="w-10 h-10 text-white/30 mx-auto mb-3" />
                            <p className="text-[14px] text-white/60">
                                {jdFile ? (
                                    <span className="text-green-400">{jdFile.name}</span>
                                ) : (
                                    'Drop JD file here or click to upload'
                                )}
                            </p>
                            <p className="text-[12px] text-white/30 mt-1">
                                TXT, PDF, DOC supported
                            </p>
                        </label>
                    </div>

                    {/* JD Text Area */}
                    <div>
                        <label className="block text-[13px] text-white/60 mb-2">
                            Or paste job description directly
                        </label>
                        <textarea
                            value={jdText}
                            onChange={(e) => setJdText(e.target.value)}
                            rows={14}
                            placeholder="Paste the complete job description here...

Include:
- Job title and responsibilities
- Required skills and experience
- Nice-to-have qualifications
- Location requirements
- Any other relevant details"
                            className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-[14px] text-white placeholder-white/30 focus:outline-none focus:border-white/20 resize-none font-mono leading-relaxed transition-colors"
                        />
                        <div className="flex justify-between mt-2">
                            <span className={`text-[12px] ${jdText.length >= 50 ? 'text-white/40' : 'text-white/30'}`}>
                                {jdText.length} characters {jdText.length < 50 && '(min 50)'}
                            </span>
                            {jdText.length >= 50 && (
                                <span className="text-[12px] text-green-400 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Valid
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Candidates */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-white mb-1">Candidates</h2>
                            <p className="text-[14px] text-white/50">
                                Add candidates with their LinkedIn profile URLs
                            </p>
                        </div>
                        <div className={`text-[14px] ${validCount > 0 ? 'text-green-400' : 'text-white/40'}`}>
                            {validCount} valid / {candidates.length} total
                        </div>
                    </div>

                    {/* Candidates List */}
                    <div className="space-y-3 max-h-[550px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                        <AnimatePresence>
                            {candidates.map((candidate, index) => (
                                <motion.div
                                    key={candidate.id}
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                                    className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden"
                                >
                                    {/* Candidate Header */}
                                    <div
                                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                                        onClick={() => setExpandedCandidate(
                                            expandedCandidate === candidate.id ? null : candidate.id
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`
                        w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold transition-colors
                        ${candidate.isValid
                                                    ? 'bg-green-500/20 text-green-400'
                                                    : candidate.linkedin_url && !candidate.isValid
                                                        ? 'bg-red-500/20 text-red-400'
                                                        : 'bg-white/[0.06] text-white/40'
                                                }
                      `}>
                                                {candidate.isValid ? (
                                                    <CheckCircle2 className="w-4 h-4" />
                                                ) : (
                                                    index + 1
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-[14px] text-white">
                                                    {candidate.linkedin_url
                                                        ? extractLinkedInUsername(candidate.linkedin_url)
                                                        : 'New Candidate'
                                                    }
                                                </p>
                                                {candidate.isValid && (
                                                    <p className="text-[11px] text-green-400">Valid LinkedIn URL</p>
                                                )}
                                                {candidate.error && (
                                                    <p className="text-[11px] text-red-400">{candidate.error}</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {candidate.resume_file && (
                                                <span className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                                                    Resume
                                                </span>
                                            )}
                                            {candidate.expected_salary && (
                                                <span className="text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded">
                                                    Salary
                                                </span>
                                            )}
                                            {candidates.length > 1 && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); removeCandidate(candidate.id); }}
                                                    className="p-1.5 hover:bg-red-500/10 rounded-lg text-white/40 hover:text-red-400 transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                            {expandedCandidate === candidate.id ? (
                                                <ChevronDown className="w-5 h-5 text-white/40" />
                                            ) : (
                                                <ChevronRight className="w-5 h-5 text-white/40" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Expanded Content */}
                                    <AnimatePresence>
                                        {expandedCandidate === candidate.id && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="border-t border-white/[0.06] overflow-hidden"
                                            >
                                                <div className="p-4 space-y-4">
                                                    {/* LinkedIn URL - Required */}
                                                    <div>
                                                        <label className="flex items-center gap-2 text-[12px] text-white/50 mb-1.5">
                                                            <Linkedin className="w-3.5 h-3.5" />
                                                            LinkedIn URL <span className="text-red-400">*</span>
                                                        </label>
                                                        <input
                                                            type="url"
                                                            value={candidate.linkedin_url}
                                                            onChange={(e) => updateCandidate(candidate.id, 'linkedin_url', e.target.value)}
                                                            placeholder="https://linkedin.com/in/username"
                                                            className={`
                                w-full px-3 py-2.5 bg-white/[0.04] border rounded-lg text-[14px] text-white 
                                placeholder-white/30 focus:outline-none transition-colors
                                ${candidate.error
                                                                    ? 'border-red-500/50 focus:border-red-500'
                                                                    : candidate.isValid
                                                                        ? 'border-green-500/50 focus:border-green-500'
                                                                        : 'border-white/[0.08] focus:border-white/20'
                                                                }
                              `}
                                                        />
                                                    </div>

                                                    {/* Salary Row */}
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="flex items-center gap-2 text-[12px] text-white/50 mb-1.5">
                                                                <DollarSign className="w-3.5 h-3.5" />
                                                                Expected Salary
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={candidate.expected_salary}
                                                                onChange={(e) => updateCandidate(candidate.id, 'expected_salary', e.target.value)}
                                                                placeholder="e.g., 25 LPA"
                                                                className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[14px] text-white placeholder-white/30 focus:outline-none focus:border-white/20 transition-colors"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="flex items-center gap-2 text-[12px] text-white/50 mb-1.5">
                                                                <DollarSign className="w-3.5 h-3.5" />
                                                                Current Salary
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={candidate.current_salary}
                                                                onChange={(e) => updateCandidate(candidate.id, 'current_salary', e.target.value)}
                                                                placeholder="e.g., 20 LPA"
                                                                className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[14px] text-white placeholder-white/30 focus:outline-none focus:border-white/20 transition-colors"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Notice & Location Row */}
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="flex items-center gap-2 text-[12px] text-white/50 mb-1.5">
                                                                <Clock className="w-3.5 h-3.5" />
                                                                Notice Period
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={candidate.notice_period}
                                                                onChange={(e) => updateCandidate(candidate.id, 'notice_period', e.target.value)}
                                                                placeholder="e.g., 30 days, Immediate"
                                                                className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[14px] text-white placeholder-white/30 focus:outline-none focus:border-white/20 transition-colors"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="flex items-center gap-2 text-[12px] text-white/50 mb-1.5">
                                                                <MapPin className="w-3.5 h-3.5" />
                                                                Preferred Location
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={candidate.preferred_location}
                                                                onChange={(e) => updateCandidate(candidate.id, 'preferred_location', e.target.value)}
                                                                placeholder="e.g., Bangalore, Remote"
                                                                className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[14px] text-white placeholder-white/30 focus:outline-none focus:border-white/20 transition-colors"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Notes */}
                                                    <div>
                                                        <label className="flex items-center gap-2 text-[12px] text-white/50 mb-1.5">
                                                            <FileText className="w-3.5 h-3.5" />
                                                            Notes
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={candidate.notes}
                                                            onChange={(e) => updateCandidate(candidate.id, 'notes', e.target.value)}
                                                            placeholder="e.g., Referred by John, strong backend skills"
                                                            className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[14px] text-white placeholder-white/30 focus:outline-none focus:border-white/20 transition-colors"
                                                        />
                                                    </div>

                                                    {/* Resume Upload */}
                                                    <div>
                                                        <label className="flex items-center gap-2 text-[12px] text-white/50 mb-1.5">
                                                            <FileUp className="w-3.5 h-3.5" />
                                                            Resume (optional)
                                                        </label>
                                                        {candidate.resume_file ? (
                                                            <div className="flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                                                <span className="text-[13px] text-blue-400 truncate flex-1">
                                                                    {candidate.resume_filename}
                                                                </span>
                                                                <button
                                                                    onClick={() => {
                                                                        updateCandidate(candidate.id, 'resume_file', null);
                                                                        updateCandidate(candidate.id, 'resume_filename', '');
                                                                    }}
                                                                    className="p-1 hover:bg-white/10 rounded ml-2"
                                                                >
                                                                    <X className="w-4 h-4 text-white/60" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <label className="block">
                                                                <input
                                                                    type="file"
                                                                    accept=".pdf,.doc,.docx"
                                                                    onChange={(e) => e.target.files?.[0] && handleResumeUpload(candidate.id, e.target.files[0])}
                                                                    className="hidden"
                                                                />
                                                                <div className="p-3 border border-dashed border-white/[0.1] rounded-lg text-center cursor-pointer hover:border-white/20 transition-colors">
                                                                    <span className="text-[13px] text-white/40">
                                                                        Click to upload resume (PDF, DOC)
                                                                    </span>
                                                                </div>
                                                            </label>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>

                    {/* Add Candidate Button */}
                    <button
                        onClick={addCandidate}
                        className="w-full py-3 border-2 border-dashed border-white/[0.1] rounded-xl text-[14px] text-white/50 hover:border-white/20 hover:text-white/70 hover:bg-white/[0.02] transition-all flex items-center justify-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Add Another Candidate
                    </button>
                </div>
            </div>

            {/* Error Message */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3"
                    >
                        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                        <p className="text-[14px] text-red-400">{error}</p>
                        <button
                            onClick={() => setError(null)}
                            className="ml-auto p-1 hover:bg-white/10 rounded"
                        >
                            <X className="w-4 h-4 text-red-400" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Submit Button */}
            <div className="mt-8 flex items-center justify-between pt-6 border-t border-white/[0.06]">
                <div className="text-[14px] text-white/50">
                    {isFormValid ? (
                        <span className="text-green-400 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            Ready to import {validCount} candidate{validCount > 1 ? 's' : ''}
                        </span>
                    ) : (
                        <span>
                            {validCount === 0
                                ? 'Add at least one valid LinkedIn URL'
                                : 'Add job description (min 50 chars)'
                            }
                        </span>
                    )}
                </div>

                <motion.button
                    whileHover={{ scale: isFormValid ? 1.02 : 1 }}
                    whileTap={{ scale: isFormValid ? 0.98 : 1 }}
                    onClick={handleSubmit}
                    disabled={loading || !isFormValid}
                    className="px-8 py-3.5 bg-white text-black text-[14px] font-semibold rounded-xl hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg shadow-white/10"
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Importing Candidates...
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-5 h-5" />
                            Import & View Results
                        </>
                    )}
                </motion.button>
            </div>
        </div>
    );
}

// Helper function
function extractLinkedInUsername(url: string): string {
    const match = url.match(/linkedin\.com\/in\/([^/?]+)/i);
    return match ? `@${match[1]}` : url.slice(0, 30) + (url.length > 30 ? '...' : '');
}