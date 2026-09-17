import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

export default function CountdownTimer({ expiresAt, startedAt, onExpire }) {
  const [timeLeft, setTimeLeft] = useState(() => {
    return expiresAt ? Math.max(0, expiresAt - Date.now()) : 0;
  });

  useEffect(() => {
    if (!expiresAt) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, expiresAt - Date.now());
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        if (onExpire) {
          onExpire();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  const totalDuration = (expiresAt && startedAt) ? Math.max(1, expiresAt - startedAt) : 20 * 60 * 1000;
  const progressPercent = Math.min(100, Math.max(0, (timeLeft / totalDuration) * 100));

  const totalSeconds = Math.floor(timeLeft / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const isCritical = totalSeconds <= 120;
  const isWarning = totalSeconds > 120 && totalSeconds <= 300;

  let boxClass = 'bg-white border-2 border-gray-300 text-gray-900';
  let progressColor = 'bg-red-600';
  let iconColor = 'text-red-600';

  if (isCritical) {
    boxClass = 'bg-red-100 border-2 border-red-600 text-red-900';
    progressColor = 'bg-red-600';
    iconColor = 'text-red-700';
  } else if (isWarning) {
    boxClass = 'bg-yellow-100 border-2 border-yellow-500 text-yellow-950';
    progressColor = 'bg-yellow-500';
    iconColor = 'text-yellow-700';
  }

  return (
    <div className="flex flex-col items-center">
      <div className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-sans ${boxClass}`}>
        {isCritical ? (
          <AlertTriangle className={`w-5 h-5 ${iconColor}`} />
        ) : (
          <Clock className={`w-5 h-5 ${iconColor}`} />
        )}
        <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
          Time Remaining:
        </span>
        <span className="font-mono text-xl font-bold tracking-wider">
          {formattedTime}
        </span>
      </div>

      {/* Solid Progress Bar */}
      <div className="w-full mt-1.5 h-2 bg-gray-200 rounded border border-gray-300 overflow-hidden max-w-[210px]">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${progressColor}`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
