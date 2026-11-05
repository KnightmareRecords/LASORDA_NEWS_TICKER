import type { Metadata, Viewport } from 'next';
import { PhoneView } from './phone-view';

export const metadata: Metadata = { title: 'Ticker phone view' };
// Fit the phone screen exactly, no pinch-zoom surprises.
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

/** /phone — open on an iPhone to see the ticker at the size stream viewers see it. */
export default function PhonePage() {
  return <PhoneView />;
}
