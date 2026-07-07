import React, { useEffect, useRef } from 'react';
import { usePlayer } from '../context/PlayerContext';

export default function AudioVisualizer() {
  const { analyser, isPlaying } = usePlayer();
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
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

      // Draw bouncing vertical neon bars
      const barWidth = width / barCount;
      let x = 0;

      for (let i = 0; i < barCount; i++) {
        const percent = dataArray[i] / 255;
        const barHeight = Math.max(2, percent * height * 0.95);

        // Neon color gradient (Neon Purple to Cyan swatches)
        const gradient = ctx.createLinearGradient(x, height, x, height - barHeight);
        gradient.addColorStop(0, '#9333ea'); // Purple
        gradient.addColorStop(1, '#06b6d4'); // Cyan

        ctx.fillStyle = gradient;
        
        // Rounded bars
        ctx.beginPath();
        // ctx.roundRect(x, y, width, height, radius)
        ctx.roundRect(x, height - barHeight, barWidth - 2, barHeight, 2);
        ctx.fill();

        x += barWidth;
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser, isPlaying]);

  return (
    <canvas 
      ref={canvasRef} 
      width={70} 
      height={30} 
      style={{ display: 'block', opacity: 0.8, borderRadius: '4px' }}
      title="Real-time Audio Frequencies"
    />
  );
}
