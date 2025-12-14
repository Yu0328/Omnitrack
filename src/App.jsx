import React, { useState, useEffect, useMemo, memo, useRef } from 'react';
import { 
  Navigation, MapPin, Users, Settings, Leaf, Compass, 
  UserPlus, Shield, Moon, Sun, X, Battery, Signal, Layers, 
  Trash2, Eye, EyeOff, Send, Lock, AlertCircle, ChevronDown,
  ArrowUp, ArrowDown, UserMinus, Zap, Bell, Volume2, VolumeX,
  Wifi, WifiOff, Smartphone, RefreshCw, Activity, AlertTriangle,
  Download, Share
} from 'lucide-react';

// --- 預設模擬數據 ---
const INITIAL_MOCK_FRIENDS = [
  { id: 1, name: 'Emma', status: 'Shopping', initialDist: 15, initialAngle: 45, floorOffset: 0, avatar: 'bg-pink-500', color: '#ec4899', isSharingWithMe: true, isMeSharing: true, history: [], msg: null, msgExpiry: 0, lastSeen: Date.now() },
  { id: 2, name: 'Liam', status: 'Resting', initialDist: 45, initialAngle: 270, floorOffset: 1, avatar: 'bg-blue-500', color: '#3b82f6', isSharingWithMe: true, isMeSharing: true, history: [], msg: null, msgExpiry: 0, lastSeen: Date.now() },
  { id: 3, name: 'Noah', status: 'Lost?', initialDist: 8, initialAngle: 330, floorOffset: -1, avatar: 'bg-emerald-500', color: '#10b981', isSharingWithMe: false, isMeSharing: true, history: [], msg: null, msgExpiry: 0, lastSeen: Date.now() }, 
  { id: 4, name: 'Olivia', status: 'Coffee', initialDist: 25, initialAngle: 180, floorOffset: 2, avatar: 'bg-purple-500', color: '#a855f7', isSharingWithMe: true, isMeSharing: false, history: [], msg: null, msgExpiry: 0, lastSeen: Date.now() }, 
];

const STATUS_OPTIONS = ['Online', 'Shopping', 'Eating', 'Waiting', 'Restroom', 'Parking', 'Cinema'];
const QUICK_SIGNALS = [{ icon: '👋', label: 'Hi' }, { icon: '🏃', label: 'Coming' }, { icon: '🛑', label: 'Wait' }, { icon: '📍', label: 'Here' }];

const VALID_USER_DB = {
  '100101': { name: 'Alice', avatar: 'bg-orange-500', color: '#f97316', status: 'Just Arrived' },
  '200202': { name: 'Bob', avatar: 'bg-cyan-500', color: '#06b6d4', status: 'Parking' },
  '888888': { name: 'David', avatar: 'bg-teal-500', color: '#14b8a6', status: 'Food Court' },
  '999999': { name: 'Sarah', avatar: 'bg-indigo-500', color: '#6366f1', status: 'Cinema' },
  '123456': { name: 'TestUser', avatar: 'bg-lime-500', color: '#84cc16', status: 'Testing' }
};

// --- Service Layer ---
const BackendService = {
  _delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  joinSession: async (code, myCode) => {
    await BackendService._delay(800);
    if (!code) throw new Error('Please enter a code');
    if (code.length !== 6) throw new Error('Code must be 6 digits');
    if (code === myCode) throw new Error('Cannot add yourself');
    const user = VALID_USER_DB[code];
    if (!user) throw new Error('User not found on cloud server');
    return { id: Date.now(), ...user, initialDist: Math.random() * 50 + 10, initialAngle: Math.random() * 360, floorOffset: 0, isSharingWithMe: true, isMeSharing: true, history: [], msg: null, msgExpiry: 0, lastSeen: Date.now() };
  },
  sendSignal: async (friendId, type, payload) => { return true; },
  updateMyLocation: async (status) => { return true; },
  simulatePhysics: (currentFriends) => {
    const now = Date.now();
    return currentFriends.map(friend => {
        if (Math.random() > 0.98) return friend; 
        let currentMsg = friend.msg;
        if (friend.msgExpiry && now > friend.msgExpiry) currentMsg = null;
        const moveDistDelta = (Math.random() - 0.5) * 2.5; 
        const moveAngleDelta = (Math.random() - 0.5) * 10; 
        let newDist = friend.initialDist + moveDistDelta;
        if (newDist < 2) newDist = 2;
        let newFloor = friend.floorOffset;
        if (Math.random() > 0.998) { newFloor = friend.floorOffset === 0 ? (Math.random() > 0.5 ? 1 : -1) : 0; }
        const newHistory = [...friend.history, { dist: friend.initialDist, angle: friend.initialAngle }];
        if (newHistory.length > 8) newHistory.shift(); 
        return { ...friend, initialDist: newDist, initialAngle: (friend.initialAngle + moveAngleDelta) % 360, floorOffset: newFloor, history: newHistory, msg: currentMsg, lastSeen: now };
    });
  }
};

const playSound = (type, isMuted) => {
  if (isMuted) return; 
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === 'ping') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(800, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.2); gain.gain.setValueAtTime(0.1, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2); osc.start(); osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'msg') {
      osc.type = 'triangle'; osc.frequency.setValueAtTime(600, ctx.currentTime); gain.gain.setValueAtTime(0.05, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1); osc.start(); osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'success') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(400, ctx.currentTime); osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.1); gain.gain.setValueAtTime(0.1, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3); osc.start(); osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) { console.error("Audio failed", e); }
};

const getSmoothPath = (points, center) => {
  if (points.length < 2) return '';
  const cartesianPoints = points.map(p => {
    const r = (p.r / 60) * 225; const angleRad = (p.a - 90) * Math.PI / 180; 
    return { x: center + r * Math.cos(angleRad), y: center + r * Math.sin(angleRad) };
  });
  const p0 = cartesianPoints[0];
  let d = `M ${p0.x} ${p0.y}`;
  for (let i = 1; i < cartesianPoints.length; i++) {
    const p1 = cartesianPoints[i]; d += ` L ${p1.x} ${p1.y}`; 
  }
  return d;
};

// --- Splash Screen ---
const SplashScreen = ({ onFinish, theme }) => {
  useEffect(() => { const timer = setTimeout(onFinish, 2000); return () => clearTimeout(timer); }, []); 
  return (
    <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center ${theme === 'dark' ? 'bg-[#0f172a]' : 'bg-[#fff8e1]'} transition-colors duration-500`}>
      <div className="relative"><div className="w-24 h-24 bg-gradient-to-tr from-violet-600 to-fuchsia-500 rounded-3xl flex items-center justify-center animate-bounce shadow-2xl shadow-violet-500/30"><Navigation size={48} className="text-white" /></div><div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-16 h-2 bg-black/20 rounded-full blur-sm animate-pulse"></div></div>
      <h1 className={`mt-8 text-5xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-stone-800'} animate-pulse`}>D+</h1>
      <p className={`mt-2 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-stone-500'} font-mono`}>READY FOR DEPLOYMENT...</p>
    </div>
  );
};

// --- Components ---
const NavIcon = memo(({ icon: Icon, label, active, onClick, themeStyles }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all duration-300 p-2 cursor-pointer select-none ${active ? `${themeStyles.navActive} scale-110` : `${themeStyles.navInactive} hover:opacity-80`}`} style={{ touchAction: 'manipulation' }}><Icon size={24} strokeWidth={active ? 2.5 : 2} /><span className="text-[10px] font-medium tracking-wide">{label}</span></button>
));
const Navbar = memo(({ activeTab, setActiveTab, currentStyle }) => (
  <div className={`fixed bottom-0 left-0 right-0 ${currentStyle.navBg} backdrop-blur-xl border-t ${currentStyle.border} h-20 flex justify-around items-center px-6 z-50 transition-colors duration-500`}><NavIcon icon={Compass} label="Radar" active={activeTab === 'radar'} onClick={() => setActiveTab('radar')} themeStyles={currentStyle} /><NavIcon icon={Users} label="Friends" active={activeTab === 'friends'} onClick={() => setActiveTab('friends')} themeStyles={currentStyle} /><NavIcon icon={Settings} label="System" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} themeStyles={currentStyle} /></div>
));

const RadarTrails = memo(({ friend, maxRange }) => {
  if (!friend.isSharingWithMe || !friend.history || friend.history.length < 2) return null;
  const center = 225;
  const points = friend.history.map(pos => { const r = (Math.min(pos.dist, maxRange) / maxRange) * 225; const angleRad = (pos.angle - 90) * Math.PI / 180; return { x: center + r * Math.cos(angleRad), y: center + r * Math.sin(angleRad) }; });
  const segments = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i]; const p2 = points[i + 1]; const progress = i / (points.length - 1); const strokeWidth = 0.5 + (progress * 19.5); const opacity = 0.1 + (progress * 0.5);
    segments.push(<g key={`seg-${i}`}><line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={friend.color} strokeWidth={strokeWidth} strokeLinecap="round" opacity={opacity} /></g>);
  }
  return <g>{segments}</g>;
});

const NavigationLine = memo(({ friend, maxRange }) => {
  const scale = (Math.min(friend.initialDist, maxRange) / maxRange) * 225; const height = Math.max(0, scale - 30); const lineColor = friend.color;
  return (<div className="absolute left-1/2 top-1/2 w-0 z-10 pointer-events-none flex flex-col items-center justify-start" style={{ width: '20px', height: `${height}px`, transformOrigin: 'bottom center', transform: `translate(-50%, -100%) rotate(${friend.initialAngle}deg)`, transition: 'height 1000ms linear, transform 1000ms linear', }}><div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[10px] border-l-transparent border-r-transparent" style={{ borderBottomColor: lineColor }} /><div className="w-[2px] flex-1 border-r-2 border-dashed opacity-80" style={{ borderColor: lineColor }} /></div>);
});

const ProximityBeam = memo(({ friend, maxRange }) => {
  if (!friend.isSharingWithMe || friend.initialDist > 8 || friend.floorOffset !== 0) return null;
  const center = 225;
  const r = (Math.min(friend.initialDist, maxRange) / maxRange) * 225;
  const angleRad = (friend.initialAngle - 90) * Math.PI / 180;
  const x = center + r * Math.cos(angleRad);
  const y = center + r * Math.sin(angleRad);
  const beamColor = friend.color;
  return (
    <g>
        <defs>
            <linearGradient id={`beam-${friend.id}`} x1={center} y1={center} x2={x} y2={y} gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor={beamColor} stopOpacity="0.8" />
                <stop offset="100%" stopColor={beamColor} stopOpacity="0" />
            </linearGradient>
        </defs>
        <line x1={center} y1={center} x2={x} y2={y} stroke={`url(#beam-${friend.id})`} strokeWidth="4" strokeDasharray="10,5" className="animate-pulse" />
        <circle cx={center} cy={center} r="4" fill={beamColor} opacity="0.8" />
    </g>
  );
});

const RadarNode = memo(({ friend, maxRange, theme, currentStyle, onClick, isSelected, userHeading, isPinging }) => {
  if (!friend.isSharingWithMe) return null;
  const renderDist = Math.min(friend.initialDist, maxRange); const scale = (renderDist / maxRange) * 225; const isSameFloor = friend.floorOffset === 0; const opacity = (isSameFloor || isSelected) ? 'opacity-100' : 'opacity-50'; const isWeakSignal = friend.initialDist > 45; const signalClass = isWeakSignal ? 'animate-[pulse_0.5s_ease-in-out_infinite] opacity-60' : opacity; const scaleEffect = isSelected ? 'scale-125 z-50' : (isSameFloor ? 'scale-100 z-20' : 'scale-75 z-10');
  return (
    <div onClick={(e) => { e.stopPropagation(); onClick(friend); }} className={`absolute flex flex-col items-center justify-center cursor-pointer ${signalClass} ${scaleEffect}`} style={{ transition: 'transform 1000ms linear', transform: `rotate(${friend.initialAngle}deg) translateY(-${scale}px) rotate(-${friend.initialAngle}deg)` }}>
      <div style={{ transform: `rotate(${userHeading}deg)`, transition: 'none' }} className="flex flex-col items-center justify-center relative">
          {friend.msg && (<div className="absolute -top-8 animate-in slide-in-from-bottom-2 fade-in duration-300 z-50"><div className={`px-2 py-1 rounded-lg shadow-lg text-xs font-bold whitespace-nowrap flex items-center gap-1 ${theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white'}`}><span>{friend.msg}</span><div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-inherit"></div></div></div>)}
          <div className={`relative w-10 h-10 transition-transform duration-500`}>{isPinging && (<><div className={`absolute inset-0 rounded-full border-2 ${friend.avatar} opacity-0 animate-[ping_1s_ease-out_infinite]`}></div><div className={`absolute -inset-4 rounded-full border ${friend.avatar} opacity-0 animate-[ping_1.5s_ease-out_infinite_0.3s]`}></div></>)}{isSelected && <div className={`absolute inset-[-8px] border-2 border-dashed ${theme === 'dark' ? 'border-white' : 'border-slate-800'} rounded-full animate-[spin_4s_linear_infinite]`}></div>}{isSameFloor && <div className={`absolute inset-0 ${friend.avatar} rounded-full blur-md opacity-30 animate-pulse`}></div>}<div className={`relative w-full h-full rounded-full border-2 ${theme === 'dark' ? 'border-slate-900' : 'border-white'} ${friend.avatar} flex items-center justify-center shadow-lg overflow-hidden transition-colors duration-300`}><span className="text-xs font-bold text-white">{friend.name[0]}</span></div>{!isSameFloor && (<div className={`absolute -right-2 top-0 ${theme === 'dark' ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-600 border-slate-200'} border text-[10px] px-1.5 py-0.5 rounded flex items-center shadow-sm`}>{friend.floorOffset > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}{Math.abs(friend.floorOffset)}F</div>)}</div>
          <div className="mt-2 flex flex-col items-center pointer-events-none"><span className={`text-[11px] font-medium tracking-wide ${currentStyle.textMain} drop-shadow-md bg-black/10 backdrop-blur-[2px] px-1 rounded whitespace-nowrap`}>{friend.name}</span><span className={`text-[9px] ${currentStyle.textSub} font-mono bg-black/10 backdrop-blur-[2px] px-1 rounded mt-0.5`}>{friend.initialDist.toFixed(1)}m</span></div>
      </div>
    </div>
  );
});

const DetailCard = memo(({ friend, onClose, onRemove, onToggleSharing, onNavigate, onPing, onSendSignal, isNavigating, isMuted, currentStyle, theme }) => {
  if (!friend) return null;
  const getSignalStatus = (dist) => { if (dist < 15) return { label: 'Excellent', color: 'text-emerald-500', icon: Wifi }; if (dist < 45) return { label: 'Good', color: 'text-blue-500', icon: Wifi }; return { label: 'Weak', color: 'text-amber-500', icon: WifiOff }; };
  const signal = getSignalStatus(friend.initialDist); const SignalIcon = signal.icon;
  return (
    <div className={`absolute bottom-24 left-4 right-4 ${currentStyle.cardBg} backdrop-blur-xl border ${currentStyle.border} rounded-2xl p-5 shadow-2xl z-40 animate-in slide-in-from-bottom-10 fade-in duration-300`}>
      <button onClick={onClose} className={`absolute top-4 right-4 p-1 rounded-full hover:bg-black/10 transition-colors ${currentStyle.textSub}`}><X size={20} /></button>
      <div className="flex items-start gap-4"><div className={`w-16 h-16 rounded-full ${friend.avatar} flex items-center justify-center text-white text-2xl font-bold shadow-lg ring-4 ${theme === 'dark' ? 'ring-slate-800' : 'ring-white'}`}>{friend.name[0]}</div><div className="flex-1"><h3 className={`text-xl font-bold ${currentStyle.textMain} flex items-center gap-2`}>{friend.name}</h3><div className="flex flex-col gap-1 mt-1"><p className={`text-sm ${currentStyle.textSub} flex items-center gap-1.5`}><span className={`w-2 h-2 rounded-full ${friend.status === 'Shopping' ? 'bg-emerald-500' : 'bg-blue-500'}`}></span>{friend.status}</p>{!friend.isSharingWithMe && <span className="text-xs text-red-400 flex items-center gap-1 font-medium bg-red-400/10 px-2 py-0.5 rounded w-fit"><EyeOff size={10} /> Hidden from you</span>}</div></div></div>
      {friend.isSharingWithMe ? (<div className="grid grid-cols-2 gap-3 mt-6"><div className={`p-3 rounded-xl ${theme === 'dark' ? 'bg-black/20' : 'bg-slate-100'} flex flex-col items-center gap-1`}><SignalIcon size={18} className={signal.color} /><span className={`text-xs ${currentStyle.textSub}`}>Signal</span><span className={`text-lg font-bold ${currentStyle.textMain}`}>{signal.label}</span></div><div className={`p-3 rounded-xl ${theme === 'dark' ? 'bg-black/20' : 'bg-slate-100'} flex flex-col items-center gap-1`}><Layers size={18} className="text-blue-500" /><span className={`text-xs ${currentStyle.textSub}`}>Floor</span><span className={`text-lg font-bold ${currentStyle.textMain}`}>{friend.floorOffset === 0 ? 'Same' : (friend.floorOffset > 0 ? `+${friend.floorOffset}` : friend.floorOffset)}</span></div></div>) : (<div className={`mt-6 p-6 rounded-xl ${theme === 'dark' ? 'bg-black/20' : 'bg-slate-100'} text-center border-dashed border-2 ${currentStyle.border}`}><Lock size={24} className={`mx-auto mb-2 ${currentStyle.textSub}`} /><p className={`text-sm ${currentStyle.textMain} font-medium`}>Location Hidden</p><p className={`text-xs ${currentStyle.textSub}`}>User is not sharing location with you</p></div>)}
      <div className={`mt-6 space-y-3`}><p className={`text-xs font-bold uppercase tracking-wider ${currentStyle.textSub}`}>Send Signal</p><div className="flex justify-between gap-2">{QUICK_SIGNALS.map((sig) => (<button key={sig.label} onClick={() => onSendSignal(friend.id, sig.icon)} className={`flex-1 py-2 rounded-xl border ${currentStyle.border} ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-white hover:bg-stone-50'} transition-colors flex flex-col items-center gap-1`}><span className="text-lg">{sig.icon}</span><span className={`text-[10px] ${currentStyle.textSub}`}>{sig.label}</span></button>))}</div></div>
      <div className="mt-6 flex flex-col gap-3"><div className="flex gap-2"><button onClick={() => onNavigate(friend.id)} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${isNavigating ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-violet-600 text-white hover:bg-violet-500 shadow-lg shadow-violet-500/20'}`}><Navigation size={16} className={isNavigating ? "animate-pulse" : ""} />{isNavigating ? 'Navigating...' : 'Navigate'}</button><button onClick={() => onPing(friend.id)} className={`flex-1 ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300'} ${currentStyle.textMain} py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2`}><Bell size={16} />{isMuted ? 'Ping (Muted)' : 'Ping'}</button></div><button onClick={() => onRemove(friend.id)} className={`w-full py-2.5 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 ${theme === 'dark' ? 'bg-red-900/20 text-red-400 hover:bg-red-900/40' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}><UserMinus size={16} />Disconnect</button></div>
    </div>
  );
});

const FloorFilter = memo(({ filter, setFilter, currentStyle }) => {
  return (
    <div className={`absolute top-24 left-1/2 -translate-x-1/2 z-30 flex gap-1 p-1 rounded-full border ${currentStyle.border} ${currentStyle.cardBg} backdrop-blur-md shadow-sm`} onClick={(e) => e.stopPropagation()}>
      <button onClick={() => setFilter('all')} className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${filter === 'all' ? 'bg-violet-600 text-white shadow-md' : currentStyle.textSub}`}>All Floors</button>
      <button onClick={() => setFilter('same')} className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${filter === 'same' ? 'bg-violet-600 text-white shadow-md' : currentStyle.textSub}`}>Same Floor</button>
    </div>
  );
});

const RadarScreen = ({ friends, floorFilter, setFloorFilter, onboardingName, userStatus, setUserStatus, isPowerSaving, meetingPoint, setMeetingPoint, setSelectedFriend, selectedFriend, removeFriend, toggleSharing, navigatingToId, setNavigatingToId, pingingId, setPingingId, sendSignal, theme, currentStyle, isMuted, isSyncing, hasSensors, requestSensors, userHeading, forceManualMode, toggleForceManual }) => {
    const MAX_RANGE = 60; 
    const visibleFriends = friends.filter(f => (floorFilter === 'all' || f.floorOffset === 0));
    const [showStatusPicker, setShowStatusPicker] = useState(false);
    const [manualHeading, setManualHeading] = useState(0);
    const displayHeading = (hasSensors && !forceManualMode) ? userHeading : manualHeading;
    
    const handlePing = (id) => { 
        playSound('ping', isMuted); 
        setPingingId(id); 
        setTimeout(() => setPingingId(null), 3000); 
    };
    
    const handleNavigate = (id) => { if (navigatingToId === id) { setNavigatingToId(null); } else { setNavigatingToId(id); } };

    return (
      <div className={`flex flex-col h-full relative overflow-hidden ${currentStyle.bg} transition-colors duration-700`} onClick={() => { setSelectedFriend(null); setShowStatusPicker(false); }}>
        <div className={`absolute top-0 w-full p-6 z-30 bg-gradient-to-b ${currentStyle.headerGradient} to-transparent pointer-events-none`}>
          <div className="flex justify-between items-start pointer-events-auto">
            <div className="relative">
              <button onClick={(e) => { e.stopPropagation(); setShowStatusPicker(!showStatusPicker); }} className={`text-left group transition-all`}>
                <h1 className={`text-2xl font-bold ${currentStyle.textMain} tracking-tight flex items-center gap-2`}>D+ <ChevronDown size={16} className={`transition-transform ${showStatusPicker ? 'rotate-180' : ''}`}/></h1>
                <div className="flex items-center gap-2 mt-1">
                    {isSyncing ? (<div className="flex items-center gap-1 text-amber-500 animate-pulse"><span className="w-2 h-2 rounded-full bg-amber-500"></span><span className="text-xs font-mono">Syncing...</span></div>) : (<div className="flex items-center gap-1 text-emerald-500"><span className="w-2 h-2 rounded-full bg-emerald-500"></span><span className="text-xs font-mono">Online</span></div>)}
                    <span className={`text-xs ${currentStyle.textSub} font-mono ml-2`}>{onboardingName.toUpperCase()} • <span className="text-violet-400 font-bold">{userStatus}</span></span>
                </div>
              </button>
              {showStatusPicker && (
                  <div className={`absolute top-16 left-0 w-40 ${currentStyle.cardBg} backdrop-blur-xl border ${currentStyle.border} rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2`}>
                      {STATUS_OPTIONS.map(status => (<button key={status} onClick={() => { setUserStatus(status); setShowStatusPicker(false); }} className={`w-full text-left px-4 py-3 text-sm hover:bg-violet-500/10 transition-colors ${status === userStatus ? 'text-violet-500 font-bold' : currentStyle.textMain}`}>{status}</button>))}
                  </div>
              )}
            </div>
            <button onClick={(e) => { e.stopPropagation(); setMeetingPoint(meetingPoint ? null : { distance: 20, angle: 0, label: 'Starbucks' }); }} className={`p-3 rounded-full backdrop-blur-md border transition-all shadow-sm cursor-pointer active:scale-95 ${meetingPoint ? 'bg-violet-500/20 border-violet-500 text-violet-500' : `${currentStyle.cardBg} ${currentStyle.border} ${currentStyle.textSub}`}`}><MapPin size={20} /></button>
          </div>
        </div>
        <FloorFilter filter={floorFilter} setFilter={setFloorFilter} currentStyle={currentStyle} />
        <div className="flex-1 relative flex items-center justify-center mt-10 z-10">
          <div className={`absolute w-[300px] h-[300px] ${currentStyle.accentGlow} rounded-full blur-[80px] pointer-events-none animate-pulse transition-colors duration-700`}></div>
          <div className={`absolute w-[150px] h-[150px] border ${currentStyle.ringBorder} rounded-full transition-colors duration-700 pointer-events-none`}></div>
          <div className={`absolute w-[300px] h-[300px] border ${currentStyle.ringBorder} rounded-full transition-colors duration-700 pointer-events-none`}></div>
          <div className={`absolute w-[450px] h-[450px] border ${currentStyle.ringBorder} rounded-full transition-colors duration-700 pointer-events-none`}></div>
          <div className="absolute inset-0 flex items-center justify-center" style={{ transform: `rotate(-${displayHeading}deg)`, transition: 'none' }}>
              <svg className="absolute w-[450px] h-[450px] pointer-events-none overflow-visible z-0">
                  {visibleFriends.map(friend => (<RadarTrails key={`trail-${friend.id}`} friend={friend} maxRange={MAX_RANGE} />))}
                  {visibleFriends.map(friend => (<ProximityBeam key={`beam-${friend.id}`} friend={friend} maxRange={MAX_RANGE} />))}
              </svg>
              {visibleFriends.map(friend => {
                  if (friend.id === navigatingToId && friend.isSharingWithMe) {
                      return <NavigationLine key={`nav-${friend.id}`} friend={friend} maxRange={MAX_RANGE} />
                  }
                  return null;
              })}
              {meetingPoint && (
                <div className="absolute flex flex-col items-center justify-center z-20" style={{ transition: 'transform 500ms ease-in-out', transform: `rotate(${meetingPoint.angle}deg) translateY(-${(meetingPoint.distance / MAX_RANGE) * 225}px) rotate(-${meetingPoint.angle}deg)` }}>
                    <div style={{ transform: `rotate(${displayHeading}deg)`, transition: 'none' }} className="flex flex-col items-center"><div className="w-8 h-8 bg-violet-500/20 border border-violet-400 rounded-full flex items-center justify-center animate-bounce"><MapPin size={14} className="text-violet-500" /></div><span className={`text-[10px] ${theme === 'dark' ? 'text-violet-200 bg-black/50' : 'text-violet-700 bg-white/80'} mt-1 font-medium px-2 py-0.5 rounded-md backdrop-blur-sm shadow-sm`}>{meetingPoint.label}</span></div>
                </div>
              )}
              {visibleFriends.map(friend => (<RadarNode key={friend.id} friend={friend} maxRange={MAX_RANGE} theme={theme} currentStyle={currentStyle} onClick={(f) => setSelectedFriend(f)} isSelected={selectedFriend?.id === friend.id} userHeading={displayHeading} isPinging={friend.id === pingingId} />))}
          </div>
          <div className="relative z-20 pointer-events-none">
            <div className={`w-4 h-4 bg-violet-500 rounded-full shadow-[0_0_20px_rgba(139,92,246,0.5)] ring-4 ring-violet-500/20 transition-colors duration-500 relative`}><div className="absolute inset-0 bg-violet-400 rounded-full animate-ping opacity-75"></div></div>
            <div className={`absolute top-[-40px] left-1/2 -translate-x-1/2 w-[1px] h-[30px] bg-gradient-to-t from-violet-500/50 to-transparent`}></div>
          </div>
        </div>
        <div className="absolute bottom-24 w-full px-10 z-20 flex flex-col items-center gap-2 pointer-events-auto">
            {!hasSensors || forceManualMode ? (
                <>
                    <div className="flex justify-between w-full text-[10px] text-slate-500 font-mono px-1"><span>W</span><span>N</span><span>E</span></div>
                    <input type="range" min="0" max="360" value={manualHeading} onChange={(e) => setManualHeading(Number(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-violet-500 hover:accent-violet-400" />
                    <span className={`text-[10px] ${currentStyle.textSub}`}>{forceManualMode ? "Manual Override" : "Rotate to Simulate (No Sensors)"}</span>
                </>
            ) : (
                <div className={`text-[10px] ${currentStyle.textSub} flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-full text-emerald-500`}>
                    <Compass size={12} /> Live Compass Active ({Math.round(userHeading)}°)
                </div>
            )}
        </div>
        {selectedFriend && (<DetailCard friend={selectedFriend} onClose={() => setSelectedFriend(null)} onRemove={removeFriend} onToggleSharing={toggleSharing} onNavigate={handleNavigate} onPing={handlePing} onSendSignal={sendSignal} isNavigating={navigatingToId === selectedFriend.id} isMuted={isMuted} currentStyle={currentStyle} theme={theme} />)}
      </div>
    );
};

const SettingsScreen = ({ onboardingName, userStatus, setHasOnboarded, theme, setTheme, isMuted, setIsMuted, currentStyle, resetApp, hasSensors, requestSensors, sensorDataDebug, forceManualMode, toggleForceManual }) => {
    // Phase 6: PWA Install State
    const [installPrompt, setInstallPrompt] = useState(null);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // Android / Desktop Install Prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            setInstallPrompt(e);
        });

        // iOS Detection
        const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        // Check if already standalone (installed)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        
        if (isIOSDevice && !isStandalone) {
            setIsIOS(true);
        }
    }, []);

    const handleInstallClick = () => {
        if (installPrompt) {
            installPrompt.prompt();
            installPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    setInstallPrompt(null);
                }
            });
        }
    };

    return (
    <div className={`flex flex-col h-full ${currentStyle.bg} p-6 pt-12 transition-colors duration-700 z-10`}>
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 bg-gradient-to-tr from-violet-500 to-fuchsia-500 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg">
          {onboardingName ? onboardingName[0] : 'U'}
        </div>
        <div>
          <h2 className={`text-2xl font-bold ${currentStyle.textMain}`}>{onboardingName || 'User'}</h2>
          <p className={`text-sm ${currentStyle.textSub} text-violet-400 font-medium`}>{userStatus}</p>
        </div>
      </div>
      
      {/* Phase 6 New: Install App Section */}
      {(installPrompt || isIOS) && (
          <div className={`mb-6 p-4 rounded-2xl border ${currentStyle.border} bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10`}>
              <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-violet-500 rounded-lg text-white">
                      <Download size={20} />
                  </div>
                  <div>
                      <h3 className={`${currentStyle.textMain} font-bold`}>Install D+ App</h3>
                      <p className={`text-xs ${currentStyle.textSub}`}>Get the full experience</p>
                  </div>
              </div>
              
              {installPrompt && (
                  <button 
                    onClick={handleInstallClick}
                    className="w-full mt-2 bg-violet-600 hover:bg-violet-500 text-white py-2 rounded-xl text-sm font-bold shadow-lg transition-all"
                  >
                      Add to Home Screen
                  </button>
              )}

              {isIOS && (
                  <div className={`mt-2 text-xs ${currentStyle.textSub} p-2 bg-white/10 rounded-lg flex items-start gap-2`}>
                      <Share size={14} className="mt-0.5" />
                      <span>Tap <b>Share</b> then select <b>"Add to Home Screen"</b> to install.</span>
                  </div>
              )}
          </div>
      )}

      <div className="space-y-6">
        <div className={`${currentStyle.cardBg} ${currentStyle.border} border rounded-2xl p-5 shadow-sm transition-colors`}>
          <div className="flex items-center gap-3 mb-2">
            <Smartphone className={hasSensors ? "text-emerald-500" : "text-amber-500"} size={24} />
            <div>
              <h3 className={`${currentStyle.textMain} font-medium`}>Sensors</h3>
              <p className={`text-xs ${currentStyle.textSub}`}>{hasSensors ? 'Active & Calibrated' : 'Permission Required'}</p>
            </div>
            <div className="ml-auto flex gap-2">
                {hasSensors && (
                    <button onClick={toggleForceManual} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${forceManualMode ? 'bg-violet-500 text-white' : 'bg-slate-200 text-slate-500'} transition-colors`}>
                        {forceManualMode ? 'Manual' : 'Auto'}
                    </button>
                )}
                {!hasSensors && (
                    <button onClick={requestSensors} className={`px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 transition-colors`}>
                        Enable
                    </button>
                )}
            </div>
          </div>
          <div className={`mt-2 p-2 rounded bg-black/5 text-[9px] font-mono ${currentStyle.textSub} break-all`}>
              DEBUG: {sensorDataDebug} <br/>
              HTTPS: {window.isSecureContext ? "Yes" : "No"}
          </div>
        </div>

        <div className={`${currentStyle.cardBg} ${currentStyle.border} border rounded-2xl p-5 shadow-sm transition-colors`}>
          <div className="flex items-center gap-3 mb-2">
            {theme === 'dark' ? <Moon className="text-violet-400" size={24} /> : <Sun className="text-amber-500" size={24} />}
            <div>
              <h3 className={`${currentStyle.textMain} font-medium`}>Appearance</h3>
              <p className={`text-xs ${currentStyle.textSub}`}>{theme === 'dark' ? 'Midnight Dark' : 'Soft Light'}</p>
            </div>
            <div className="ml-auto">
              <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={`w-14 h-8 rounded-full flex items-center p-1 transition-colors cursor-pointer ${theme === 'dark' ? 'bg-slate-700 justify-end' : 'bg-slate-200 justify-start'}`}><div className={`w-6 h-6 rounded-full shadow-sm transition-all ${theme === 'dark' ? 'bg-slate-400' : 'bg-white'}`}></div></button>
            </div>
          </div>
        </div>
        
        <div className={`${currentStyle.cardBg} ${currentStyle.border} border rounded-2xl p-5 shadow-sm transition-colors`}>
          <div className="flex items-center gap-3 mb-2">
            {isMuted ? <VolumeX className="text-red-400" size={24} /> : <Volume2 className="text-emerald-500" size={24} />}
            <div>
              <h3 className={`${currentStyle.textMain} font-medium`}>Sound Effects</h3>
              <p className={`text-xs ${currentStyle.textSub}`}>{isMuted ? 'Muted' : 'Enabled'}</p>
            </div>
            <div className="ml-auto">
              <button onClick={() => setIsMuted(!isMuted)} className={`w-14 h-8 rounded-full flex items-center p-1 transition-colors cursor-pointer ${isMuted ? 'bg-slate-700 justify-start' : 'bg-emerald-500/20 justify-end border border-emerald-500'}`}><div className={`w-6 h-6 rounded-full shadow-sm transition-all ${isMuted ? 'bg-slate-400' : 'bg-emerald-500'}`}></div></button>
            </div>
          </div>
        </div>

        <div className={`${currentStyle.cardBg} ${currentStyle.border} border rounded-2xl p-5 shadow-sm transition-colors`}>
          <div className="flex items-center gap-3 mb-4">
            <Leaf className="text-emerald-500" size={24} />
            <div>
              <h3 className={`${currentStyle.textMain} font-medium`}>Eco-Sense Mode</h3>
              <p className={`text-xs ${currentStyle.textSub}`}>Intelligent battery optimization</p>
            </div>
            <div className="ml-auto">
               <div className="w-10 h-6 bg-emerald-500/20 rounded-full border border-emerald-500/50 relative">
                 <div className="absolute right-1 top-1 w-4 h-4 bg-emerald-500 rounded-full shadow-lg"></div>
               </div>
            </div>
          </div>
          <div className={`text-[10px] ${currentStyle.textSub} leading-relaxed`}>
            Automatically switches between UWB (Precision) and BLE (Low Power) based on movement speed and distance.
          </div>
        </div>
      </div>
      
      <div className="mt-auto mb-24 text-center">
        <button onClick={resetApp} className="text-xs text-red-400 hover:text-red-300 mb-4 underline">Reset App State</button>
        <p className={`text-xs ${currentStyle.textSub} font-mono`}>D+ v4.1.0 (PWA Ready)</p>
      </div>
    </div>
    );
};

// --- 主應用 ---
const OmniTrackApp = () => {
  const [activeTab, setActiveTab] = useState('radar');
  const [friends, setFriends] = useState(() => { const saved = localStorage.getItem('omni_friends'); return saved ? JSON.parse(saved) : INITIAL_MOCK_FRIENDS; });
  const [meetingPoint, setMeetingPoint] = useState(null);
  const [isPowerSaving, setIsPowerSaving] = useState(false);
  const [showConnectionCenter, setShowConnectionCenter] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [selectedFriend, setSelectedFriend] = useState(null); 
  const [floorFilter, setFloorFilter] = useState('all'); 
  const [navigatingToId, setNavigatingToId] = useState(null);
  const [pingingId, setPingingId] = useState(null);
  const [showSplash, setShowSplash] = useState(true);
  
  const [userHeading, setUserHeading] = useState(0); 
  const [hasSensors, setHasSensors] = useState(false); 
  const [sensorDataDebug, setSensorDataDebug] = useState("Waiting for interaction..."); 
  const [forceManualMode, setForceManualMode] = useState(false); 
  
  const [isJoining, setIsJoining] = useState(false); 
  const [isSyncing, setIsSyncing] = useState(false); 
  
  const [isMuted, setIsMuted] = useState(() => { return localStorage.getItem('omni_is_muted') === 'true'; });
  const [onboardingName, setOnboardingName] = useState(() => { return localStorage.getItem('omni_user_name') || ''; });
  const [hasOnboarded, setHasOnboarded] = useState(() => { return localStorage.getItem('omni_has_onboarded') === 'true'; });
  const [userStatus, setUserStatus] = useState(() => { return localStorage.getItem('omni_user_status') || 'Online'; });
  const [userCode] = useState(() => { const storedCode = localStorage.getItem('omni_user_code'); if (storedCode) return storedCode; const newCode = Math.floor(100000 + Math.random() * 900000).toString(); localStorage.setItem('omni_user_code', newCode); return newCode; });
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');

  // Sensor Request Logic
  const requestSensors = async () => {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
          try {
              const response = await DeviceOrientationEvent.requestPermission();
              if (response === 'granted') {
                  activateSensors();
              } else {
                  alert('Sensor permission denied');
              }
          } catch (e) {
              console.error(e);
              alert('Error requesting permission: ' + e.message);
          }
      } else {
          activateSensors();
      }
  };

  const activateSensors = () => {
      setHasSensors(true);
      window.addEventListener('deviceorientation', (e) => {
          let heading = 0;
          if (e.webkitCompassHeading) {
              heading = e.webkitCompassHeading;
          } else if (e.alpha) {
              heading = 360 - e.alpha; 
          }
          setUserHeading(heading);
      });
  };

  useEffect(() => { localStorage.setItem('omni_user_name', onboardingName); }, [onboardingName]);
  useEffect(() => { localStorage.setItem('omni_has_onboarded', hasOnboarded); }, [hasOnboarded]);
  useEffect(() => { localStorage.setItem('omni_user_status', userStatus); }, [userStatus]);
  useEffect(() => { localStorage.setItem('omni_friends', JSON.stringify(friends)); }, [friends]);
  useEffect(() => { localStorage.setItem('omni_is_muted', isMuted); }, [isMuted]);

  const resetApp = () => {
    setHasOnboarded(false);
    setOnboardingName('');
    setShowSplash(true); 
    setFriends(INITIAL_MOCK_FRIENDS); 
    localStorage.removeItem('omni_user_name');
    localStorage.removeItem('omni_has_onboarded');
    localStorage.removeItem('omni_user_status');
    localStorage.removeItem('omni_friends');
    localStorage.removeItem('omni_is_muted');
  };

  const handleJoinFriend = async () => {
    setJoinError('');
    setIsJoining(true);
    try {
        const newFriend = await BackendService.joinSession(joinCode, userCode);
        if (friends.some(f => f.name === newFriend.name)) {
            throw new Error('User already in your friend list');
        }
        setFriends([...friends, newFriend]);
        playSound('success', isMuted);
        setJoinCode('');
        setShowConnectionCenter(false); 
        setActiveTab('radar'); 
    } catch (err) {
        setJoinError(err.message);
    } finally {
        setIsJoining(false);
    }
  };

  const removeFriend = (id) => {
    if (selectedFriend?.id === id) setSelectedFriend(null);
    if (navigatingToId === id) setNavigatingToId(null); 
    setFriends(prev => prev.filter(f => f.id !== id));
  };

  const toggleSharing = (id, property) => {
    setFriends(prev => prev.map(f => {
        if (f.id === id) {
            const updated = { ...f, [property]: !f[property] };
            if (selectedFriend?.id === id) setSelectedFriend(updated);
            return updated;
        }
        return f;
    }));
  };

  const sendSignal = async (id, icon) => {
      setFriends(prev => prev.map(f => {
          if (f.id === id) {
              playSound('msg', isMuted);
              return { ...f, msg: icon, msgExpiry: Date.now() + 5000 };
          }
          return f;
      }));
      await BackendService.sendSignal(id, 'emoji', icon);
  };

  const styles = useMemo(() => ({
    dark: {
      bg: 'bg-[#0f172a]', navBg: 'bg-slate-900/80', textMain: 'text-white', textSub: 'text-slate-400', border: 'border-white/5', cardBg: 'bg-slate-800/60', accentGlow: 'bg-violet-500/10', ringBorder: 'border-white/5', navActive: 'text-violet-400', navInactive: 'text-slate-500', headerGradient: 'from-[#0f172a]', inputBg: 'bg-slate-800',
    },
    light: {
      bg: 'bg-[#fff8e1]', navBg: 'bg-[#fff8e1]/90', textMain: 'text-stone-800', textSub: 'text-stone-500', border: 'border-stone-200', cardBg: 'bg-white/60', accentGlow: 'bg-orange-500/5', ringBorder: 'border-stone-200', navActive: 'text-violet-600', navInactive: 'text-stone-400', headerGradient: 'from-[#fff8e1]', inputBg: 'bg-white',
    }
  }), []);

  const currentStyle = styles[theme];

  useEffect(() => {
    const interval = setInterval(async () => {
      if (Math.random() > 0.7) setIsSyncing(true);

      setFriends(currentFriends => {
          const updatedFriends = BackendService.simulatePhysics(currentFriends);
          const nearest = Math.min(...updatedFriends.map(f => f.initialDist));
          setIsPowerSaving(nearest >= 10);
          return updatedFriends;
      });
      
      await BackendService.updateMyLocation(userStatus);
      if (Math.random() > 0.7) setIsSyncing(false);
      
    }, 1000); 
    return () => clearInterval(interval);
  }, [userStatus]);

  if (showSplash) { return <SplashScreen onFinish={() => setShowSplash(false)} theme={theme} />; }
  if (!hasOnboarded) {
    return (
      <div className={`w-full h-screen font-sans flex flex-col items-center justify-center p-8 transition-colors duration-700 ${currentStyle.bg}`}>
        <div className="w-20 h-20 bg-gradient-to-tr from-violet-600 to-fuchsia-500 rounded-3xl shadow-2xl flex items-center justify-center mb-8 rotate-12"><Navigation size={40} className="text-white" /></div>
        <h1 className={`text-3xl font-bold ${currentStyle.textMain} mb-2 text-center`}>Welcome to D+</h1>
        <p className={`text-center ${currentStyle.textSub} mb-8 max-w-xs`}>High-precision ambient awareness.</p>
        <div className="w-full max-w-xs space-y-4">
          <div className="space-y-2"><label className={`text-xs font-bold uppercase tracking-wider ${currentStyle.textSub} ml-1`}>Your Name</label><input type="text" placeholder=" " value={onboardingName} onChange={(e) => setOnboardingName(e.target.value)} className={`w-full p-4 rounded-xl ${currentStyle.inputBg} border ${currentStyle.border} ${currentStyle.textMain} outline-none focus:ring-2 focus:ring-violet-500 transition-all`} /></div>
          <button onClick={() => { if(onboardingName) setHasOnboarded(true); }} disabled={!onboardingName} className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${onboardingName ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/30 transform hover:-translate-y-1' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}>Start Tracking</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-screen font-sans overflow-hidden select-none transition-colors duration-700 ${currentStyle.bg}`}>
      {activeTab === 'radar' && (<RadarScreen friends={friends} floorFilter={floorFilter} setFloorFilter={setFloorFilter} onboardingName={onboardingName} userStatus={userStatus} setUserStatus={setUserStatus} isPowerSaving={isPowerSaving} meetingPoint={meetingPoint} setMeetingPoint={setMeetingPoint} setSelectedFriend={setSelectedFriend} selectedFriend={selectedFriend} removeFriend={removeFriend} toggleSharing={toggleSharing} navigatingToId={navigatingToId} setNavigatingToId={setNavigatingToId} pingingId={pingingId} setPingingId={setPingingId} sendSignal={sendSignal} theme={theme} currentStyle={currentStyle} isMuted={isMuted} isSyncing={isSyncing} hasSensors={hasSensors} requestSensors={handleEnableSensors} userHeading={hasSensors ? userHeading : undefined} forceManualMode={forceManualMode} toggleForceManual={() => setForceManualMode(!forceManualMode)} />)}
      {activeTab === 'friends' && (<FriendsScreen friends={friends} removeFriend={removeFriend} showConnectionCenter={showConnectionCenter} setShowConnectionCenter={setShowConnectionCenter} joinCode={joinCode} setJoinCode={setJoinCode} handleJoinFriend={handleJoinFriend} joinError={joinError} theme={theme} currentStyle={currentStyle} userCode={userCode} toggleSharing={toggleSharing} isJoining={isJoining} />)}
      {activeTab === 'settings' && (<SettingsScreen onboardingName={onboardingName} userStatus={userStatus} setHasOnboarded={setHasOnboarded} theme={theme} setTheme={setTheme} isMuted={isMuted} setIsMuted={setIsMuted} currentStyle={currentStyle} resetApp={resetApp} hasSensors={hasSensors} requestSensors={handleEnableSensors} sensorDataDebug={sensorDataDebug} forceManualMode={forceManualMode} toggleForceManual={() => setForceManualMode(!forceManualMode)} />)}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} currentStyle={currentStyle} />
    </div>
  );
};

export default OmniTrackApp;