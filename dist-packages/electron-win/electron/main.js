const { app, BrowserWindow, shell, Menu, Tray } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");

const SERVER_PORT = 8765;
let mainWindow = null;
let serverProcess = null;
let tray = null;

// ── Locate bundled server ─────────────────────────────────────────────────────
function getServerPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "server", "index.mjs");
  }
  return path.join(__dirname, "..", "dist", "server", "index.mjs");
}

function getFrontendPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "server", "public");
  }
  return path.join(__dirname, "..", "dist", "server", "public");
}

// ── Start the Express server ──────────────────────────────────────────────────
function startServer() {
  return new Promise((resolve, reject) => {
    const serverPath = getServerPath();

    if (!fs.existsSync(serverPath)) {
      reject(new Error(`Server bundle not found at: ${serverPath}\nRun 'npm run build-server' first.`));
      return;
    }

    const env = {
      ...process.env,
      PORT: String(SERVER_PORT),
      BASE_PATH: "/",
      NODE_ENV: "production",
    };

    // Pass through database URL if set
    if (process.env.DATABASE_URL) {
      env.DATABASE_URL = process.env.DATABASE_URL;
    }

    serverProcess = spawn(process.execPath, ["--enable-source-maps", serverPath], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    serverProcess.stdout.on("data", (data) => {
      console.log("[server]", data.toString().trim());
    });

    serverProcess.stderr.on("data", (data) => {
      console.error("[server:err]", data.toString().trim());
    });

    serverProcess.on("error", (err) => {
      console.error("Server process error:", err);
      reject(err);
    });

    serverProcess.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        console.error(`Server exited with code ${code}`);
      }
    });

    // Poll until the server is accepting connections
    const startTime = Date.now();
    const pollInterval = setInterval(() => {
      const req = http.get(`http://127.0.0.1:${SERVER_PORT}/api/healthz`, (res) => {
        if (res.statusCode === 200) {
          clearInterval(pollInterval);
          resolve();
        }
      });
      req.on("error", () => {
        if (Date.now() - startTime > 30000) {
          clearInterval(pollInterval);
          reject(new Error("Server failed to start within 30 seconds"));
        }
      });
      req.end();
    }, 500);
  });
}

// ── Create the main window ────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "NSE/BSE AI Trading Terminal",
    backgroundColor: "#0a0a0a",
    icon: path.join(__dirname, "icon.ico"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    show: false,
    frame: true,
    titleBarStyle: "default",
  });

  // Remove default menu bar
  Menu.setApplicationMenu(buildMenu());

  mainWindow.loadURL(`http://127.0.0.1:${SERVER_PORT}/`);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(`http://127.0.0.1:${SERVER_PORT}`)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── Application menu ──────────────────────────────────────────────────────────
function buildMenu() {
  const template = [
    {
      label: "Terminal",
      submenu: [
        { label: "Reload", accelerator: "CmdOrCtrl+R", click: () => mainWindow?.reload() },
        { label: "Hard Reload", accelerator: "CmdOrCtrl+Shift+R", click: () => mainWindow?.webContents.reloadIgnoringCache() },
        { type: "separator" },
        { label: "Quit", accelerator: "Alt+F4", click: () => app.quit() },
      ],
    },
    {
      label: "View",
      submenu: [
        { label: "Dashboard", accelerator: "CmdOrCtrl+1", click: () => mainWindow?.loadURL(`http://127.0.0.1:${SERVER_PORT}/`) },
        { label: "Signals", accelerator: "CmdOrCtrl+2", click: () => mainWindow?.loadURL(`http://127.0.0.1:${SERVER_PORT}/signals`) },
        { label: "Market Feed", accelerator: "CmdOrCtrl+3", click: () => mainWindow?.loadURL(`http://127.0.0.1:${SERVER_PORT}/market`) },
        { label: "Charts", accelerator: "CmdOrCtrl+4", click: () => mainWindow?.loadURL(`http://127.0.0.1:${SERVER_PORT}/charts`) },
        { label: "Technical Analysis", accelerator: "CmdOrCtrl+5", click: () => mainWindow?.loadURL(`http://127.0.0.1:${SERVER_PORT}/analysis`) },
        { label: "Options Chain", accelerator: "CmdOrCtrl+6", click: () => mainWindow?.loadURL(`http://127.0.0.1:${SERVER_PORT}/options`) },
        { label: "Futures", accelerator: "CmdOrCtrl+7", click: () => mainWindow?.loadURL(`http://127.0.0.1:${SERVER_PORT}/futures`) },
        { type: "separator" },
        { label: "Toggle DevTools", accelerator: "F12", click: () => mainWindow?.webContents.toggleDevTools() },
        { label: "Zoom In", accelerator: "CmdOrCtrl+Plus", click: () => { const z = mainWindow?.webContents.getZoomLevel(); mainWindow?.webContents.setZoomLevel((z || 0) + 0.5); } },
        { label: "Zoom Out", accelerator: "CmdOrCtrl+-", click: () => { const z = mainWindow?.webContents.getZoomLevel(); mainWindow?.webContents.setZoomLevel((z || 0) - 0.5); } },
        { label: "Reset Zoom", accelerator: "CmdOrCtrl+0", click: () => mainWindow?.webContents.setZoomLevel(0) },
        { label: "Fullscreen", accelerator: "F11", click: () => mainWindow?.setFullScreen(!mainWindow.isFullScreen()) },
      ],
    },
    {
      label: "Help",
      submenu: [
        { label: "About", click: () => {
          const { dialog } = require("electron");
          dialog.showMessageBox(mainWindow, {
            type: "info",
            title: "NSE/BSE AI Trading Terminal",
            message: "NSE/BSE AI Trading Terminal",
            detail: `Version 1.0.0\n\nAI-powered trading signals and technical analysis for Indian stock exchanges.\n\nData: Yahoo Finance (15-20 min delay)\nAI: OpenAI GPT-5.4\n\n⚠ Signals are for informational purposes only. Not financial advice.`,
            buttons: ["OK"],
          });
        }},
      ],
    },
  ];
  return Menu.buildFromTemplate(template);
}

// ── Splash screen while server starts ────────────────────────────────────────
function createSplash() {
  const splash = new BrowserWindow({
    width: 480,
    height: 300,
    frame: false,
    alwaysOnTop: true,
    backgroundColor: "#0a0a0a",
    webPreferences: { nodeIntegration: false },
  });

  splash.loadURL(`data:text/html,
    <html>
    <body style="margin:0;background:#0a0a0a;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:monospace;color:#fff;">
      <div style="font-size:28px;font-weight:bold;letter-spacing:4px;color:#22c55e;">TERMINAL</div>
      <div style="font-size:12px;color:#666;margin-top:8px;letter-spacing:2px;">NSE/BSE AI TRADING SIGNALS</div>
      <div style="margin-top:40px;width:200px;height:2px;background:#111;border-radius:2px;overflow:hidden;">
        <div id="bar" style="height:100%;background:#22c55e;width:0%;transition:width 0.3s;"></div>
      </div>
      <div id="status" style="margin-top:16px;font-size:11px;color:#555;letter-spacing:1px;">STARTING SERVER...</div>
      <script>
        let w = 0;
        setInterval(() => { w = Math.min(w + 2, 90); document.getElementById('bar').style.width = w + '%'; }, 200);
      </script>
    </body>
    </html>
  `);

  return splash;
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  const splash = createSplash();

  try {
    await startServer();
    splash.close();
    createWindow();
  } catch (err) {
    splash.close();
    const { dialog } = require("electron");
    await dialog.showMessageBox({
      type: "error",
      title: "Startup Error",
      message: "Failed to start the Trading Terminal server",
      detail: err.message + "\n\nMake sure you ran 'npm run build-server' before launching.",
      buttons: ["Quit"],
    });
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    serverProcess = null;
  }
});

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
