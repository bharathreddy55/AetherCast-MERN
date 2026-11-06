export function audioTechnicalLabel(playback) {
  if (!playback) return 'Audio details unavailable';
  return [playback.variant === 'normalized' ? 'Normalized copy' : playback.variant === 'compatible' ? 'Compatible copy' : playback.variant === 'original' ? 'Original' : 'Audio', playback.format?.toUpperCase(),
    playback.codec, Number.isFinite(playback.bitrate) && playback.bitrate > 0 ? `${Math.round(playback.bitrate / 1000)} kbps` : '',
    Number.isFinite(playback.sampleRate) && playback.sampleRate > 0 ? `${playback.sampleRate / 1000} kHz` : '',
    playback.variant === 'normalized' && loudnessLabel(playback.loudness) ? `${playback.loudness.outputIntegratedLufs.toFixed(1)} LUFS` : ''].filter(Boolean).join(' · ');
}

export function loudnessLabel(value) {
  if (!value || ['inputIntegratedLufs', 'outputIntegratedLufs', 'outputTruePeakDbtp', 'appliedGainDb'].some(field => !Number.isFinite(value[field]))
    || value.mode !== 'linear' || value.targetIntegratedLufs !== -14 || value.maxTruePeakDbtp !== -1
    || value.outputTruePeakDbtp > -1 || value.outputTruePeakDbtp < -99 || value.appliedGainDb < -60 || value.appliedGainDb > 6
    || [value.inputIntegratedLufs, value.outputIntegratedLufs].some(number => number < -70 || number > 5)) return '';
  return `${value.inputIntegratedLufs.toFixed(1)} → ${value.outputIntegratedLufs.toFixed(1)} LUFS · peak ${value.outputTruePeakDbtp.toFixed(1)} dBTP · gain ${value.appliedGainDb > 0 ? '+' : ''}${value.appliedGainDb.toFixed(1)} dB`;
}
