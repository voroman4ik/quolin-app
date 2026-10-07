'use client';

import { DemoProvider } from '@/components/demo-state';
import { Phone } from '@/components/Phone';
import { Guide, UnderTheHood } from '@/components/Panels';

export default function Page() {
  return (
    <DemoProvider>
      <main className="stage">
        <Guide />
        <Phone />
        <UnderTheHood />
      </main>
    </DemoProvider>
  );
}
