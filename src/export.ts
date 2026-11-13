import type { Device } from "./types";


export async function exportReadingsXlsx(device: Device, rows: { time: number; temperature: number }[]) {
  const XLSX = await import("xlsx");
  const sheetRows = rows.map((row) => ({
    时间: new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .format(new Date(row.time))
      .replaceAll("/", "-"),
    "温度(°C)": row.temperature,
    设备: device.name,
    位置: device.location,
    "下限(°C)": device.min,
    "上限(°C)": device.max,
  }));
  const worksheet = XLSX.utils.json_to_sheet(sheetRows);
  worksheet["!cols"] = [{ wch: 22 }, { wch: 14 }, { wch: 24 }, { wch: 22 }, { wch: 12 }, { wch: 12 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "温度记录");
  XLSX.writeFile(workbook, `${device.name}-温度记录-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
