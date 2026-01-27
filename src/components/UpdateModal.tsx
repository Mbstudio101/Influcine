import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, AlertCircle, Sparkles } from 'lucide-react';
import { AppVersion } from '../types';
import Focusable from './Focusable';

interface UpdateModalProps {
  update: AppVersion;
  onClose: () => void;
  onUpdate: () => void;
}

const UpdateModal: React.FC<UpdateModalProps> = ({ update, onClose, onUpdate }) => {
  const isForced = update.forceUpdate;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-lg bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header Graphic */}
          <div className="h-32 bg-linear-to-r from-primary/20 via-purple-900/20 to-primary/20 flex items-center justify-center relative overflow-hidden">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/20 rounded-full blur-3xl"
            />
            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className="p-3 bg-white/10 rounded-full backdrop-blur-xl border border-white/20 shadow-lg">
                <Sparkles className="text-primary" size={32} />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">New Update Available</h2>
            </div>
          </div>

          {/* Content */}
          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-sm text-gray-400 font-medium uppercase tracking-wider">Version {update.latest}</p>
                <h3 className="text-xl font-bold text-white mt-1">What's New</h3>
              </div>
              {isForced && (
                <div className="px-3 py-1 bg-red-500/20 border border-red-500/20 rounded-full flex items-center gap-2">
                  <AlertCircle size={14} className="text-red-400" />
                  <span className="text-xs font-bold text-red-400 uppercase">Required</span>
                </div>
              )}
            </div>

            <div className="bg-white/5 rounded-xl p-4 mb-8 border border-white/5 max-h-48 overflow-y-auto custom-scrollbar">
              <p className="text-gray-300 whitespace-pre-line leading-relaxed">
                {update.releaseNotes}
              </p>
            </div>

            <div className="flex gap-3">
              <Focusable
                as="button"
                onClick={onUpdate}
                className="flex-1 bg-primary hover:bg-primary-hover text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-primary/25 hover:scale-[1.02]"
                activeClassName="ring-4 ring-primary/50"
                autoFocus
              >
                <Download size={20} />
                {isForced ? 'Update Now' : 'Download Update'}
              </Focusable>

              {!isForced && (
                <Focusable
                  as="button"
                  onClick={onClose}
                  className="px-6 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl font-bold transition-all border border-white/5"
                  activeClassName="ring-4 ring-white/20"
                >
                  Later
                </Focusable>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default UpdateModal;
