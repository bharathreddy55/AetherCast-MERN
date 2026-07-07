import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Download, Trash2, Activity } from 'lucide-react';

export default function RecordingBooth({ onRecordingComplete }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedUrl, setRecordedUrl] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [visualData, setVisualData] = useState(new Array(32).fill(2));

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const audioCtxRef = useRef(null);
  const playbackRef = useRef(null);
  const canvasRef = useRef(null);

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Setup analyser for live waveform
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
        if (onRecordingComplete) onRecordingComplete(blob);
      };

      recorder.start(100);
      setIsRecording(true);
      setIsPaused(false);
      setRecordedBlob(null);
      setRecordedUrl(null);
      setElapsed(0);

      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);

      drawLiveWaveform();
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Microphone access is required to use the Recording Booth. Please allow microphone permissions.');
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
    }
    clearInterval(timerRef.current);
    cancelAnimationFrame(animFrameRef.current);
    setIsRecording(false);
    setIsPaused(false);
    setVisualData(new Array(32).fill(2));
  };

  // Pause / Resume
  const togglePauseResume = () => {
    if (!mediaRecorderRef.current) return;
    if (isPaused) {
      mediaRecorderRef.current.resume();
      timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);
      setIsPaused(false);
      drawLiveWaveform();
    } else {
      mediaRecorderRef.current.pause();
      clearInterval(timerRef.current);
      cancelAnimationFrame(animFrameRef.current);
      setIsPaused(true);
    }
  };

  // Live waveform drawing
  const drawLiveWaveform = () => {
    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      if (!analyserRef.current) return;

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      setVisualData(Array.from(dataArray));
    };
    draw();
  };

  // Playback recorded audio
  const togglePlayback = () => {
    if (!recordedUrl) return;

    if (isPlaying && playbackRef.current) {
      playbackRef.current.pause();
      setIsPlaying(false);
      return;
    }

    const audio = new Audio(recordedUrl);
    playbackRef.current = audio;
    audio.onended = () => setIsPlaying(false);
    audio.play();
    setIsPlaying(true);
  };

  // Discard
  const discardRecording = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setElapsed(0);
  };

  // Download
  const downloadRecording = () => {
    if (!recordedBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(recordedBlob);
    a.download = `recording-${Date.now()}.webm`;
    a.click();
  };

  // Cleanup
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') audioCtxRef.current.close();
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, []);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const barCount = 32;

  return (
    <div className="recording-booth glass-panel" style={{ padding: '32px', borderRadius: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <Activity size={22} style={{ color: 'var(--color-primary-hover)' }} />
        <h3 style={{ margin: 0 }}>Recording Booth</h3>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '28px' }}>
        Record audio directly from your browser microphone. The waveform visualizer reacts in real-time to your voice!
      </p>

      {/* Live Waveform Visualizer */}
      <div
        style={{
          height: '100px',
          borderRadius: '12px',
          background: 'rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: '3px',
          padding: '12px 16px',
          marginBottom: '24px',
          overflow: 'hidden',
        }}
      >
        {visualData.slice(0, barCount).map((val, i) => {
          const height = Math.max(3, (val / 255) * 80);
          return (
            <div
              key={i}
              style={{
                width: `${100 / barCount - 1}%`,
                height: `${height}px`,
                borderRadius: '2px',
                background: isRecording
                  ? `linear-gradient(to top, #ef4444, #f97316)`
                  : `linear-gradient(to top, #9333ea, #06b6d4)`,
                transition: 'height 0.08s ease-out',
              }}
            />
          );
        })}
      </div>

      {/* Timer */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: '2.2rem',
            fontWeight: '700',
            color: isRecording ? '#ef4444' : 'var(--text-primary)',
            letterSpacing: '4px',
          }}
        >
          {formatTime(elapsed)}
        </span>
        {isRecording && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              marginLeft: '16px',
              color: '#ef4444',
              fontSize: '0.8rem',
              fontWeight: '600',
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s infinite' }} />
            {isPaused ? 'PAUSED' : 'RECORDING'}
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '24px' }}>
        {!isRecording && !recordedBlob && (
          <button
            onClick={startRecording}
            className="btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 28px',
              fontSize: '0.95rem',
              borderRadius: '50px',
            }}
          >
            <Mic size={20} />
            <span>Start Recording</span>
          </button>
        )}

        {isRecording && (
          <>
            <button
              onClick={togglePauseResume}
              className="btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                borderRadius: '50px',
              }}
            >
              {isPaused ? <Play size={18} /> : <Pause size={18} />}
              <span>{isPaused ? 'Resume' : 'Pause'}</span>
            </button>
            <button
              onClick={stopRecording}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                borderRadius: '50px',
                background: '#ef4444',
                color: '#fff',
                border: 0,
                cursor: 'pointer',
                fontWeight: '600',
              }}
            >
              <Square size={18} />
              <span>Stop</span>
            </button>
          </>
        )}
      </div>

      {/* Playback Controls (after recording) */}
      {recordedBlob && !isRecording && (
        <div
          style={{
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '12px',
            padding: '20px',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
            Recording complete! ({formatTime(elapsed)}) — Preview, download, or re-record.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={togglePlayback}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem' }}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              <span>{isPlaying ? 'Pause' : 'Preview'}</span>
            </button>
            <button
              onClick={downloadRecording}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem' }}
            >
              <Download size={16} />
              <span>Download</span>
            </button>
            <button
              onClick={discardRecording}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                cursor: 'pointer',
              }}
            >
              <Trash2 size={16} />
              <span>Discard</span>
            </button>
            <button
              onClick={startRecording}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem' }}
            >
              <Mic size={16} />
              <span>Re-record</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
