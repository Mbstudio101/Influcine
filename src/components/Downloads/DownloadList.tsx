import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Trash2, Play } from 'lucide-react';
import { downloadService } from '../../services/downloadService';
import Focusable from '../Focusable';
import { useToast } from '../../context/toast';

const DownloadList: React.FC = () => {
  const { showToast } = useToast();

  const { data: downloads = [], refetch } = useQuery({
    queryKey: ['downloads'],
    queryFn: async () => {
      const items = await downloadService.getDownloads();
      return [...items];
    },
    refetchInterval: 1000, // Poll every second for progress updates
  });

  const handleDelete = async (id: string) => {
    await downloadService.removeDownload(id);
    refetch();
    showToast('Download removed', 'info');
  };

  if (downloads.length === 0) {
    return (
      <div className="text-center py-12 bg-white/5 rounded-2xl border border-white/10">
        <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Download size={32} className="text-gray-400" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">No Downloads</h3>
        <p className="text-gray-400 max-w-md mx-auto">
          Movies and shows you download will appear here for offline viewing.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {downloads.map((item) => (
        <div key={item.id} className="bg-white/5 rounded-xl border border-white/10 overflow-hidden flex">
          <div className="w-24 bg-gray-800">
            {item.posterPath ? (
               <img src={`https://image.tmdb.org/t/p/w200${item.posterPath}`} alt={item.title} className="w-full h-full object-cover" />
            ) : (
               <div className="w-full h-full flex items-center justify-center text-gray-500">?</div>
            )}
          </div>
          <div className="flex-1 p-4 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-white line-clamp-1">{item.title}</h4>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  item.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                  item.status === 'downloading' ? 'bg-blue-500/20 text-blue-400' :
                  item.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {item.status.toUpperCase()}
                </span>
                {item.size && <span className="text-xs text-gray-500">{(item.size / 1024 / 1024).toFixed(1)} MB</span>}
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-2">
              <Focusable
                as="button"
                onClick={() => handleDelete(item.id)}
                className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
              >
                <Trash2 size={16} />
              </Focusable>
              {item.status === 'completed' && (
                <Focusable
                  as="button"
                  className="p-2 bg-primary hover:bg-primary-hover rounded-lg text-white transition-colors"
                >
                  <Play size={16} fill="currentColor" />
                </Focusable>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DownloadList;
