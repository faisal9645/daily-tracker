const { app, BrowserWindow, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { URL } = require('url');

const APP_ID = 'com.planflow.dailytracker';
const DIST_DIR = path.join(__dirname, '../dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

let staticServer = null;

function getIconPath() {
  const candidates = [
    path.join(process.resourcesPath, 'icon.ico'),
    path.join(app.getAppPath(), 'build', 'icon.ico'),
    path.join(__dirname, '../build/icon.ico'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function getAppIcon() {
  const iconPath = getIconPath();
  if (!iconPath) return undefined;

  const image = nativeImage.createFromPath(iconPath);
  return image.isEmpty() ? undefined : image;
}

function startStaticServer(rootDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const requestUrl = new URL(req.url || '/', 'http://localhost');
        let pathname = decodeURIComponent(requestUrl.pathname);
        if (pathname === '/') pathname = '/index.html';

        const filePath = path.normalize(path.join(rootDir, pathname));
        if (!filePath.startsWith(path.normalize(rootDir))) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }

        fs.readFile(filePath, (error, data) => {
          if (error) {
            res.writeHead(404);
            res.end('Not found');
            return;
          }

          const ext = path.extname(filePath).toLowerCase();
          res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
          res.end(data);
        });
      } catch {
        res.writeHead(500);
        res.end('Server error');
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to start local static server.'));
        return;
      }

      staticServer = server;
      resolve(`http://localhost:${address.port}`);
    });

    server.on('error', reject);
  });
}

function createWindow(appUrl) {
  const appIcon = getAppIcon();

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 360,
    minHeight: 640,
    title: 'Planflow',
    icon: appIcon,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.webContents.setWindowOpenHandler(() => ({
    action: 'allow',
    overrideBrowserWindowOptions: {
      width: 520,
      height: 720,
      autoHideMenuBar: true,
      icon: appIcon,
    },
  }));

  win.loadURL(appUrl);
}

async function bootstrap() {
  if (process.platform === 'win32') {
    app.setAppUserModelId(APP_ID);
  }

  const appUrl = await startStaticServer(DIST_DIR);
  createWindow(appUrl);
}

app.whenReady().then(() => {
  bootstrap().catch((error) => {
    console.error('Failed to start Planflow:', error);
    app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      bootstrap().catch((error) => {
        console.error('Failed to restart Planflow:', error);
        app.quit();
      });
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (staticServer) {
    staticServer.close();
    staticServer = null;
  }
});
