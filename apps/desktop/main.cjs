const { app, BrowserWindow, shell } = require("electron");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const siteDir = path.resolve(__dirname, "../shared/www");
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".txt": "text/plain; charset=utf-8"
};

let localServer;
let localOrigin;

function startLocalServer() {
  return new Promise((resolve, reject) => {
    localServer = http.createServer((req, res) => {
      try {
        const requestUrl = new URL(req.url || "/", "http://localhost");
        let pathname = decodeURIComponent(requestUrl.pathname);
        if (pathname === "/") pathname = "/index.html";

        const filePath = path.resolve(siteDir, "." + pathname);
        if (filePath !== siteDir && !filePath.startsWith(siteDir + path.sep)) {
          res.writeHead(403);
          res.end("Forbidden");
          return;
        }

        fs.readFile(filePath, (error, data) => {
          if (error) {
            res.writeHead(error.code === "ENOENT" ? 404 : 500);
            res.end(error.code === "ENOENT" ? "Not found" : "Unable to read app file");
            return;
          }
          res.writeHead(200, {
            "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
            "X-Content-Type-Options": "nosniff"
          });
          res.end(data);
        });
      } catch {
        res.writeHead(400);
        res.end("Bad request");
      }
    });

    localServer.once("error", reject);
    localServer.listen(0, "127.0.0.1", () => {
      const address = localServer.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not start the local app server"));
        return;
      }
      localOrigin = `http://localhost:${address.port}`;
      resolve();
    });
  });
}

async function createWindow() {
  const window = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 360,
    minHeight: 560,
    title: "نور قرآن",
    autoHideMenuBar: true,
    backgroundColor: "#f7f5ed",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("mailto:")) {
      shell.openExternal(url).catch(() => {});
    }
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(localOrigin)) {
      event.preventDefault();
      if (url.startsWith("https://") || url.startsWith("mailto:")) {
        shell.openExternal(url).catch(() => {});
      }
    }
  });

  await window.loadURL(`${localOrigin}/index.html`);
}

app.whenReady().then(async () => {
  try {
    await startLocalServer();
    await createWindow();
  } catch (error) {
    console.error("Noor Quran could not start:", error);
    app.quit();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow().catch(console.error);
  });
});

app.on("window-all-closed", () => {
  if (localServer) localServer.close();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (localServer) localServer.close();
});
