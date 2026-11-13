import type { AlertRecord, Device, FoundDevice, Reading } from "./types";

const now = () => new Date().toISOString();

export const initialDevices: Device[] = [
  {
    id: "lab-fridge-01",
    name: "实验室低温冰箱",
    location: "材料实验室 · A 区",
    kind: "lab",
    temperature: 4.6,
    min: 2,
    max: 8,
    battery: 87,
    signal: 4,
    connected: true,
    samplingSeconds: 5,
    lastSeen: now(),
    alarmSound: true,
    pushEnabled: true,
    notes: "样品冷藏区",
  },
  {
    id: "drug-cold-a",
    name: "药品冷库 A",
    location: "校医院药房",
    kind: "cold",
    temperature: 9.2,
    min: 2,
    max: 8,
    battery: 73,
    signal: 3,
    connected: true,
    samplingSeconds: 10,
    lastSeen: now(),
    alarmSound: true,
    pushEnabled: true,
    notes: "2-8°C 药品存储",
  },
  {
    id: "seedling-east",
    name: "育苗棚 · 东区",
    location: "农学试验站",
    kind: "greenhouse",
    temperature: 26.8,
    min: 18,
    max: 32,
    battery: 64,
    signal: 4,
    connected: true,
    samplingSeconds: 30,
    lastSeen: now(),
    alarmSound: false,
    pushEnabled: true,
    notes: "番茄育苗区",
  },
  {
    id: "server-room-01",
    name: "机房温控点 1",
    location: "综合楼 · 302",
    kind: "equipment",
    temperature: 31.4,
    min: 16,
    max: 28,
    battery: 91,
    signal: 5,
    connected: true,
    samplingSeconds: 5,
    lastSeen: now(),
    alarmSound: true,
    pushEnabled: true,
    notes: "网络机柜上层",
  },
];

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export const initialAlerts: AlertRecord[] = [
  {
    id: "alert-server-1",
    deviceId: "server-room-01",
    deviceName: "机房温控点 1",
    location: "综合楼 · 302",
    severity: "critical",
    message: "温度持续超过上限",
    detail: "当前 31.4°C，高于上限 28.0°C，已持续 12 分钟。",
    time: minutesAgo(12),
    handled: false,
    resolved: false,
  },
  {
    id: "alert-cold-1",
    deviceId: "drug-cold-a",
    deviceName: "药品冷库 A",
    location: "校医院药房",
    severity: "warning",
    message: "冷库温度轻微超标",
    detail: "当前 9.2°C，高于上限 8.0°C，请检查柜门与制冷状态。",
    time: minutesAgo(34),
    handled: false,
    resolved: false,
  },
  {
    id: "alert-lab-1",
    deviceId: "lab-fridge-01",
    deviceName: "实验室低温冰箱",
    location: "材料实验室 · A 区",
    severity: "warning",
    message: "温度已恢复正常",
    detail: "温度曾达到 8.7°C，现回落至 4.6°C，波动持续 6 分钟。",
    time: minutesAgo(186),
    handled: true,
    resolved: true,
  },
  {
    id: "alert-seed-1",
    deviceId: "seedling-east",
    deviceName: "育苗棚 · 东区",
    location: "农学试验站",
    severity: "warning",
    message: "夜间温度低于下限",
    detail: "温度曾降至 16.8°C，低于下限 18.0°C，现已恢复。",
    time: minutesAgo(1_560),
    handled: true,
    resolved: true,
  },
];

export const foundDevices: FoundDevice[] = [
  {
    id: "hc05-05",
    name: "温联 WL-05",
    description: "HC-05 · 信号良好",
    kind: "lab",
    temperature: 22.4,
    min: 16,
    max: 28,
  },
  {
    id: "hc05-06",
    name: "温联 WL-06",
    description: "HC-05 · 信号中等",
    kind: "cold",
    temperature: 5.1,
    min: 2,
    max: 8,
  },
];

const seededNoise = (seed: number) => {
  const value = Math.sin(seed * 12.9898) * 43_758.5453;
  return value - Math.floor(value);
};

export function generateReadings(device: Device, hours: number): Reading[] {
  const pointCount = hours <= 24 ? 96 : hours <= 168 ? 168 : 240;
  const spacing = (hours * 60 * 60 * 1000) / (pointCount - 1);
  const amplitude = Math.max((device.max - device.min) * 0.18, 1.2);
  const current = Date.now();

  return Array.from({ length: pointCount }, (_, index) => {
    const age = pointCount - index - 1;
    const wave =
      Math.sin(index / (hours <= 24 ? 8.5 : 18)) * amplitude +
      Math.cos(index / (hours <= 24 ? 21 : 44)) * amplitude * 0.34;
    const noise = (seededNoise(index + device.temperature * 3) - 0.5) * amplitude * 0.45;
    const edgeFade = index === pointCount - 1 ? 0 : 0.55;
    const temperature =
      device.temperature +
      (wave + noise) * edgeFade -
      (device.temperature - (device.min + device.max) / 2) * (device.temperature > device.max ? 0.55 : 0.15);

    return {
      time: current - age * spacing,
      temperature: Number(temperature.toFixed(1)),
    };
  });
}
