import { useState, useEffect } from 'react'
import { Settings, Bell, Shield, Palette, Save, Check } from 'lucide-react'
import { useTheme } from '@contexts/ThemeContext'

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()

  const [settings, setSettings] = useState(() => {
    try {
      const stored = localStorage.getItem('varshanetra-settings')
      if (stored) return JSON.parse(stored)
    } catch { /* ignore */ }
    return {
      notifications: true,
      emailAlerts: true,
      smsAlerts: false,
      riskThreshold: 70,
      updateFrequency: 30,
    }
  })

  const [saved, setSaved] = useState(false)

  // Persist settings to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('varshanetra-settings', JSON.stringify(settings))
    } catch { /* ignore */ }
  }, [settings])

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="flex-1 overflow-auto bg-gradient-to-br from-surface-base via-surface-secondary to-surface-base p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="w-7 h-7 text-status-info" />
            <h1 className="text-3xl font-bold text-text-primary">Settings</h1>
          </div>
          <p className="text-text-secondary">Manage preferences and system configuration</p>
        </div>

        {/* THEME SETTINGS */}
        <div className="bg-surface-secondary border border-surface-border rounded-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Palette className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold text-text-primary">Display Theme</h2>
          </div>
          <p className="text-text-secondary text-sm mb-4">Choose how VarshaNetra appears. Theme persists across sessions.</p>
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: 'dark' as const, label: 'Dark Mode', desc: 'Command center interface' },
              { value: 'light' as const, label: 'Light Mode', desc: 'Clean daylight interface' },
            ]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={`flex flex-col items-start gap-1 rounded-lg border-2 p-4 text-left transition-all ${theme === opt.value
                    ? 'border-primary bg-primary/10 shadow-md'
                    : 'border-surface-border bg-surface-base hover:border-text-muted'
                  }`}
                aria-pressed={theme === opt.value}
              >
                <span className="font-semibold text-text-primary text-sm">{opt.label}</span>
                <span className="text-text-muted text-xs">{opt.desc}</span>
                {theme === opt.value && <Check className="w-4 h-4 text-primary mt-1" />}
              </button>
            ))}
          </div>
        </div>

        {/* NOTIFICATION SETTINGS */}
        <div className="bg-surface-secondary border border-surface-border rounded-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Bell className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold text-text-primary">Notifications</h2>
          </div>
          <p className="text-text-muted text-xs mb-4">Notification settings are stored locally. Backend integration required for push/email/SMS delivery.</p>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={settings.notifications} onChange={(e) => setSettings({ ...settings, notifications: e.target.checked })} className="w-5 h-5 rounded accent-primary" />
              <div>
                <p className="text-text-primary font-medium">Push Notifications</p>
                <p className="text-text-secondary text-sm">Receive real-time alerts on your device</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={settings.emailAlerts} onChange={(e) => setSettings({ ...settings, emailAlerts: e.target.checked })} className="w-5 h-5 rounded accent-primary" />
              <div>
                <p className="text-text-primary font-medium">Email Alerts</p>
                <p className="text-text-secondary text-sm">Get email notifications for critical incidents</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={settings.smsAlerts} onChange={(e) => setSettings({ ...settings, smsAlerts: e.target.checked })} className="w-5 h-5 rounded accent-primary" />
              <div>
                <p className="text-text-primary font-medium">SMS Alerts</p>
                <p className="text-text-secondary text-sm">Receive SMS for emergency alerts</p>
              </div>
            </label>
          </div>
        </div>

        {/* ALERT SETTINGS */}
        <div className="bg-surface-secondary border border-surface-border rounded-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold text-text-primary">Alert Thresholds</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-text-primary font-medium mb-2">Risk Score Threshold</label>
              <input type="range" min="30" max="90" value={settings.riskThreshold} onChange={(e) => setSettings({ ...settings, riskThreshold: parseInt(e.target.value) })} className="w-full accent-primary" />
              <p className="text-text-secondary text-sm mt-1">Alert when risk exceeds <span className="font-semibold text-status-warning">{settings.riskThreshold}%</span></p>
            </div>
            <div>
              <label className="block text-text-primary font-medium mb-2">Update Frequency</label>
              <select value={settings.updateFrequency} onChange={(e) => setSettings({ ...settings, updateFrequency: parseInt(e.target.value) })} className="w-full px-4 py-2 bg-surface-base border border-surface-border rounded-lg text-text-primary">
                <option value="15">Every 15 seconds</option>
                <option value="30">Every 30 seconds</option>
                <option value="60">Every minute</option>
                <option value="300">Every 5 minutes</option>
              </select>
            </div>
          </div>
        </div>

        {/* SAVE BUTTON */}
        <button onClick={handleSave} className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark font-semibold transition-colors">
          {saved ? (
            <>
              <Check className="w-5 h-5" /> Settings Saved
            </>
          ) : (
            <>
              <Save className="w-5 h-5" /> Save Settings
            </>
          )}
        </button>
        {saved && (
          <p className="mt-3 text-center text-sm text-status-success">All settings have been saved locally.</p>
        )}
      </div>
    </div>
  )
}
