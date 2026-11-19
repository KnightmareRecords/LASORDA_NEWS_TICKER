import type { Metadata } from 'next';
import { BreakTab } from './break-tab';

export const metadata: Metadata = { title: 'Break tab' };

/** /break — OBS browser source for the "Break #" tab under the ticker (set in the control panel). */
export default function BreakPage() {
  return <BreakTab />;
}
