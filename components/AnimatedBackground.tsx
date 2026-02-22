import React, { useEffect, useState } from 'react';

interface Bubble {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  type: 'blast' | 'hide' | 'top';
  delay: number;
  opacity: number;
}

export const AnimatedBackground: React.FC = () => {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);

  const createBubble = (id: number): Bubble => {
    const types: ('blast' | 'hide' | 'top')[] = ['top', 'top', 'blast', 'hide'];
    return {
      id,
      x: Math.random() * 100,
      y: 110, // Start below the screen
      size: 4 + Math.random() * 8, // 4px to 12px
      speed: 10 + Math.random() * 15, // 10-25 seconds to reach top
      type: types[Math.floor(Math.random() * types.length)],
      delay: Math.random() * 10,
      opacity: 0.3 + Math.random() * 0.4
    };
  };

  useEffect(() => {
    // Initial bubbles
    const initialBubbles = Array.from({ length: 30 }, (_, i) => createBubble(i));
    setBubbles(initialBubbles);

    // Periodically recycle bubbles
    const interval = setInterval(() => {
      setBubbles(prev => {
        const now = Date.now();
        // Remove bubbles that are likely finished (older than their speed + delay + some margin)
        const updated = prev.filter(b => (now - b.id) < (b.speed + b.delay + 2) * 1000);

        while (updated.length < 40) {
          updated.push(createBubble(Date.now() + updated.length));
        }
        return updated;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-[-1]">
      {/* Background Layer */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950"></div>

      {/* Red Dot Bubbles */}
      {bubbles.map((bubble) => (
        <div
          key={bubble.id}
          className={`absolute rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)] ${bubble.type === 'blast' ? 'animate-bubble-blast' :
              bubble.type === 'hide' ? 'animate-bubble-hide' :
                'animate-bubble-top'
            }`}
          style={{
            left: `${bubble.x}%`,
            width: `${bubble.size}px`,
            height: `${bubble.size}px`,
            opacity: bubble.opacity,
            animationDuration: `${bubble.speed}s`,
            animationDelay: `${bubble.delay}s`,
            bottom: '-20px'
          } as React.CSSProperties}
        />
      ))}

      <style>{`
        @keyframes bubbleTop {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: var(--tw-bubble-opacity, 0.6); }
          90% { opacity: var(--tw-bubble-opacity, 0.6); }
          100% { transform: translateY(-110vh); opacity: 0; }
        }
        @keyframes bubbleBlast {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          10% { opacity: 0.6; }
          60% { transform: translateY(-50vh) scale(1); opacity: 0.6; }
          65% { transform: translateY(-52vh) scale(2.5); opacity: 1; filter: blur(2px); }
          70% { transform: translateY(-53vh) scale(0); opacity: 0; }
          100% { transform: translateY(-53vh) scale(0); opacity: 0; }
        }
        @keyframes bubbleHide {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 0.6; }
          40% { opacity: 0.6; }
          50% { transform: translateY(-40vh); opacity: 0; }
          100% { transform: translateY(-40vh); opacity: 0; }
        }
        .animate-bubble-top {
          animation: bubbleTop linear infinite;
        }
        .animate-bubble-blast {
          animation: bubbleBlast linear infinite;
        }
        .animate-bubble-hide {
          animation: bubbleHide linear infinite;
        }
      `}</style>
    </div>
  );
};
