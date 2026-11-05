'use client';

import { useEffect, useRef, useState } from 'react';

// The vertical stream canvas in OBS. The ticker is drawn at this size, then the whole frame is shrunk
// to fit the screen, exactly like a phone viewer's player shrinks the stream.
const FRAME_WIDTH = 1080;
const FRAME_HEIGHT = 1920;

export function PhoneView() {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const fit = () => setScale(Math.min(box.clientWidth / FRAME_WIDTH, box.clientHeight / FRAME_HEIGHT));
    // Measure right away (ResizeObserver can be late on a backgrounded tab), then follow rotation/resizes.
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  return (
    <main ref={boxRef} className="fixed inset-0 flex items-center justify-center overflow-hidden bg-black">
      <div
        className="relative overflow-hidden bg-[radial-gradient(circle_at_35%_25%,#26364c,#0b1018_65%)]"
        style={{ width: FRAME_WIDTH * scale, height: FRAME_HEIGHT * scale }}
      >
        <p className="absolute left-0 right-0 top-3 z-10 text-center text-[11px] font-medium text-white/45">
          What viewers see · 1080 × 1920 stream · ticker in the middle
        </p>
        {scale > 0 && (
          <iframe
            title="Ticker as it appears on stream"
            src="/ticker?preview=1"
            width={FRAME_WIDTH}
            height={FRAME_HEIGHT}
            className="absolute left-0 top-0 origin-top-left border-0 bg-transparent"
            style={{ transform: `scale(${scale})` }}
          />
        )}
      </div>
    </main>
  );
}
