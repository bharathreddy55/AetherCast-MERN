export function audioTechnicalLabel(playback) {
  if (!playback) return 'Audio details unavailable';
  return [playback.variant === 'compatible' ? 'Compatible copy' : playback.variant === 'original' ? 'Original' : 'Audio', playback.format?.toUpperCase(),
    playback.codec, Number.isFinite(playback.bitrate) && playback.bitrate > 0 ? `${Math.round(playback.bitrate / 1000)} kbps` : '',
    Number.isFinite(playback.sampleRate) && playback.sampleRate > 0 ? `${playback.sampleRate / 1000} kHz` : ''].filter(Boolean).join(' · ');
}
