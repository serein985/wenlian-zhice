import type { Device } from "./types";

export function getStatus(device: Device) {
  if (!device.connected) {
    return { label: "已断开", tone: "offline" as const };
  }
  if (device.temperature > device.max) {
    return { label: "高于上限", tone: "danger" as const };
  }
  if (device.temperature < device.min) {
    return { label: "低于下限", tone: "warning" as const };
  }
  return { label: "运行正常", tone: "normal" as const };
}

export function formatTemperature(value: number) {
  return `${value.toFixed(1)}°C`;
}

export function formatRelativeTime(isoTime: string) {
  const distance = Date.now() - new Date(isoTime).getTime();
  const minutes = Math.max(0, Math.floor(distance / 60_000));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

export function formatFullTime(isoTime: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(isoTime));
}

export function formatChartTime(timestamp: number, hours: number) {
  const date = new Date(timestamp);
  if (hours > 24) {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function exportReadingsCsv(device: Device, rows: { time: number; temperature: number }[]) {
  const header = "时间,温度(°C),设备,位置,下限(°C),上限(°C)";
  const data = rows.map((row) => {
    const time = new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .format(new Date(row.time))
      .replaceAll("/", "-");
    return [time, row.temperature.toFixed(1), device.name, device.location, device.min, device.max]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(",");
  });
  const blob = new Blob([`\uFEFF${header}\n${data.join("\n")}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${device.name}-温度记录-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
