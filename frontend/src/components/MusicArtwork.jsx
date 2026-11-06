import React, { useState } from 'react';
import { Music2 } from 'lucide-react';
import { artworkHue } from '../lib/listeningInterface';
import './MusicArtwork.css';

export default function MusicArtwork({ src, title = '', className = '', eager = false }) {
  const [failed, setFailed] = useState(null);
  const url = src ? window.getMediaUrl(src) : '';
  return <span className={`music-artwork ${className}`} style={{ '--art-hue': artworkHue(title) }}>
    {url && failed !== url ? <img src={url} alt="" referrerPolicy="no-referrer" loading={eager ? 'eager' : 'lazy'} onError={() => setFailed(url)} /> : <Music2 aria-hidden="true" />}
  </span>;
}
