'use client';

import { useState } from 'react';
import { Download, Loader2, CheckCircle2 } from 'lucide-react';

interface ExportButtonProps {
    sessionId: string;
    includeEnrichment?: boolean;
}

export default function ExportButton({ sessionId, includeEnrichment = true }: ExportButtonProps) {
    const [isExporting, setIsExporting] = useState(false);
    const [exportSuccess, setExportSuccess] = useState(false);

    const handleExport = async () => {
        setIsExporting(true);
        setExportSuccess(false);

        try {
            const token = localStorage.getItem('token');
            const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

            const response = await fetch(
                `${apiBaseUrl}/results/${sessionId}/export?format=csv&include_enrichment=${includeEnrichment}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (!response.ok) throw new Error('Export failed');

            // Download file
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `candidates_${sessionId}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            setExportSuccess(true);
            setTimeout(() => setExportSuccess(false), 3000);
        } catch (error) {
            console.error('Export error:', error);
            alert('Failed to export. Please try again.');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <button
            onClick={handleExport}
            disabled={isExporting}
            className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors ${exportSuccess
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
            {isExporting ? (
                <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Exporting...
                </>
            ) : exportSuccess ? (
                <>
                    <CheckCircle2 className="w-4 h-4" />
                    Downloaded!
                </>
            ) : (
                <>
                    <Download className="w-4 h-4" />
                    Export CSV
                </>
            )}
        </button>
    );
}