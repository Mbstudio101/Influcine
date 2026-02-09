import React, { useRef, useEffect, useCallback } from 'react';

interface AudioVisualizerProps {
  analyserNode: AnalyserNode | null;
  isPlaying: boolean;
  height?: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  analyserNode,
  isPlaying,
  height = 32
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyserNode) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserNode.getByteFrequencyData(dataArray);

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Draw frequency bars — sample ~40 bars from the spectrum
    const barCount = 40;
    const step = Math.floor(bufferLength / barCount);
    const barWidth = w / barCount;
    const gap = 1;

    for (let i = 0; i < barCount; i++) {
      const value = dataArray[i * step];
      const barHeight = (value / 255) * h;

      // Gradient from primary purple to blue based on frequency position
      const ratio = i / barCount;
      const r = Math.floor(124 + ratio * 30);
      const g = Math.floor(58 + ratio * 80);
      const b = Math.floor(237 - ratio * 40);

      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.6 + (value / 255) * 0.4})`;
      ctx.fillRect(
        i * barWidth + gap / 2,
        h - barHeight,
        barWidth - gap,
        barHeight
      );
    }

    animFrameRef.current = requestAnimationFrame(draw);
  }, [analyserNode]);

  useEffect(() => {
    if (isPlaying && analyserNode) {
      animFrameRef.current = requestAnimationFrame(draw);
    } else {
      cancelAnimationFrame(animFrameRef.current);
    }

    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying, analyserNode, draw]);

  // Resize canvas to match container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  if (!analyserNode) return null;

  return (
    <canvas
      ref={canvasRef}
      className="w-full pointer-events-none opacity-80"
      style={{ height }}
    />
  );
};
