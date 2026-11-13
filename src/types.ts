export type Page = "dashboard" | "history" | "alerts" | "devices" | "settings";
export type DeviceKind = "lab" | "cold" | "greenhouse" | "equipment";
export type AlertSeverity = "critical" | "warning";

export interface Device {
  id: string;
  name: string;
  location: string;
  kind: DeviceKind;
  temperature: number;
  min: number;
  max: number;
  battery: number;
  signal: number;
  connected: boolean;
  samplingSeconds: number;
  lastSeen: string;
  alarmSound: boolean;
  pushEnabled: boolean;
  notes: string;
}

export interface Reading {
  time: number;
  temperature: number;
}

export interface AlertRecord {
  id: string;
  deviceId: string;
  deviceName: string;
  location: string;
  severity: AlertSeverity;
  message: string;
  detail: string;
  time: string;
  handled: boolean;
  resolved: boolean;
}

export interface FoundDevice {
  id: string;
  name: string;
  description: string;
  kind: DeviceKind;
  temperature: number;
  min: number;
  max: number;
}
