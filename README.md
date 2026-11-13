# 温联智测

面向高校实验室、仓储冷链、农业育苗与小型机房的轻量化温度监测应用。当前版本是可运行的手机优先 PWA，同时适配桌面端。

在线访问：https://serein985.github.io/wenlian-zhice/

## 已实现

- 实时温度、阈值状态、蓝牙连接与采样状态
- 6 小时、24 小时、7 天温度曲线
- 历史数据查询与 Excel 导出
- 温度上下限、采样周期、声光报警与应用提醒设置
- 超限告警生成、告警记录与处理状态
- 多设备绑定、设备连接与断开
- 本地数据持久化、PWA 安装与离线缓存
- 手机与桌面响应式布局

## 本机运行

开发模式：

```powershell
npm install
npm run dev
```

打开 `http://localhost:5173/`。

已构建版本：

```powershell
node serve.mjs
```

打开 `http://localhost:4173/`。手机与电脑在同一局域网时，可通过电脑局域网 IP 加端口访问。

## 生产构建

```powershell
npm run build
```

构建结果位于 `dist/`。

## 硬件接入边界

当前版本的蓝牙配对、设备发现与温度变化为可交互模拟数据。HC-05 使用 Bluetooth Classic SPP，普通浏览器不能直接访问其串口通道。接入真实硬件时需要：

1. Android 原生桥接：使用 Android Bluetooth Classic SPP 读取 HC-05 数据，再通过 WebView bridge 调用当前应用。
2. 或者开发 4G/Wi-Fi 网关，将终端数据上传到云接口，应用通过轮询或 WebSocket 接收。

界面、阈值规则、告警记录、历史数据和 Excel 导出已经按真实业务闭环实现，后续只需替换数据来源。
