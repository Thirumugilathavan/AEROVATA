import React, { useState } from 'react';
import { 
  X, 
  Bell, 
  ShieldAlert, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  Check, 
  CheckCheck, 
  Navigation, 
  Battery, 
  Building2, 
  Radio, 
  Layers, 
  ExternalLink 
} from 'lucide-react';
import { NotificationItem, NotificationCategory } from '../types/fleet';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onAcknowledge: (id: string) => void;
  onAcknowledgeAll: () => void;
  onSelectDrone: (droneId: string) => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onAcknowledge,
  onAcknowledgeAll,
  onSelectDrone,
}) => {
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info' | 'success'>('all');

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'all') return true;
    return n.severity === filter;
  });

  const getCategoryIcon = (category: NotificationCategory) => {
    switch (category) {
      case 'highway':
        return <Navigation className="w-3.5 h-3.5 text-cyan-400" />;
      case 'building':
        return <Building2 className="w-3.5 h-3.5 text-amber-400" />;
      case 'battery':
        return <Battery className="w-3.5 h-3.5 text-rose-400" />;
      case 'separation':
        return <Radio className="w-3.5 h-3.5 text-purple-400" />;
      case 'restricted':
        return <Layers className="w-3.5 h-3.5 text-rose-500" />;
      case 'mission':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Info className="w-3.5 h-3.5 text-blue-400" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return {
          icon: <ShieldAlert className="w-4 h-4 text-rose-400" />,
          label: 'CRITICAL',
          style: 'bg-rose-950/80 text-rose-300 border-rose-800/80',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
          label: 'WARNING',
          style: 'bg-amber-950/80 text-amber-300 border-amber-800/80',
        };
      case 'success':
        return {
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
          label: 'SUCCESS',
          style: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80',
        };
      default:
        return {
          icon: <Info className="w-4 h-4 text-cyan-400" />,
          label: 'INFO',
          style: 'bg-cyan-950/80 text-cyan-300 border-cyan-800/80',
        };
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[460px] bg-[#0c101a] border-l border-[#1f2a40] z-50 flex flex-col shadow-2xl select-none animate-in slide-in-from-right duration-200">
      {/* Top Header */}
      <div className="h-14 px-4 bg-[#111726] border-b border-[#1f2a40] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Bell className="w-5 h-5 text-cyan-400" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-500 text-[9px] font-bold text-white flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-sm font-bold font-mono text-white tracking-wider uppercase">
              Operational Notifications
            </h2>
            <div className="text-[10px] text-slate-400 font-mono">
              Coimbatore Airspace UTM • {notifications.length} events logged
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800/80 transition-colors"
          title="Close Panel"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Global Actions & Unread Counter */}
      <div className="px-4 py-2.5 bg-[#0e1422] border-b border-[#1f2a40] flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2 text-slate-300">
          <span className="text-[11px] font-bold text-white">
            {unreadCount} Unread
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-[11px] text-slate-400">
            {notifications.filter((n) => !n.acknowledged).length} Pending Ack
          </span>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllAsRead}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors hover:underline"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
          )}
          <button
            onClick={onAcknowledgeAll}
            className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors hover:underline ml-2"
          >
            <Check className="w-3.5 h-3.5" />
            Ack all
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-3 py-2 bg-[#0c101a] border-b border-[#1f2a40] flex items-center gap-1 overflow-x-auto scrollbar-none text-[11px] font-mono">
        {[
          { id: 'all', label: `All (${notifications.length})` },
          { id: 'critical', label: `Critical (${notifications.filter((n) => n.severity === 'critical').length})` },
          { id: 'warning', label: `Warnings (${notifications.filter((n) => n.severity === 'warning').length})` },
          { id: 'info', label: `Info (${notifications.filter((n) => n.severity === 'info').length})` },
          { id: 'success', label: `Missions (${notifications.filter((n) => n.severity === 'success').length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as any)}
            className={`px-2.5 py-1 rounded whitespace-nowrap transition-colors ${
              filter === tab.id
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 font-bold'
                : 'text-slate-400 hover:text-slate-200 bg-[#121826]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notifications List with Smooth Scroll */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {filteredNotifications.map((item) => {
          const badge = getSeverityBadge(item.severity);

          return (
            <div
              key={item.id}
              className={`p-3 rounded-md border transition-all ${
                !item.read
                  ? 'bg-[#131b2e] border-cyan-500/60 shadow-[0_0_12px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/30'
                  : 'bg-[#0f1422] border-[#1f2c45] opacity-90'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono border flex items-center gap-1 ${badge.style}`}>
                    {badge.icon}
                    {badge.label}
                  </span>

                  <span className="flex items-center gap-1 text-[10px] font-mono text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700">
                    {getCategoryIcon(item.category)}
                    {item.category.toUpperCase()}
                  </span>

                  {item.droneCallsign && (
                    <button
                      onClick={() => item.droneId && onSelectDrone(item.droneId)}
                      className="text-[10px] font-mono font-bold text-cyan-300 hover:text-cyan-200 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-800 hover:border-cyan-500 flex items-center gap-1 transition-colors"
                      title="Focus drone on map"
                    >
                      <span>{item.droneCallsign}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-mono text-slate-500">
                    {item.timestamp}
                  </span>
                  {!item.read && (
                    <span className="w-2 h-2 rounded-full bg-cyan-400" title="Unread notification" />
                  )}
                </div>
              </div>

              {/* Title */}
              <div className="text-xs font-bold text-slate-100 font-mono mb-1 leading-snug">
                {item.title}
              </div>

              {/* Description */}
              <p className="text-[11px] text-slate-300 leading-relaxed mb-2 font-sans">
                {item.description}
              </p>

              {/* Clearance / Specific Metrics if available */}
              {item.metrics && (
                <div className="mb-2 p-1.5 rounded bg-[#090d16] border border-[#1b253b] grid grid-cols-2 gap-2 text-[10px] font-mono">
                  {item.metrics.horizontalDistance !== undefined && (
                    <div>
                      <span className="text-slate-500">Horizontal Dist: </span>
                      <span className="text-white font-bold">{item.metrics.horizontalDistance}m</span>
                    </div>
                  )}
                  {item.metrics.verticalClearance !== undefined && (
                    <div>
                      <span className="text-slate-500">Vertical Clearance: </span>
                      <span className={`font-bold ${item.metrics.verticalClearance < 10 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {item.metrics.verticalClearance > 0 ? `+${item.metrics.verticalClearance}m` : `${item.metrics.verticalClearance}m`}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Action and Confirmation Footer */}
              <div className="pt-2 border-t border-[#1a253a] flex items-center justify-between text-[10px] font-mono">
                <div className="flex items-center gap-1.5">
                  {item.acknowledged ? (
                    <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                      <Check className="w-3 h-3 text-emerald-400" />
                      ACKNOWLEDGED
                    </span>
                  ) : (
                    <button
                      onClick={() => onAcknowledge(item.id)}
                      className="px-2 py-0.5 rounded bg-amber-950/70 hover:bg-amber-900/80 text-amber-300 border border-amber-700/80 font-bold transition-colors flex items-center gap-1"
                    >
                      <Check className="w-3 h-3 text-amber-400" />
                      Acknowledge
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onMarkAsRead(item.id)}
                    className="text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {item.read ? 'Mark unread' : 'Mark read'}
                  </button>
                  {item.droneId && (
                    <button
                      onClick={() => onSelectDrone(item.droneId!)}
                      className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-0.5"
                    >
                      <span>Locate</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredNotifications.length === 0 && (
          <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center font-mono">
            <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="text-sm font-bold text-slate-300 mb-1">
              All Airspace Systems Clear
            </div>
            <div className="text-xs text-slate-500 max-w-xs">
              No notifications matching current filter. Continuous 3D obstacle and separation radar monitoring active.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
