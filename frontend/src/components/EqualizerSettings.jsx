import React, { useId } from 'react';
import { usePlayer } from '../context/PlayerContext';

export default function EqualizerSettings() {
  const { eqGains, eqPreset, changeEqualizer, applyPreset } = usePlayer();
  const id = useId();
  return <section className="music-equalizer" aria-labelledby={`${id}-title`}>
    <div className="music-equalizer-heading"><h3 id={`${id}-title`}>Equalizer</h3><button type="button" onClick={() => applyPreset('flat')}>Reset equalizer</button></div>
    <label className="music-audio-quality">EQ preset<select value={eqPreset} onChange={event => applyPreset(event.target.value)}>
      <option value="flat">Flat</option><option value="music">Music</option><option value="bass-boost">Bass boost</option><option value="voice-clarity">Voice clarity</option><option value="classic-podcast">Classic podcast</option><option value="custom" disabled>Custom</option>
    </select></label>
    {Object.entries({ low: 'Bass', mid: 'Mid', high: 'Treble' }).map(([band, title]) => <label className="music-equalizer-band" key={band}>
      <span>{title}<output>{eqGains[band] > 0 ? '+' : ''}{eqGains[band]} dB</output></span>
      <input type="range" aria-label={`${title} gain`} min="-10" max="10" step="1" value={eqGains[band]} onChange={event => changeEqualizer(band, Number(event.target.value))} />
    </label>)}
    <p>Saved on this browser for music and podcasts. Changes apply when browser audio processing is available.</p>
  </section>;
}
