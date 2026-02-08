import React, { useState, useEffect } from 'react';
import { errorAgent } from '../services/errorAgent';
import { X, Trash2, Copy, Bug, ChevronDown, ChevronUp } from 'lucide-react';

interface LogEntry {
  id: number;
  timestamp: number;
  message: string;
  type: 'ERROR' | 'WARN' | 'INFO' | 'CRITICAL';
  stack?: string;
  context?: Record<string, unknown>;
}

const BugReporter: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    const unsubscribe = errorAgent.subscribe((log) => {
      const newEntry: LogEntry = {
        id: Date.now() + Math.random(),
        timestamp: Date.now(),
        message: log.message,
        type: (log.type || 'ERROR') as LogEntry['type'],
        stack: log.stack,
        context: log.context
      };

      setLogs((prev) => [newEntry, ...prev].slice(0, 50)); // Keep last 50
      
      // Auto-open on critical errors
      if (log.type === 'CRITICAL') {
        setIsVisible(true);
      }
    });

    // Keyboard shortcut: Ctrl+Shift+D (Debug)
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            setIsVisible(prev => !prev);
        }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Custom Event Listener
    const handleOpenEvent = () => setIsVisible(true);
    window.addEventListener('open-bug-reporter', handleOpenEvent);

    return () => {
        unsubscribe();
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('open-bug-reporter', handleOpenEvent);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div className={`fixed z-9999 bg-slate-900 border border-slate-700 shadow-2xl transition-all duration-300 ${
        isMinimized 
        ? 'bottom-4 right-4 w-64 h-12 rounded-lg' 
        : 'bottom-4 right-4 w-[600px] h-[400px] rounded-xl flex flex-col'
    }`}>
      {/* Header */}
      <div 
        className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 cursor-pointer rounded-t-xl"
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="flex items-center gap-2 font-mono text-sm font-bold text-slate-200">
            <Bug size={16} className={logs.length > 0 ? 'text-red-400' : 'text-green-400'} />
            Bug Catcher ({logs.length})
        </div>
        <div className="flex items-center gap-1">
            <button 
                onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
                className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
            >
                {isMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <button 
                onClick={(e) => { e.stopPropagation(); setIsVisible(false); }}
                className="p-1 hover:bg-red-900/50 rounded text-slate-400 hover:text-red-400"
            >
                <X size={16} />
            </button>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
          <>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 font-mono text-xs">
                {logs.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-500 italic">
                        No bugs caught yet. System healthy.
                    </div>
                ) : (
                    logs.map(log => (
                        <div key={log.id} className={`p-2 rounded border ${
                            log.type === 'CRITICAL' ? 'bg-red-950/30 border-red-900 text-red-200' :
                            log.type === 'ERROR' ? 'bg-red-900/20 border-red-800 text-red-300' :
                            log.type === 'WARN' ? 'bg-yellow-900/20 border-yellow-800 text-yellow-300' :
                            'bg-slate-800 border-slate-700 text-slate-300'
                        }`}>
                            <div className="flex justify-between opacity-50 text-[10px] mb-1">
                                <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                                <span className="font-bold">{log.type}</span>
                            </div>
                            <div className="wrap-break-word font-semibold">{log.message}</div>
                            {log.stack && (
                                <details className="mt-1">
                                    <summary className="cursor-pointer opacity-50 hover:opacity-100">Stack Trace</summary>
                                    <pre className="mt-1 p-2 bg-black/30 rounded overflow-x-auto whitespace-pre-wrap text-[10px] opacity-70">
                                        {log.stack}
                                    </pre>
                                </details>
                            )}
                             {log.context && (
                                <details className="mt-1">
                                    <summary className="cursor-pointer opacity-50 hover:opacity-100">Context</summary>
                                    <pre className="mt-1 p-2 bg-black/30 rounded overflow-x-auto whitespace-pre-wrap text-[10px] opacity-70">
                                        {JSON.stringify(log.context, null, 2)}
                                    </pre>
                                </details>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Footer */}
            <div className="p-2 bg-slate-800 border-t border-slate-700 flex justify-between">
                <button 
                    onClick={() => setLogs([])}
                    className="flex items-center gap-1 px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-xs text-white transition-colors"
                >
                    <Trash2 size={12} />
                    Clear
                </button>
                <button 
                    onClick={() => {
                        const text = logs.map(l => `[${new Date(l.timestamp).toISOString()}] [${l.type}] ${l.message}\n${l.stack || ''}`).join('\n---\n');
                        navigator.clipboard.writeText(text);
                        alert('Logs copied to clipboard');
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded bg-primary hover:bg-primary-hover text-xs text-white transition-colors"
                >
                    <Copy size={12} />
                    Copy All
                </button>
            </div>
          </>
      )}
    </div>
  );
};

export default BugReporter;
