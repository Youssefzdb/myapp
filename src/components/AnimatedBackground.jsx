import React from 'react';

export default function AnimatedBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
      <style>{`
        @keyframes vibe-float-a {
          0%   { transform: translate(0, 0) scale(1); }
          50%  { transform: translate(6%, -4%) scale(1.15); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes vibe-float-b {
          0%   { transform: translate(0, 0) scale(1); }
          50%  { transform: translate(-8%, 6%) scale(1.2); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes vibe-float-c {
          0%   { transform: translate(0, 0) scale(1); }
          50%  { transform: translate(4%, 8%) scale(1.1); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes vibe-grid-pan {
          0%   { background-position: 0 0; }
          100% { background-position: 60px 60px; }
        }
      `}</style>

      {/* animated grid */}
      <div
        className="absolute inset-0 opacity-[0.18] dark:opacity-[0.12]"
        style={{
          backgroundImage:
            'linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          animation: 'vibe-grid-pan 14s linear infinite',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />

      {/* floating blobs */}
      <div
        className="absolute -top-32 -right-24 w-[28rem] h-[28rem] rounded-full blur-3xl opacity-30"
        style={{ background: 'radial-gradient(circle, hsl(var(--chart-1) / 0.55), transparent 70%)', animation: 'vibe-float-a 16s ease-in-out infinite' }}
      />
      <div
        className="absolute top-1/3 -left-32 w-[26rem] h-[26rem] rounded-full blur-3xl opacity-25"
        style={{ background: 'radial-gradient(circle, hsl(var(--chart-2) / 0.55), transparent 70%)', animation: 'vibe-float-b 20s ease-in-out infinite' }}
      />
      <div
        className="absolute bottom-0 right-1/4 w-[24rem] h-[24rem] rounded-full blur-3xl opacity-20"
        style={{ background: 'radial-gradient(circle, hsl(var(--chart-4) / 0.55), transparent 70%)', animation: 'vibe-float-c 24s ease-in-out infinite' }}
      />

      {/* top sheen */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary/5 to-transparent" />
    </div>
  );
}