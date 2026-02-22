/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Clock, Plus, Trash2, Bell, Settings2, Play, Square, Volume2, Music, Monitor, Download, X, HelpCircle, Share2, Save } from 'lucide-react';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { beeper, type SoundPreset } from './services/beeper';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type AlarmType = 'interval' | 'mark';

interface AlarmRule {
  id: string;
  type: AlarmType;
  intervalMinutes: number;
  markSeconds?: number;
  enabled: boolean;
  label: string;
  sound: SoundPreset;
}

const STORAGE_KEY = 'precision_timer_alarms';

export default function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [alarms, setAlarms] = useState<AlarmRule[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const [newType, setNewType] = useState<AlarmType>('interval');
  const [newInterval, setNewInterval] = useState(5);
  const [newMarkMins, setNewMarkMins] = useState(4);
  const [newMarkSecs, setNewMarkSecs] = useState(0);
  const [newLabel, setNewLabel] = useState('');
  const [newSound, setNewSound] = useState<SoundPreset>('classic');
  const [globalVolume, setGlobalVolume] = useState(1.0);

  const SETTINGS_STORAGE_KEY = 'precision_timer_form_settings';

  // Load form settings on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        if (parsed.newType) setNewType(parsed.newType);
        if (parsed.newInterval) setNewInterval(parsed.newInterval);
        if (parsed.newMarkMins !== undefined) setNewMarkMins(parsed.newMarkMins);
        if (parsed.newMarkSecs !== undefined) setNewMarkSecs(parsed.newMarkSecs);
        if (parsed.newSound) setNewSound(parsed.newSound);
        if (parsed.globalVolume !== undefined) setGlobalVolume(parsed.globalVolume);
      } catch (e) {
        console.error("Failed to load form settings", e);
      }
    }
  }, []);

  // Save form settings when they change
  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
      newType,
      newInterval,
      newMarkMins,
      newMarkSecs,
      newSound,
      globalVolume
    }));
  }, [newType, newInterval, newMarkMins, newMarkSecs, newSound, globalVolume]);

  const lastTriggeredSecond = useRef<number>(-1);

  // Load alarms from LocalStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setAlarms(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load alarms", e);
      }
    }
    setIsInitialLoad(false);
  }, []);

  // Save alarms to LocalStorage whenever they change
  useEffect(() => {
    if (!isInitialLoad) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
    }
  }, [alarms, isInitialLoad]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      checkAlarms(now);
    }, 100);

    return () => clearInterval(timer);
  }, [alarms, isMuted, globalVolume]);

  const checkAlarms = (now: Date) => {
    const currentSecond = Math.floor(now.getTime() / 1000);
    if (currentSecond === lastTriggeredSecond.current) return;

    lastTriggeredSecond.current = currentSecond;

    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    const secondsSinceMidnight = Math.floor((now.getTime() - midnight.getTime()) / 1000);

    alarms.forEach(alarm => {
      if (!alarm.enabled) return;

      const intervalSeconds = alarm.intervalMinutes * 60;
      let triggered = false;

      if (alarm.type === 'interval') {
        if (secondsSinceMidnight % intervalSeconds === 0) {
          triggered = true;
        }
      } else if (alarm.type === 'mark') {
        const markSeconds = alarm.markSeconds || 0;
        if (secondsSinceMidnight % intervalSeconds === markSeconds) {
          triggered = true;
        }
      }

      if (triggered && !isMuted) {
        beeper.play(alarm.sound, globalVolume);
      }
    });
  };

  const getNextTrigger = (alarm: AlarmRule) => {
    const now = currentTime;
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    const secondsSinceMidnight = Math.floor((now.getTime() - midnight.getTime()) / 1000);
    const intervalSeconds = alarm.intervalMinutes * 60;

    let secondsToWait = 0;
    if (alarm.type === 'interval') {
      secondsToWait = intervalSeconds - (secondsSinceMidnight % intervalSeconds);
      if (secondsToWait === intervalSeconds) secondsToWait = 0;
    } else {
      const markSeconds = alarm.markSeconds || 0;
      const currentPosInCycle = secondsSinceMidnight % intervalSeconds;

      if (currentPosInCycle < markSeconds) {
        secondsToWait = markSeconds - currentPosInCycle;
      } else {
        secondsToWait = (intervalSeconds - currentPosInCycle) + markSeconds;
      }
    }

    if (secondsToWait === 0) return "NOW";
    const mins = Math.floor(secondsToWait / 60);
    const secs = secondsToWait % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const addAlarm = (preset?: Partial<AlarmRule>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const markSecs = preset?.markSeconds ?? (newMarkMins * 60 + newMarkSecs);
    const newAlarm: AlarmRule = {
      id,
      type: preset?.type || newType,
      intervalMinutes: preset?.intervalMinutes || newInterval,
      markSeconds: (preset?.type === 'mark' || (!preset && newType === 'mark')) ? markSecs : undefined,
      enabled: true,
      label: preset?.label || newLabel || (newType === 'interval' ? `Every ${newInterval}m` : `At ${Math.floor(markSecs / 60)}m ${markSecs % 60}s of ${newInterval}m cycle`),
      sound: preset?.sound || newSound
    };
    setAlarms([...alarms, newAlarm]);
    setNewLabel('');
  };

  const removeAlarm = (id: string) => {
    setAlarms(alarms.filter(a => a.id !== id));
  };

  const toggleAlarm = (id: string) => {
    setAlarms(alarms.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  };

  const clearAll = () => {
    if (confirm("Are you sure you want to clear all rules?")) {
      setAlarms([]);
    }
  };

  const testBeep = (sound?: SoundPreset) => {
    beeper.play(sound || newSound, globalVolume);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Precision Interval Timer',
          text: 'Check out this professional interval timer web app!',
          url: window.location.href,
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <div className="min-h-screen bg-hardware-bg text-hardware-text p-4 md:p-8 flex flex-col items-center">
      <header className="w-full max-w-4xl flex justify-between items-center mb-12">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-hardware-accent/10 rounded-lg">
            <Clock className="text-hardware-accent w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight uppercase">Precision Timer</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleShare}
            className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full border border-hardware-border text-hardware-muted hover:text-hardware-accent hover:border-hardware-accent transition-all text-xs font-bold uppercase tracking-wider"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
          <button
            onClick={() => setShowInstallGuide(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-hardware-border text-hardware-muted hover:text-hardware-accent hover:border-hardware-accent transition-all text-xs font-bold uppercase tracking-wider"
          >
            <Monitor className="w-4 h-4" />
            Web App
          </button>
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border border-hardware-border bg-hardware-card">
            <Volume2 className="w-4 h-4 text-hardware-muted" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={globalVolume}
              onChange={(e) => {
                setGlobalVolume(parseFloat(e.target.value));
                if (parseFloat(e.target.value) > 0 && isMuted) setIsMuted(false);
              }}
              className="w-24 accent-hardware-accent cursor-pointer"
              title="Global Volume"
            />
          </div>
          <button
            onClick={() => testBeep()}
            className="p-3 rounded-full border border-hardware-border text-hardware-muted hover:text-hardware-accent hover:border-hardware-accent transition-all"
            title="Test Current Sound"
          >
            <Volume2 className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={cn(
              "p-3 rounded-full transition-all border",
              isMuted ? "border-red-500/50 text-red-500 bg-red-500/10" : "border-hardware-border text-hardware-muted hover:text-hardware-accent hover:border-hardware-accent"
            )}
          >
            {isMuted ? <Volume2 className="w-5 h-5 opacity-50" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {showInstallGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-hardware-card border border-hardware-border rounded-3xl p-8 max-w-md w-full relative shadow-2xl">
            <button
              onClick={() => setShowInstallGuide(false)}
              className="absolute top-4 right-4 p-2 text-hardware-muted hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-3 mb-6">
              <Monitor className="text-hardware-accent w-8 h-8" />
              <h2 className="text-xl font-bold uppercase tracking-tight">Web App Deployment</h2>
            </div>
            <div className="space-y-6 text-sm">
              <div className="space-y-2">
                <p className="text-hardware-muted font-bold uppercase text-[10px] tracking-widest">Live Web App</p>
                <p>This application is already a live web app. You can share the current URL with anyone to give them access to the timer.</p>
              </div>
              <div className="space-y-2">
                <p className="text-hardware-muted font-bold uppercase text-[10px] tracking-widest">Cloud Hosting</p>
                <p>To deploy this permanently, you can use the <strong>"Share"</strong> button in the AI Studio interface. This generates a public link that stays active.</p>
              </div>
              <div className="space-y-2">
                <p className="text-hardware-muted font-bold uppercase text-[10px] tracking-widest">Desktop Install (PWA)</p>
                <p>Use your browser's <strong>"Install"</strong> or <strong>"Add to Home Screen"</strong> feature to run this as a standalone desktop application.</p>
              </div>
              <div className="space-y-2">
                <p className="text-hardware-muted font-bold uppercase text-[10px] tracking-widest">Option 3: GitHub Upload</p>
                <p>To host this on GitHub, create a new repository and push the source code. You can then use <strong>GitHub Pages</strong> to host the web app for free.</p>
              </div>
              <button
                onClick={() => setShowInstallGuide(false)}
                className="w-full bg-hardware-accent text-hardware-bg font-bold py-3 rounded-xl mt-4"
              >
                GOT IT
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-8">
          <div className="bg-hardware-card border border-hardware-border rounded-2xl p-8 flex flex-col items-center justify-center relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-hardware-accent to-transparent opacity-50" />
            <div className="text-hardware-muted text-xs font-mono uppercase tracking-[0.2em] mb-4">System Time</div>
            <div className="lcd-display text-6xl md:text-8xl font-bold text-hardware-accent tabular-nums">
              {format(currentTime, 'HH:mm:ss')}
            </div>
            <div className="mt-4 text-hardware-muted font-mono text-sm">
              {format(currentTime, 'EEEE, MMMM do yyyy')}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => addAlarm({ type: 'interval', intervalMinutes: 5, label: '5m Exact Mark', sound: 'ding' })}
              className="bg-hardware-card border border-hardware-border hover:border-hardware-accent p-4 rounded-xl text-left transition-all group"
            >
              <div className="text-[10px] text-hardware-muted uppercase font-bold mb-1">Preset</div>
              <div className="text-sm font-bold group-hover:text-hardware-accent">5m Interval</div>
              <div className="text-[10px] text-hardware-muted font-mono mt-1">:00, :05, :10...</div>
            </button>
            <button
              onClick={() => addAlarm({ type: 'mark', intervalMinutes: 5, markSeconds: 4 * 60, label: '5m Warning Mark', sound: 'pulse' })}
              className="bg-hardware-card border border-hardware-border hover:border-hardware-accent p-4 rounded-xl text-left transition-all group"
            >
              <div className="text-[10px] text-hardware-muted uppercase font-bold mb-1">Preset</div>
              <div className="text-sm font-bold group-hover:text-hardware-accent">4m of 5m Cycle</div>
              <div className="text-[10px] text-hardware-muted font-mono mt-1">:04, :09, :14...</div>
            </button>
          </div>

          <div className="bg-hardware-card border border-hardware-border rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-2 border-b border-hardware-border pb-4">
              <Settings2 className="w-4 h-4 text-hardware-accent" />
              <h2 className="text-sm font-semibold uppercase tracking-wider">Custom Trigger</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-hardware-muted tracking-widest">Trigger Type</label>
                <div className="flex bg-hardware-bg p-1 rounded-lg border border-hardware-border">
                  <button
                    onClick={() => setNewType('interval')}
                    className={cn(
                      "flex-1 py-2 px-3 rounded text-xs font-medium transition-all",
                      newType === 'interval' ? "bg-hardware-accent text-hardware-bg shadow-lg" : "text-hardware-muted hover:text-hardware-text"
                    )}
                  >
                    Interval
                  </button>
                  <button
                    onClick={() => setNewType('mark')}
                    className={cn(
                      "flex-1 py-2 px-3 rounded text-xs font-medium transition-all",
                      newType === 'mark' ? "bg-hardware-accent text-hardware-bg shadow-lg" : "text-hardware-muted hover:text-hardware-text"
                    )}
                  >
                    Cycle Mark
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-hardware-muted tracking-widest">Sound Profile</label>
                <div className="relative">
                  <select
                    value={newSound}
                    onChange={(e) => setNewSound(e.target.value as SoundPreset)}
                    className="w-full bg-hardware-bg border border-hardware-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-hardware-accent appearance-none"
                  >
                    <option value="classic">Classic Square</option>
                    <option value="ding">🔔 Loud Ding</option>
                    <option value="alarm">🚨 Loud Alarm</option>
                    <option value="high">High Sine</option>
                    <option value="low">Low Sine</option>
                    <option value="pulse">Double Pulse</option>
                    <option value="digital">Digital Triangle</option>
                    <option value="chime">✨ Chime</option>
                    <option value="buzzer">💢 Buzzer</option>
                    <option value="sonar">🌊 Sonar</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-hardware-muted">
                    <Music className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-hardware-muted tracking-widest">Label (Optional)</label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Coffee Break"
                className="w-full bg-hardware-bg border border-hardware-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-hardware-accent transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-hardware-muted tracking-widest">
                  {newType === 'interval' ? 'Every X Minutes' : 'Cycle Duration (Minutes)'}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="60"
                    value={newInterval}
                    onChange={(e) => setNewInterval(parseInt(e.target.value))}
                    className="flex-1 accent-hardware-accent"
                  />
                  <span className="font-mono text-hardware-accent w-12 text-right">{newInterval}m</span>
                </div>
              </div>

              {newType === 'mark' && (
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-hardware-muted tracking-widest">Trigger at Mark</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max={newInterval - 1}
                        value={newMarkMins}
                        onChange={(e) => setNewMarkMins(Math.min(newInterval - 1, parseInt(e.target.value) || 0))}
                        className="w-full bg-hardware-bg border border-hardware-border rounded-lg px-2 py-1 text-sm text-center font-mono text-hardware-accent"
                      />
                      <span className="text-[10px] text-hardware-muted uppercase">Min</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={newMarkSecs}
                        onChange={(e) => setNewMarkSecs(Math.min(59, parseInt(e.target.value) || 0))}
                        className="w-full bg-hardware-bg border border-hardware-border rounded-lg px-2 py-1 text-sm text-center font-mono text-hardware-accent"
                      />
                      <span className="text-[10px] text-hardware-muted uppercase">Sec</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => addAlarm()}
              className="w-full bg-hardware-accent hover:bg-hardware-accent/90 text-hardware-bg font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]"
            >
              <Plus className="w-5 h-5" />
              ADD TRIGGER RULE
            </button>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-hardware-muted" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-hardware-muted">Active Rules</h2>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={clearAll}
                className="text-[10px] font-bold text-red-500/70 hover:text-red-500 uppercase tracking-wider transition-colors"
              >
                Clear All
              </button>
              <span className="text-[10px] font-mono bg-hardware-border px-2 py-0.5 rounded text-hardware-muted">
                {alarms.length} TOTAL
              </span>
            </div>
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {alarms.length === 0 ? (
              <div className="border-2 border-dashed border-hardware-border rounded-2xl p-12 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 bg-hardware-border rounded-full flex items-center justify-center mb-4">
                  <Plus className="text-hardware-muted w-6 h-6" />
                </div>
                <p className="text-hardware-muted text-sm">No trigger rules configured yet.</p>
              </div>
            ) : (
              alarms.map((alarm) => (
                <div
                  key={alarm.id}
                  className={cn(
                    "group relative bg-hardware-card border rounded-xl p-4 transition-all hover:border-hardware-accent/50",
                    alarm.enabled ? "border-hardware-border" : "border-hardware-border/30 opacity-60"
                  )}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold tracking-tight">{alarm.label}</h3>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-mono bg-hardware-bg px-2 py-0.5 rounded border border-hardware-border text-hardware-accent">
                          {alarm.type === 'interval' ? 'RECURRING' : 'MARK'}
                        </span>
                        <span className="text-[10px] text-hardware-muted font-mono uppercase">
                          {alarm.type === 'interval' ? `Every ${alarm.intervalMinutes}m` : `At ${Math.floor((alarm.markSeconds || 0) / 60)}m ${(alarm.markSeconds || 0) % 60}s of ${alarm.intervalMinutes}m`}
                        </span>
                        <span className="text-[9px] text-hardware-muted flex items-center gap-1">
                          <Music className="w-2 h-2" /> {alarm.sound}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-end mr-2">
                        <span className="text-[9px] text-hardware-muted uppercase font-bold">Next</span>
                        <span className="text-xs font-mono text-hardware-accent">{alarm.enabled ? getNextTrigger(alarm) : '--:--'}</span>
                      </div>
                      <button
                        onClick={() => toggleAlarm(alarm.id)}
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          alarm.enabled ? "text-hardware-accent bg-hardware-accent/10" : "text-hardware-muted bg-hardware-border"
                        )}
                      >
                        {alarm.enabled ? <Play className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => removeAlarm(alarm.id)}
                        className="p-2 text-hardware-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      <footer className="mt-auto pt-12 pb-6 text-center">
        <p className="text-[10px] font-mono text-hardware-muted uppercase tracking-[0.3em]">
          Precision Interval Engine v1.1.0 // Status: Nominal
        </p>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #333;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #444;
        }
        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { 
          -webkit-appearance: none; 
          margin: 0; 
        }
      `}</style>
    </div>
  );
}
