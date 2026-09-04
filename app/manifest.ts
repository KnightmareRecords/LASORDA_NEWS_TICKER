import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Live Ticker Control',
    short_name: 'Live Ticker',
    description: 'Control ESPN and custom headlines for your OBS stream.',
    start_url: '/',
    display: 'standalone',
    background_color: '#080b12',
    theme_color: '#ffb000',
    icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
