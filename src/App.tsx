import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Battery,
  Bell,
  Bluetooth,
  Check,
  ChevronDown,
  CircleAlert,
  Clock,
  Download,
  FlaskConical,
  Gauge,
  History,
  Home,
  LoaderCircle,
  MapPin,
  Minus,
  Plus,
  RefreshCw,
  Search,
  Server,
  Settings,
  Signal,
  Snowflake,
  Sprout,
  Thermometer,
  Unplug,
  Wifi,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { foundDevices, generateReadings, initialAlerts, initialDevices } from "./data";
import { exportReadingsXlsx } from "./export";
import type { AlertRecord, Device, DeviceKind, FoundDevice, Page, Reading } from "./types";
import { formatChartTime, formatFullTime, formatRelativeTime, getStatus } from "./utils";

type ToastTone = "success" | "warning" | "danger";
type ToastState = { id: number; message: string; tone: ToastTone };
type AlertFilter = "pending" | "all" | "resolved";

const pageCopy: Record<Page, { title: string; subtitle: string }> = {
  dashboard: { title: "温度总览", subtitle: "持续掌握每个监测点的温度变化" },
  history: { title: "历史数据", subtitle: "查看曲线、采样明细并导出 Excel" },
  alerts: { title: "告警中心", subtitle: "及时响应温度异常并记录处理结果" },
  devices: { title: "设备管理", subtitle: "管理监测终端、连接状态与运行参数" },
  settings: { title: "监测设置", subtitle: "设置报警阈值、采样周期与通知方式" },
};

const navItems: { page: Page; label: string; icon: LucideIcon }[] = [
  { page: "dashboard", label: "温度总览", icon: Home },
  { page: "history", label: "历史数据", icon: History },
  { page: "alerts", label: "告警中心", icon: Bell },
  { page: "devices", label: "设备管理", icon: Bluetooth },
  { page: "settings", label: "监测设置", icon: Settings },
];

const kindMeta: Record<DeviceKind, { label: string; icon: LucideIcon; className: string }> = {
  lab: { label: "实验室", icon: FlaskConical, className: "kind-lab" },
  cold: { label: "冷链", icon: Snowflake, className: "kind-cold" },
  greenhouse: { label: "农业", icon: Sprout, className: "kind-green" },
  equipment: { label: "机房", icon: Server, className: "kind-room" },
};

const sampleOptions = [1, 5, 10, 30, 60, 300];

function readStored<T>(key: string, fallback: T): T {
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

function newAlert(device: Device): AlertRecord {
  const above = device.temperature > device.max;
  return {
    id: `alert-${device.id}-${Date.now()}`,
    deviceId: device.id,
    deviceName: device.name,
    location: device.location,
    severity: "warning",
    message: above ? "温度高于新设上限" : "温度低于新设下限",
    detail: `当前 ${device.temperature.toFixed(1)}°C，新的适宜范围为 ${device.min.toFixed(1)} - ${device.max.toFixed(1)}°C。`,
    time: new Date().toISOString(),
    handled: false,
    resolved: false,
  };
}

function App() {
  const [devices, setDevices] = useState<Device[]>(() => readStored("wenlian-devices-v1", initialDevices));
  const [alerts, setAlerts] = useState<AlertRecord[]>(() => readStored("wenlian-alerts-v1", initialAlerts));
  const [currentDeviceId, setCurrentDeviceId] = useState(() => readStored("wenlian-current-v1", "lab-fridge-01"));
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const [connectOpen, setConnectOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const currentDevice = devices.find((device) => device.id === currentDeviceId) ?? devices[0];
  const pendingAlertCount = alerts.filter((alert) => !alert.handled && !alert.resolved).length;

  useEffect(() => {
    window.localStorage.setItem("wenlian-devices-v1", JSON.stringify(devices));
  }, [devices]);

  useEffect(() => {
    window.localStorage.setItem("wenlian-alerts-v1", JSON.stringify(alerts));
  }, [alerts]);

  useEffect(() => {
    window.localStorage.setItem("wenlian-current-v1", JSON.stringify(currentDeviceId));
  }, [currentDeviceId]);

  useEffect(() => {
    if (devices.length > 0 && !devices.some((device) => device.id === currentDeviceId)) {
      setCurrentDeviceId(devices[0].id);
    }
  }, [currentDeviceId, devices]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const timestamp = Date.now();
      setDevices((previous) =>
        previous.map((device) => {
          const elapsed = timestamp - new Date(device.lastSeen).getTime();
          if (!device.connected || elapsed < device.samplingSeconds * 1000) {
            return device;
          }
          const midpoint = (device.min + device.max) / 2;
          const pull = (midpoint - device.temperature) * 0.012;
          const drift = (Math.random() - 0.49) * 0.16;
          const nextTemperature = Math.min(
            device.max + 4,
            Math.max(device.min - 4, device.temperature + drift + pull),
          );
          return {
            ...device,
            temperature: Number(nextTemperature.toFixed(1)),
            lastSeen: new Date(timestamp).toISOString(),
            battery: Math.max(18, Number((device.battery - 0.002).toFixed(2))),
          };
        }),
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const notify = (message: string, tone: ToastTone = "success") => {
    setToast({ id: Date.now(), message, tone });
  };

  const navigate = (page: Page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const selectDevice = (deviceId: string) => {
    setCurrentDeviceId(deviceId);
  };

  const refreshCurrent = () => {
    if (!currentDevice) return;
    setDevices((previous) =>
      previous.map((device) =>
        device.id === currentDevice.id
          ? {
              ...device,
              lastSeen: new Date().toISOString(),
              temperature: Number(
                Math.max(
                  device.min - 4,
                  Math.min(device.max + 4, device.temperature + (Math.random() - 0.5) * 0.12),
                ).toFixed(1),
              ),
            }
          : device,
      ),
    );
    notify("温度数据已同步", "success");
  };

  const handleAlert = (alertId: string) => {
    setAlerts((previous) => previous.map((alert) => (alert.id === alertId ? { ...alert, handled: true } : alert)));
    notify("告警已标记为处理", "success");
  };

  const handleAllAlerts = () => {
    setAlerts((previous) => previous.map((alert) => ({ ...alert, handled: true })));
    notify("全部告警已标记为处理", "success");
  };

  const handleSaveDevice = (updatedDevice: Device) => {
    setDevices((previous) => previous.map((device) => (device.id === updatedDevice.id ? updatedDevice : device)));
    setCurrentDeviceId(updatedDevice.id);
    const outside = updatedDevice.temperature > updatedDevice.max || updatedDevice.temperature < updatedDevice.min;
    if (outside) {
      setAlerts((previous) => [newAlert(updatedDevice), ...previous]);
    }
    notify(outside ? "设置已保存，当前温度超出新阈值" : "监测设置已保存", outside ? "warning" : "success");
  };

  const handleConnectionToggle = (deviceId: string) => {
    const device = devices.find((item) => item.id === deviceId);
    if (!device) return;
    const nextConnected = !device.connected;
    setDevices((previous) =>
      previous.map((item) =>
        item.id === deviceId
          ? {
              ...item,
              connected: nextConnected,
              lastSeen: nextConnected ? new Date().toISOString() : item.lastSeen,
            }
          : item,
      ),
    );
    notify(nextConnected ? `${device.name} 已连接` : `${device.name} 已断开`, nextConnected ? "success" : "warning");
  };

  const handleConnectDevice = (found: FoundDevice) => {
    const existing = devices.find((device) => device.id === found.id);
    if (existing) {
      setCurrentDeviceId(existing.id);
      setConnectOpen(false);
      notify("已切换到该设备", "success");
      return;
    }
    const device: Device = {
      id: found.id,
      name: found.name,
      location: found.kind === "cold" ? "现场监测点" : "新监测点",
      kind: found.kind,
      temperature: found.temperature,
      min: found.min,
      max: found.max,
      battery: 100,
      signal: 4,
      connected: true,
      samplingSeconds: 5,
      lastSeen: new Date().toISOString(),
      alarmSound: true,
      pushEnabled: true,
      notes: "",
    };
    setDevices((previous) => [...previous, device]);
    setCurrentDeviceId(device.id);
    setCurrentPage("dashboard");
    setConnectOpen(false);
    notify(`${device.name} 已连接`, "success");
  };

  if (!currentDevice) {
    return (
      <div className="empty-app">
        <Thermometer size={34} />
        <h1>尚无监测设备</h1>
        <button className="primary-button" onClick={() => setConnectOpen(true)}>
          <Bluetooth size={18} /> 连接设备
        </button>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        devices={devices}
        currentDeviceId={currentDevice.id}
        currentPage={currentPage}
        pendingAlertCount={pendingAlertCount}
        onNavigate={navigate}
        onSelectDevice={(deviceId) => {
          selectDevice(deviceId);
          navigate("dashboard");
        }}
        onConnect={() => setConnectOpen(true)}
      />

      <div className="workspace">
        <Topbar
          page={currentPage}
          pendingAlertCount={pendingAlertCount}
          onNavigate={navigate}
        />

        <main className="page-content">
          {currentPage === "dashboard" && (
            <DashboardPage
              device={currentDevice}
              devices={devices}
              alerts={alerts}
              onSelectDevice={selectDevice}
              onRefresh={refreshCurrent}
              onNavigate={navigate}
              onHandleAlert={handleAlert}
            />
          )}
          {currentPage === "history" && (
            <HistoryPage
              device={currentDevice}
              devices={devices}
              onSelectDevice={selectDevice}
              onNotify={notify}
            />
          )}
          {currentPage === "alerts" && (
            <AlertsPage
              alerts={alerts}
              onHandleAlert={handleAlert}
              onHandleAll={handleAllAlerts}
            />
          )}
          {currentPage === "devices" && (
            <DevicesPage
              devices={devices}
              alerts={alerts}
              onConnect={() => setConnectOpen(true)}
              onSelectDevice={(deviceId) => {
                selectDevice(deviceId);
                navigate("settings");
              }}
              onToggleConnection={handleConnectionToggle}
            />
          )}
          {currentPage === "settings" && (
            <SettingsPage
              key={currentDevice.id}
              device={currentDevice}
              devices={devices}
              onSelectDevice={selectDevice}
              onSave={handleSaveDevice}
            />
          )}
        </main>
      </div>

      <MobileNav
        currentPage={currentPage}
        pendingAlertCount={pendingAlertCount}
        onNavigate={navigate}
      />

      {connectOpen && (
        <ConnectModal
          devices={devices}
          onClose={() => setConnectOpen(false)}
          onConnect={handleConnectDevice}
        />
      )}

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "brand-compact" : ""}`}>
      <span className="brand-mark">
        <Thermometer size={compact ? 20 : 24} strokeWidth={2.3} />
        <span className="brand-pulse" />
      </span>
      <span className="brand-copy">
        <strong>温联智测</strong>
        {!compact && <small>WENLIAN SENSE</small>}
      </span>
    </div>
  );
}

function DeviceGlyph({ kind, compact = false }: { kind: DeviceKind; compact?: boolean }) {
  const meta = kindMeta[kind];
  const Icon = meta.icon;
  return (
    <span className={`device-glyph ${meta.className} ${compact ? "is-compact" : ""}`}>
      <Icon size={compact ? 15 : 19} />
    </span>
  );
}

function Sidebar({
  devices,
  currentDeviceId,
  currentPage,
  pendingAlertCount,
  onNavigate,
  onSelectDevice,
  onConnect,
}: {
  devices: Device[];
  currentDeviceId: string;
  currentPage: Page;
  pendingAlertCount: number;
  onNavigate: (page: Page) => void;
  onSelectDevice: (deviceId: string) => void;
  onConnect: () => void;
}) {
  const abnormalCount = devices.filter((device) => getStatus(device).tone !== "normal").length;
  return (
    <aside className="sidebar">
      <Brand />
      <button className="connect-button" onClick={onConnect}>
        <Plus size={17} />
        连接新设备
      </button>

      <nav className="side-nav" aria-label="主导航">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.page}
              className={`nav-item ${currentPage === item.page ? "is-active" : ""}`}
              onClick={() => onNavigate(item.page)}
            >
              <Icon size={19} />
              <span>{item.label}</span>
              {item.page === "alerts" && pendingAlertCount > 0 && <b className="nav-badge">{pendingAlertCount}</b>}
            </button>
          );
        })}
      </nav>

      <div className="side-section">
        <div className="side-section-title">
          <span>我的设备</span>
          <span className="quiet">{devices.length} 台</span>
        </div>
        <div className="side-devices">
          {devices.map((device) => {
            const status = getStatus(device);
            return (
              <button
                key={device.id}
                className={`side-device ${currentDeviceId === device.id ? "is-active" : ""}`}
                onClick={() => onSelectDevice(device.id)}
              >
                <DeviceGlyph kind={device.kind} compact />
                <span className="side-device-copy">
                  <strong>{device.name}</strong>
                  <small>{device.temperature.toFixed(1)}°C</small>
                </span>
                <span className={`status-dot ${status.tone}`} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="local-status">
          <span className="live-dot" />
          <span>
            <strong>本地演示运行中</strong>
            <small>{abnormalCount > 0 ? `${abnormalCount} 个监测点需关注` : "全部监测点运行正常"}</small>
          </span>
        </div>
        <div className="sidebar-account">
          <span className="avatar">管</span>
          <span>
            <strong>实验管理员</strong>
            <small>管理端</small>
          </span>
          <Settings size={17} />
        </div>
      </div>
    </aside>
  );
}

function Topbar({
  page,
  pendingAlertCount,
  onNavigate,
}: {
  page: Page;
  pendingAlertCount: number;
  onNavigate: (page: Page) => void;
}) {
  const dateLabel = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date());
  return (
    <header className="topbar">
      <div className="mobile-brand-wrap">
        <Brand compact />
      </div>
      <div className="page-heading">
        <h1>{pageCopy[page].title}</h1>
        <p>{pageCopy[page].subtitle}</p>
      </div>
      <div className="topbar-actions">
        <span className="date-label">{dateLabel}</span>
        <span className="local-pill">
          <span className="live-dot" />
          本地演示
        </span>
        <button className="icon-button" aria-label="告警中心" onClick={() => onNavigate("alerts")}>
          <Bell size={19} />
          {pendingAlertCount > 0 && <span className="notification-dot">{pendingAlertCount}</span>}
        </button>
        <button className="icon-button desktop-settings" aria-label="监测设置" onClick={() => onNavigate("settings")}>
          <Settings size={19} />
        </button>
        <span className="avatar avatar-top">管</span>
      </div>
    </header>
  );
}

function MobileNav({
  currentPage,
  pendingAlertCount,
  onNavigate,
}: {
  currentPage: Page;
  pendingAlertCount: number;
  onNavigate: (page: Page) => void;
}) {
  const mobileItems = navItems.filter((item) => item.page !== "settings");
  return (
    <nav className="mobile-nav" aria-label="移动端导航">
      {mobileItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.page}
            className={currentPage === item.page ? "is-active" : ""}
            onClick={() => onNavigate(item.page)}
          >
            <span className="mobile-nav-icon">
              <Icon size={21} />
              {item.page === "alerts" && pendingAlertCount > 0 && <b>{pendingAlertCount}</b>}
            </span>
            <span>{item.label.replace("温度", "")}</span>
          </button>
        );
      })}
    </nav>
  );
}

function DashboardPage({
  device,
  devices,
  alerts,
  onSelectDevice,
  onRefresh,
  onNavigate,
  onHandleAlert,
}: {
  device: Device;
  devices: Device[];
  alerts: AlertRecord[];
  onSelectDevice: (deviceId: string) => void;
  onRefresh: () => void;
  onNavigate: (page: Page) => void;
  onHandleAlert: (alertId: string) => void;
}) {
  const [trendHours, setTrendHours] = useState(24);
  const readings = useMemo(() => generateReadings(device, trendHours), [device, trendHours]);
  const status = getStatus(device);
  const pendingAlerts = [...alerts]
    .sort((a, b) => {
      if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
      return new Date(b.time).getTime() - new Date(a.time).getTime();
    })
    .slice(0, 3);
  const abnormalCount = devices.filter((item) => getStatus(item).tone !== "normal").length;
  const onlineCount = devices.filter((item) => item.connected).length;

  return (
    <div className="dashboard-grid page-enter">
      <div className="dashboard-main">
        <section className="panel current-panel">
          <div className="panel-header current-header">
            <div>
              <span className="eyebrow">实时温度</span>
              <div className="device-picker">
                <DeviceGlyph kind={device.kind} compact />
                <select
                  value={device.id}
                  onChange={(event) => onSelectDevice(event.target.value)}
                  aria-label="选择监测设备"
                >
                  {devices.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={15} />
              </div>
            </div>
            <button className="secondary-button" onClick={onRefresh}>
              <RefreshCw size={16} />
              同步
            </button>
          </div>

          <div className="current-content">
            <TemperatureGauge device={device} />
            <div className="current-summary">
              <span className={`status-chip ${status.tone}`}>
                <span className="status-dot" />
                {status.label}
              </span>
              <p className="location-line">
                <MapPin size={15} />
                {device.location}
              </p>
              <div className="threshold-block">
                <div>
                  <span>适宜范围</span>
                  <strong>
                    {device.min.toFixed(1)} - {device.max.toFixed(1)}°C
                  </strong>
                </div>
                <RangeTrack device={device} />
              </div>
              <div className="connection-row">
                <span>
                  <Bluetooth size={15} />
                  {device.connected ? "HC-05 已连接" : "蓝牙未连接"}
                </span>
                <span>
                  <Clock size={15} />
                  {formatRelativeTime(device.lastSeen)}
                </span>
              </div>
            </div>
          </div>
        </section>

        <div className="metric-grid">
          <MetricCard
            icon={Signal}
            label="蓝牙信号"
            value={`${device.signal} / 5`}
            hint={device.signal >= 4 ? "信号稳定" : "信号一般"}
            tone="teal"
          />
          <MetricCard
            icon={Battery}
            label="电池电量"
            value={`${Math.round(device.battery)}%`}
            hint={device.battery > 30 ? "续航充足" : "请及时充电"}
            tone="blue"
          />
          <MetricCard
            icon={Clock}
            label="采样周期"
            value={`${device.samplingSeconds} 秒`}
            hint="自动采集"
            tone="amber"
          />
          <MetricCard
            icon={Wifi}
            label="今日在线"
            value="23.8 小时"
            hint="连接稳定"
            tone="coral"
          />
        </div>

        <section className="panel chart-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">温度趋势</span>
              <h2>环境变化曲线</h2>
            </div>
            <div className="segmented" aria-label="趋势时间范围">
              {[
                { value: 6, label: "6 小时" },
                { value: 24, label: "24 小时" },
                { value: 168, label: "7 天" },
              ].map((item) => (
                <button
                  key={item.value}
                  className={trendHours === item.value ? "is-active" : ""}
                  onClick={() => setTrendHours(item.value)}
                  aria-pressed={trendHours === item.value}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <TemperatureChart device={device} readings={readings} hours={trendHours} height={258} />
          <div className="chart-legend">
            <span>
              <i className="legend-line" /> 温度
            </span>
            <span>
              <i className="legend-limit" /> 阈值范围
            </span>
            <button className="text-button" onClick={() => onNavigate("history")}>
              查看全部数据
            </button>
          </div>
        </section>
      </div>

      <aside className="dashboard-rail">
        <section className="panel devices-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">设备概览</span>
              <h2>{onlineCount} 台在线</h2>
            </div>
            <button className="tiny-icon-button" aria-label="设备管理" onClick={() => onNavigate("devices")}>
              <Plus size={17} />
            </button>
          </div>
          <div className="device-overview-list">
            {devices.map((item) => {
              const itemStatus = getStatus(item);
              return (
                <button
                  key={item.id}
                  className={`overview-device ${item.id === device.id ? "is-active" : ""}`}
                  onClick={() => onSelectDevice(item.id)}
                >
                  <DeviceGlyph kind={item.kind} compact />
                  <span className="overview-device-copy">
                    <strong>{item.name}</strong>
                    <small>{item.location}</small>
                  </span>
                  <span className="overview-device-reading">
                    <strong>{item.temperature.toFixed(1)}°</strong>
                    <small className={itemStatus.tone}>{itemStatus.label}</small>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="overview-footer">
            <span className={abnormalCount > 0 ? "attention-text" : "normal-text"}>
              <Activity size={15} />
              {abnormalCount > 0 ? `${abnormalCount} 个监测点温度异常` : "所有监测点状态正常"}
            </span>
            <button className="text-button" onClick={() => onNavigate("devices")}>
              管理
            </button>
          </div>
        </section>

        <section className="panel alerts-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">近期告警</span>
              <h2>{alerts.filter((alert) => !alert.handled && !alert.resolved).length} 条待处理</h2>
            </div>
            <button className="text-button" onClick={() => onNavigate("alerts")}>
              全部
            </button>
          </div>
          <div className="alert-preview-list">
            {pendingAlerts.map((alert) => (
              <AlertPreview key={alert.id} alert={alert} onHandle={onHandleAlert} />
            ))}
          </div>
        </section>

        <section className="system-panel">
          <div className="system-panel-icon">
            <Gauge size={23} />
          </div>
          <div>
            <span>系统运行</span>
            <strong>一切正常</strong>
            <small>蓝牙链路与数据采集服务在线</small>
          </div>
          <span className="system-wave">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        </section>
      </aside>
    </div>
  );
}

function TemperatureGauge({ device }: { device: Device }) {
  const status = getStatus(device);
  const span = Math.max(device.max - device.min, 1);
  const displayMin = device.min - span * 0.2;
  const displayMax = device.max + span * 0.2;
  const progress = Math.max(3, Math.min(97, ((device.temperature - displayMin) / (displayMax - displayMin)) * 100));
  return (
    <div className={`temperature-gauge tone-${status.tone}`}>
      <svg viewBox="0 0 240 136" aria-hidden="true">
        <path className="gauge-track" d="M 28 116 A 92 92 0 0 1 212 116" pathLength="100" />
        <path
          className="gauge-progress"
          d="M 28 116 A 92 92 0 0 1 212 116"
          pathLength="100"
          strokeDasharray={`${progress} 100`}
        />
      </svg>
      <div className="gauge-reading">
        <strong>{device.temperature.toFixed(1)}</strong>
        <span>°C</span>
      </div>
      <div className="gauge-scale">
        <span>低</span>
        <span>适宜区</span>
        <span>高</span>
      </div>
    </div>
  );
}

function RangeTrack({ device }: { device: Device }) {
  const span = Math.max(device.max - device.min, 1);
  const displayMin = device.min - span * 0.35;
  const displayMax = device.max + span * 0.35;
  const safeStart = ((device.min - displayMin) / (displayMax - displayMin)) * 100;
  const safeEnd = ((device.max - displayMin) / (displayMax - displayMin)) * 100;
  const marker = Math.max(4, Math.min(96, ((device.temperature - displayMin) / (displayMax - displayMin)) * 100));
  return (
    <div className="range-track">
      <span className="safe-zone" style={{ left: `${safeStart}%`, width: `${safeEnd - safeStart}%` }} />
      <span className="range-marker" style={{ left: `${marker}%` }} />
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  tone: "teal" | "blue" | "amber" | "coral";
}) {
  return (
    <div className="metric-card">
      <span className={`metric-icon tone-${tone}`}>
        <Icon size={18} />
      </span>
      <div>
        <span className="metric-label">{label}</span>
        <strong>{value}</strong>
        <small>{hint}</small>
      </div>
    </div>
  );
}

function TemperatureChart({
  device,
  readings,
  hours,
  height,
}: {
  device: Device;
  readings: Reading[];
  hours: number;
  height: number;
}) {
  const data = readings.map((reading) => ({
    time: reading.time,
    temperature: reading.temperature,
    min: device.min,
    max: device.max,
  }));
  return (
    <div className="chart-wrap" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e6ece8" strokeDasharray="3 5" vertical={false} />
          <XAxis
            dataKey="time"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#81908a", fontSize: 11 }}
            tickFormatter={(value) => formatChartTime(Number(value), hours)}
            minTickGap={36}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={46}
            tick={{ fill: "#81908a", fontSize: 11 }}
            tickFormatter={(value) => `${value}°`}
            domain={["dataMin - 1", "dataMax + 1"]}
          />
          <Tooltip
            cursor={{ stroke: "#b8c8c1", strokeDasharray: "4 4" }}
            contentStyle={{
              border: "1px solid #dce5df",
              borderRadius: 8,
              boxShadow: "0 10px 26px rgba(21, 54, 47, .1)",
              fontSize: 12,
            }}
            labelFormatter={(label) => formatChartTime(Number(label), hours)}
            formatter={(value) => [`${Number(value).toFixed(1)}°C`, "温度"]}
          />
          <ReferenceLine y={device.max} stroke="#e2a457" strokeDasharray="5 4" />
          <ReferenceLine y={device.min} stroke="#e2a457" strokeDasharray="5 4" />
          <Area
            type="monotone"
            dataKey="temperature"
            stroke="#247d70"
            strokeWidth={2.3}
            fill="#5ca99a"
            fillOpacity={0.13}
            activeDot={{ r: 4, fill: "#247d70", stroke: "#fff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function AlertPreview({ alert, onHandle }: { alert: AlertRecord; onHandle: (id: string) => void }) {
  return (
    <div className={`alert-preview ${alert.resolved ? "is-resolved" : ""}`}>
      <span className={`alert-icon ${alert.severity}`}>
        {alert.resolved ? <Check size={16} /> : <AlertTriangle size={16} />}
      </span>
      <div className="alert-preview-copy">
        <strong>{alert.message}</strong>
        <span>{alert.deviceName}</span>
        <small>{formatRelativeTime(alert.time)}</small>
      </div>
      {!alert.handled && !alert.resolved ? (
        <button className="alert-check" aria-label="标记已处理" title="标记已处理" onClick={() => onHandle(alert.id)}>
          <Check size={15} />
        </button>
      ) : (
        <span className="resolved-label">已处理</span>
      )}
    </div>
  );
}

function HistoryPage({
  device,
  devices,
  onSelectDevice,
  onNotify,
}: {
  device: Device;
  devices: Device[];
  onSelectDevice: (deviceId: string) => void;
  onNotify: (message: string, tone?: ToastTone) => void;
}) {
  const [rangeHours, setRangeHours] = useState(24);
  const readings = useMemo(() => generateReadings(device, rangeHours), [device, rangeHours]);
  const temperatures = readings.map((reading) => reading.temperature);
  const average = temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length;
  const inRange = readings.filter(
    (reading) => reading.temperature >= device.min && reading.temperature <= device.max,
  ).length;
  const compliance = Math.round((inRange / readings.length) * 100);
  const rangeLabel = rangeHours === 24 ? "24 小时" : rangeHours === 168 ? "7 天" : "30 天";

  const exportData = async () => {
    await exportReadingsXlsx(device, readings);
    onNotify("Excel 温度记录已生成", "success");
  };

  return (
    <div className="page-stack page-enter">
      <section className="panel data-toolbar">
        <div className="data-device-field">
          <span className="field-label">当前设备</span>
          <div className="select-field">
            <DeviceGlyph kind={device.kind} compact />
            <select value={device.id} onChange={(event) => onSelectDevice(event.target.value)}>
              {devices.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <ChevronDown size={16} />
          </div>
        </div>
        <div className="data-range-field">
          <span className="field-label">时间范围</span>
          <div className="segmented">
            {[
              { value: 24, label: "24 小时" },
              { value: 168, label: "7 天" },
              { value: 720, label: "30 天" },
            ].map((item) => (
              <button
                key={item.value}
                className={rangeHours === item.value ? "is-active" : ""}
                onClick={() => setRangeHours(item.value)}
                aria-pressed={rangeHours === item.value}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <button className="primary-button" onClick={exportData}>
          <Download size={17} />
          导出 Excel
        </button>
      </section>

      <div className="stats-grid">
        <StatCard label={`${rangeLabel}平均温度`} value={`${average.toFixed(1)}°C`} delta="波动平稳" tone="teal" />
        <StatCard label="最高温度" value={`${Math.max(...temperatures).toFixed(1)}°C`} delta={`上限 ${device.max.toFixed(1)}°C`} tone="coral" />
        <StatCard label="最低温度" value={`${Math.min(...temperatures).toFixed(1)}°C`} delta={`下限 ${device.min.toFixed(1)}°C`} tone="blue" />
        <StatCard label="区间达标率" value={`${compliance}%`} delta="按设定阈值计算" tone="amber" />
      </div>

      <section className="panel history-chart-panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">历史曲线</span>
            <h2>{device.name}</h2>
          </div>
          <span className="record-count">{readings.length} 条采样记录</span>
        </div>
        <TemperatureChart device={device} readings={readings} hours={rangeHours} height={320} />
      </section>

      <section className="panel history-table-panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">采样明细</span>
            <h2>最近记录</h2>
          </div>
          <span className="quiet">每 {device.samplingSeconds} 秒采集</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>采集时间</th>
                <th>温度</th>
                <th>阈值状态</th>
                <th>设备</th>
              </tr>
            </thead>
            <tbody>
              {[...readings]
                .slice(-10)
                .reverse()
                .map((reading) => {
                  const normal = reading.temperature >= device.min && reading.temperature <= device.max;
                  return (
                    <tr key={reading.time}>
                      <td>{formatFullTime(new Date(reading.time).toISOString())}</td>
                      <td className="temperature-cell">{reading.temperature.toFixed(1)}°C</td>
                      <td>
                        <span className={`table-status ${normal ? "normal" : "warning"}`}>
                          <span className="status-dot" />
                          {normal ? "正常" : "越限"}
                        </span>
                      </td>
                      <td>{device.name}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  delta,
  tone,
}: {
  label: string;
  value: string;
  delta: string;
  tone: "teal" | "blue" | "amber" | "coral";
}) {
  return (
    <div className="stat-card">
      <span className={`stat-accent ${tone}`} />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{delta}</small>
    </div>
  );
}

function AlertsPage({
  alerts,
  onHandleAlert,
  onHandleAll,
}: {
  alerts: AlertRecord[];
  onHandleAlert: (alertId: string) => void;
  onHandleAll: () => void;
}) {
  const [filter, setFilter] = useState<AlertFilter>("pending");
  const filteredAlerts = alerts.filter((alert) => {
    if (filter === "pending") return !alert.handled && !alert.resolved;
    if (filter === "resolved") return alert.resolved || alert.handled;
    return true;
  });
  const pendingCount = alerts.filter((alert) => !alert.handled && !alert.resolved).length;
  return (
    <div className="page-stack page-enter">
      <section className="alert-summary">
        <div className="alert-summary-icon">
          <CircleAlert size={25} />
        </div>
        <div>
          <span>待处理告警</span>
          <strong>{pendingCount} 条</strong>
          <p>{pendingCount > 0 ? "建议优先处理持续超限与高风险设备" : "目前没有待处理告警"}</p>
        </div>
        <button className="secondary-button" disabled={pendingCount === 0} onClick={onHandleAll}>
          <Check size={16} />
          全部标记已处理
        </button>
      </section>

      <section className="panel alerts-center-panel">
        <div className="alerts-filter-header">
          <div className="segmented">
            {[
              { value: "pending", label: "待处理" },
              { value: "resolved", label: "已处理" },
              { value: "all", label: "全部" },
            ].map((item) => (
              <button
                key={item.value}
                className={filter === item.value ? "is-active" : ""}
                onClick={() => setFilter(item.value as AlertFilter)}
                aria-pressed={filter === item.value}
              >
                {item.label}
              </button>
            ))}
          </div>
          <span className="quiet">共 {filteredAlerts.length} 条记录</span>
        </div>

        <div className="alert-list">
          {filteredAlerts.map((alert) => (
            <article key={alert.id} className={`alert-card ${alert.handled || alert.resolved ? "is-handled" : ""}`}>
              <div className={`alert-card-rail ${alert.severity}`} />
              <span className={`alert-card-icon ${alert.severity}`}>
                {alert.handled || alert.resolved ? <Check size={19} /> : <AlertTriangle size={19} />}
              </span>
              <div className="alert-card-main">
                <div className="alert-card-title-line">
                  <strong>{alert.message}</strong>
                  <span className={`severity-tag ${alert.severity}`}>
                    {alert.severity === "critical" ? "高风险" : "温度异常"}
                  </span>
                </div>
                <p>{alert.detail}</p>
                <div className="alert-meta">
                  <span>
                    <MapPin size={14} /> {alert.location}
                  </span>
                  <span>
                    <Clock size={14} /> {formatFullTime(alert.time)}
                  </span>
                </div>
              </div>
              <div className="alert-card-action">
                {alert.handled || alert.resolved ? (
                  <span className="handled-label">
                    <Check size={15} /> 已处理
                  </span>
                ) : (
                  <button className="primary-button compact" onClick={() => onHandleAlert(alert.id)}>
                    标记已处理
                  </button>
                )}
              </div>
            </article>
          ))}
          {filteredAlerts.length === 0 && (
            <div className="empty-state">
              <span className="empty-state-icon">
                <Check size={25} />
              </span>
              <h3>这里已经清空</h3>
              <p>{filter === "pending" ? "当前没有待处理告警" : "该分类下暂无记录"}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function DevicesPage({
  devices,
  alerts,
  onConnect,
  onSelectDevice,
  onToggleConnection,
}: {
  devices: Device[];
  alerts: AlertRecord[];
  onConnect: () => void;
  onSelectDevice: (deviceId: string) => void;
  onToggleConnection: (deviceId: string) => void;
}) {
  const onlineCount = devices.filter((device) => device.connected).length;
  return (
    <div className="page-stack page-enter">
      <section className="device-page-hero">
        <div>
          <span className="eyebrow">设备网络</span>
          <h2>{onlineCount} 台设备保持连接</h2>
          <p>支持多点位集中监测，当前最多可绑定 10 台温联终端。</p>
        </div>
        <button className="primary-button" onClick={onConnect}>
          <Plus size={18} />
          连接新设备
        </button>
        <div className="device-network-visual" aria-hidden="true">
          <span className="network-center">
            <Bluetooth size={24} />
          </span>
          <span className="network-node node-1" />
          <span className="network-node node-2" />
          <span className="network-node node-3" />
          <span className="network-node node-4" />
          <i className="network-line line-1" />
          <i className="network-line line-2" />
          <i className="network-line line-3" />
          <i className="network-line line-4" />
        </div>
      </section>

      <div className="device-card-grid">
        {devices.map((device) => {
          const status = getStatus(device);
          const deviceAlerts = alerts.filter(
            (alert) => alert.deviceId === device.id && !alert.handled && !alert.resolved,
          ).length;
          return (
            <article className="device-card" key={device.id}>
              <div className="device-card-top">
                <DeviceGlyph kind={device.kind} />
                <div>
                  <h3>{device.name}</h3>
                  <p>
                    <MapPin size={13} />
                    {device.location}
                  </p>
                </div>
                <span className={`status-chip small ${status.tone}`}>
                  <span className="status-dot" />
                  {device.connected ? "在线" : "离线"}
                </span>
              </div>

              <div className="device-card-reading">
                <strong>{device.temperature.toFixed(1)}°C</strong>
                <span>
                  适宜 {device.min.toFixed(1)} - {device.max.toFixed(1)}°C
                </span>
              </div>

              <div className="device-card-stats">
                <span>
                  <Battery size={15} /> {Math.round(device.battery)}%
                </span>
                <span>
                  <Signal size={15} /> {device.signal}/5
                </span>
                <span>
                  <Clock size={15} /> {device.samplingSeconds}s
                </span>
              </div>

              <div className="device-card-footer">
                <span className={deviceAlerts > 0 ? "attention-text" : "quiet"}>
                  {deviceAlerts > 0 ? `${deviceAlerts} 条待处理告警` : "暂无待处理告警"}
                </span>
                <div className="device-card-actions">
                  <button className="text-button" onClick={() => onSelectDevice(device.id)}>
                    设置
                  </button>
                  <button
                    className={`mini-button ${device.connected ? "disconnect" : "connect"}`}
                    onClick={() => onToggleConnection(device.id)}
                  >
                    {device.connected ? <Unplug size={15} /> : <Bluetooth size={15} />}
                    {device.connected ? "断开" : "连接"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function SettingsPage({
  device,
  devices,
  onSelectDevice,
  onSave,
}: {
  device: Device;
  devices: Device[];
  onSelectDevice: (deviceId: string) => void;
  onSave: (device: Device) => void;
}) {
  const [draft, setDraft] = useState<Device>(device);
  const invalidThreshold = draft.min >= draft.max;
  const update = <K extends keyof Device>(key: K, value: Device[K]) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
  };

  return (
    <div className="settings-layout page-enter">
      <div className="settings-main">
        <section className="panel settings-panel">
          <div className="settings-panel-header">
            <div>
              <span className="eyebrow">当前终端</span>
              <h2>设备与监测点位</h2>
            </div>
            <div className="select-field settings-device-select">
              <DeviceGlyph kind={device.kind} compact />
              <select value={device.id} onChange={(event) => onSelectDevice(event.target.value)}>
                {devices.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} />
            </div>
          </div>
          <div className="form-grid">
            <label className="form-field">
              <span>设备名称</span>
              <input value={draft.name} onChange={(event) => update("name", event.target.value)} />
            </label>
            <label className="form-field">
              <span>监测位置</span>
              <div className="input-with-icon">
                <MapPin size={16} />
                <input value={draft.location} onChange={(event) => update("location", event.target.value)} />
              </div>
            </label>
            <label className="form-field form-field-wide">
              <span>场景备注</span>
              <input
                value={draft.notes}
                onChange={(event) => update("notes", event.target.value)}
                placeholder="例如：样品冷藏区"
              />
            </label>
          </div>
        </section>

        <section className="panel settings-panel">
          <div className="settings-panel-header">
            <div>
              <span className="eyebrow">报警规则</span>
              <h2>温度适宜范围</h2>
            </div>
            <span className="rule-preview">
              {draft.min.toFixed(1)} - {draft.max.toFixed(1)}°C
            </span>
          </div>
          <div className="threshold-editor">
            <NumberStepper
              label="温度下限"
              value={draft.min}
              step={0.5}
              onChange={(value) => update("min", value)}
              tone="cool"
            />
            <div className="threshold-divider">
              <span />
              <strong>适宜区间</strong>
              <span />
            </div>
            <NumberStepper
              label="温度上限"
              value={draft.max}
              step={0.5}
              onChange={(value) => update("max", value)}
              tone="warm"
            />
          </div>
          {invalidThreshold && <p className="form-error">温度下限必须小于上限。</p>}
          <div className="settings-note">
            <AlertTriangle size={17} />
            当温度超过设定范围时，终端触发本地声光报警，应用同步生成告警记录。
          </div>
        </section>

        <section className="panel settings-panel">
          <div className="settings-panel-header">
            <div>
              <span className="eyebrow">采集策略</span>
              <h2>采样与通知</h2>
            </div>
          </div>
          <div className="setting-rows">
            <div className="setting-row">
              <span className="setting-row-icon">
                <Clock size={18} />
              </span>
              <div className="setting-row-copy">
                <strong>采样周期</strong>
                <span>控制终端自动采集并上传温度数据的频率</span>
              </div>
              <div className="compact-select">
                <select
                  value={draft.samplingSeconds}
                  onChange={(event) => update("samplingSeconds", Number(event.target.value))}
                >
                  {sampleOptions.map((seconds) => (
                    <option key={seconds} value={seconds}>
                      {seconds < 60 ? `${seconds} 秒` : `${seconds / 60} 分钟`}
                    </option>
                  ))}
                </select>
                <ChevronDown size={15} />
              </div>
            </div>
            <ToggleRow
              icon={Bell}
              title="本地声光报警"
              description="温度越限时触发蜂鸣器与 LED 警示"
              checked={draft.alarmSound}
              onChange={(checked) => update("alarmSound", checked)}
            />
            <ToggleRow
              icon={Wifi}
              title="应用告警提醒"
              description="应用在前台时即时提示异常温度"
              checked={draft.pushEnabled}
              onChange={(checked) => update("pushEnabled", checked)}
            />
          </div>
        </section>
      </div>

      <aside className="settings-aside">
        <section className="panel device-profile-card">
          <span className="device-profile-orbit" />
          <DeviceGlyph kind={device.kind} />
          <h3>{draft.name}</h3>
          <p>{draft.location}</p>
          <div className="profile-reading">
            <Thermometer size={18} />
            <strong>{draft.temperature.toFixed(1)}°C</strong>
          </div>
          <div className="profile-meta">
            <span>
              <Bluetooth size={15} /> HC-05
            </span>
            <span>
              <Battery size={15} /> {Math.round(draft.battery)}%
            </span>
          </div>
        </section>
        <section className="panel save-panel">
          <strong>应用新设置</strong>
          <p>保存后会同步更新本设备的监测范围与采样策略。</p>
          <button className="primary-button full-width" disabled={invalidThreshold} onClick={() => onSave(draft)}>
            <Check size={17} />
            保存设置
          </button>
        </section>
      </aside>
    </div>
  );
}

function NumberStepper({
  label,
  value,
  step,
  onChange,
  tone,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (value: number) => void;
  tone: "cool" | "warm";
}) {
  return (
    <div className={`number-stepper ${tone}`}>
      <span>{label}</span>
      <div>
        <button aria-label={`${label}减少`} onClick={() => onChange(Number((value - step).toFixed(1)))}>
          <Minus size={18} />
        </button>
        <label>
          <input
            type="number"
            value={value}
            step={step}
            onChange={(event) => onChange(Number(event.target.value))}
          />
          <i>°C</i>
        </label>
        <button aria-label={`${label}增加`} onClick={() => onChange(Number((value + step).toFixed(1)))}>
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="setting-row">
      <span className="setting-row-icon">
        <Icon size={18} />
      </span>
      <div className="setting-row-copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <button
        className={`toggle ${checked ? "is-on" : ""}`}
        role="switch"
        aria-checked={checked}
        aria-label={title}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  );
}

function ConnectModal({
  devices,
  onClose,
  onConnect,
}: {
  devices: Device[];
  onClose: () => void;
  onConnect: (device: FoundDevice) => void;
}) {
  const [scanning, setScanning] = useState(true);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setScanning(false), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  const connect = (device: FoundDevice) => {
    setConnectingId(device.id);
    window.setTimeout(() => onConnect(device), 700);
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="connect-modal" role="dialog" aria-modal="true" aria-labelledby="connect-title">
        <div className="modal-header">
          <div>
            <span className="eyebrow">蓝牙设备</span>
            <h2 id="connect-title">连接监测终端</h2>
          </div>
          <button className="icon-button" aria-label="关闭" onClick={onClose}>
            <X size={19} />
          </button>
        </div>

        <div className={`scan-visual ${scanning ? "is-scanning" : ""}`}>
          <span className="scan-ring ring-one" />
          <span className="scan-ring ring-two" />
          <span className="scan-core">
            <Bluetooth size={25} />
          </span>
          <span className="scan-node scan-node-one" />
          <span className="scan-node scan-node-two" />
          <span className="scan-node scan-node-three" />
        </div>

        <div className="scan-status">
          {scanning ? (
            <>
              <LoaderCircle size={16} className="spin" />
              正在搜索附近的 HC-05 设备
            </>
          ) : (
            <>
              <Search size={16} />
              发现 {foundDevices.length} 台可连接设备
            </>
          )}
        </div>

        <div className="found-devices">
          {!scanning &&
            foundDevices.map((found) => {
              const added = devices.some((device) => device.id === found.id);
              const isConnecting = connectingId === found.id;
              return (
                <div className="found-device" key={found.id}>
                  <DeviceGlyph kind={found.kind} compact />
                  <div>
                    <strong>{found.name}</strong>
                    <span>{found.description}</span>
                  </div>
                  <button
                    className={added ? "secondary-button small" : "primary-button small"}
                    onClick={() => connect(found)}
                    disabled={isConnecting}
                  >
                    {isConnecting ? (
                      <>
                        <LoaderCircle size={15} className="spin" />
                        连接中
                      </>
                    ) : added ? (
                      "打开"
                    ) : (
                      "连接"
                    )}
                  </button>
                </div>
              );
            })}
        </div>

        <p className="modal-note">
          <Wifi size={14} />
          演示环境使用模拟蓝牙设备，接入真机后可替换为原生 HC-05 串口链路。
        </p>
      </div>
    </div>
  );
}

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  return (
    <div className={`toast toast-${toast.tone}`} role="status">
      <span className="toast-icon">
        {toast.tone === "success" ? <Check size={17} /> : <AlertTriangle size={17} />}
      </span>
      <span>{toast.message}</span>
      <button aria-label="关闭提示" onClick={onClose}>
        <X size={15} />
      </button>
    </div>
  );
}

function SectionIcon({ children }: { children: ReactNode }) {
  return <span className="section-icon">{children}</span>;
}

void SectionIcon;

export default App;
