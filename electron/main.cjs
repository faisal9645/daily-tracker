const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

function getIconPath() {
  const packagedIcon = path.join(process.resourcesPath, 'icon.ico');
  if (app.isPackaged && fs.existsSync(packagedIcon)) {
    return packagedIcon;
  }

  const devIcon = path.join(__dirname, '../build/icon.ico');
  return fs.existsSync(devIcon) ? devIcon : undefined;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 360,
    minHeight: 640,
    title: 'Planflow',
    icon: getIconPath(),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.loadFile(path.join(__dirname, '../dist/index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
