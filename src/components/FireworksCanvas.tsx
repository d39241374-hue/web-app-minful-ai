import { useEffect, useRef } from 'react';

interface FireworksCanvasProps {
  triggerKey: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export function FireworksCanvas({ triggerKey }: FireworksCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (triggerKey <= 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const palette = ['#10B981', '#06B6D4', '#6366F1', '#F59E0B', '#EC4899', '#A855F7'];
    const particles: Particle[] = [];

    const spawnBurst = (cx: number, cy: number) => {
      for (let i = 0; i < 42; i++) {
        const angle = (Math.PI * 2 * i) / 42 + Math.random() * 0.2;
        const speed = 2.2 + Math.random() * 5.2;
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.2,
          life: 0,
          maxLife: 46 + Math.random() * 24,
          color: palette[Math.floor(Math.random() * palette.length)],
          size: 2.2 + Math.random() * 2.4,
        });
      }
    };

    spawnBurst(canvas.width * 0.32, canvas.height * 0.35);
    spawnBurst(canvas.width * 0.68, canvas.height * 0.32);
    const midTimer = window.setTimeout(() => {
      spawnBurst(canvas.width * 0.5, canvas.height * 0.28);
    }, 220);

    let rafId = 0;
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += 1;
        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
          continue;
        }
        p.vy += 0.09;
        p.vx *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        const alpha = 1 - p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (particles.length > 0) {
        rafId = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      window.clearTimeout(midTimer);
      cancelAnimationFrame(rafId);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [triggerKey]);

  if (triggerKey <= 0) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 z-[85] pointer-events-none w-full h-full"
    />
  );
}
