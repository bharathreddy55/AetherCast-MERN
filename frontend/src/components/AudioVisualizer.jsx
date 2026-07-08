import React, { useEffect, useRef } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { useTheme } from '../context/ThemeContext';

export default function AudioVisualizer() {
  const { analyser, isPlaying } = usePlayer();
  const { visualizerStyle } = useTheme();
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    // If visualizer is disabled, don't execute any rendering loop
    if (visualizerStyle === 'off') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // We want 16 frequency bands for a clean, spaced-out visualizer
    const barCount = 16;
    const dataArray = new Uint8Array(barCount);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      if (visualizerStyle === 'wave') {
        // Draw smooth flowing sine wave
        ctx.lineWidth = 2.5;

        // Use primary color variable from the root
        const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#10b981';
        ctx.strokeStyle = primaryColor;

        let avgFreq = 0;
        if (analyser && isPlaying) {
          const tempArray = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(tempArray);
          const sum = tempArray.reduce((acc, val) => acc + val, 0);
          avgFreq = sum / tempArray.length;
        } else {
          avgFreq = isPlaying ? 35 : 5; // Idle frequency height
        }

        // Draw sine wave path
        const amplitude = Math.max(2, (avgFreq / 255) * height * 0.9);
        const frequency = 0.08;
        const speed = Date.now() * 0.005;

        ctx.beginPath();
        for (let xCoord = 0; xCoord < width; xCoord++) {
          const yCoord = height / 2 + Math.sin(xCoord * frequency + speed) * amplitude;
          if (xCoord === 0) {
            ctx.moveTo(xCoord, yCoord);
          } else {
            ctx.lineTo(xCoord, yCoord);
          }
        }
        ctx.stroke();
      } else {
        // Classic bouncing vertical neon bars ('bars' default)
        if (analyser && isPlaying) {
          // Query frequency bin data
          const tempArray = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(tempArray);
          
          // Map high/low bins down to our 16 bars
          for (let i = 0; i < barCount; i++) {
            dataArray[i] = tempArray[i * 2] || 0;
          }
        } else {
          // Idle animation waves when paused
          for (let i = 0; i < barCount; i++) {
            const wave = Math.sin(Date.now() * 0.003 + i * 0.5) * 4 + 4;
            dataArray[i] = isPlaying ? wave * 10 : 2;
          }
        }

        const barWidth = width / barCount;
        let x = 0;

        for (let i = 0; i < barCount; i++) {
          const percent = dataArray[i] / 255;
          const barHeight = Math.max(2, percent * height * 0.95);

          // Get primary styles dynamically from root
          const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#10b981';
          const primaryHover = getComputedStyle(document.documentElement).getPropertyValue('--color-primary-hover').trim() || '#059669';

          const gradient = ctx.createLinearGradient(x, height, x, height - barHeight);
          gradient.addColorStop(0, primaryColor); 
          gradient.addColorStop(1, primaryHover);

          ctx.fillStyle = gradient;
          
          ctx.beginPath();
          ctx.roundRect(x, height - barHeight, barWidth - 2, barHeight, 2);
          ctx.fill();

          x += barWidth;
        }
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser, isPlaying, visualizerStyle]);

  if (visualizerStyle === 'off') {
    return null;
  }

  return (
    <canvas 
      ref={canvasRef} 
      width={70} 
      height={30} 
      style={{ display: 'block', opacity: 0.85, borderRadius: '4px' }}
      title="Real-time Audio Frequencies"
    />
  );
}
