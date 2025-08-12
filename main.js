const { app, BrowserWindow, ipcMain, dialog, globalShortcut, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');
const { Low, JSONFile } = require('lowdb');

// Force no system proxy (attempt to bypass VPN smart-split)
app.commandLine.appendSwitch('no-proxy-server');

const userDataBase = path.join(app.getPath('userData'), 'instances');
mkdirp.sync(userDataBase);

// Lowdb config
const dbFile = path.join(app.getPath('userData'), 'config.json');
const adapter = new JSONFile(dbFile);
const db = new Low(adapter);

let mainWindow;
const instances = new Map(); // id -> {win, config}

async function initDB() {
  await db.read();
  db.data = db.data || { entries: [] };
  await db.write();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function createInstanceWindow(entry) {
  // create a unique userData dir per instance
  const id = entry.id || Date.now().toString();
  const instUserData = path.join(userDataBase, id);
  mkdirp.sync(instUserData);

  const win = new BrowserWindow({
    width: entry.width || 360,
    height: entry.height || 800,
    title: entry.name || 'CloudPhone',
    webPreferences: {
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadURL(entry.url);

  win.on('closed', () => {
    instances.delete(id);
  });

  instances.set(id, { win, entry, id });
  return id;
}

function tileWindows() {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const openWins = Array.from(instances.values()).map(x => x.win).filter(w => !!w);
  if (!openWins.length) return;

  const cols = Math.ceil(Math.sqrt(openWins.length));
  const rows = Math.ceil(openWins.length / cols);
  const { width, height } = primary.workAreaSize;
  const cellW = Math.floor(width / cols);
  const cellH = Math.floor(height / rows);

  openWins.forEach((w, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = c * cellW;
    const y = r * cellH;
    w.setBounds({ x, y, width: cellW, height: cellH });
  });
}

app.whenReady().then(async () => {
  await initDB();
  createMainWindow();

  // global shortcuts: F6 hide, F7 show
  globalShortcut.register('F6', () => {
    for (const v of instances.values()) v.win.hide();
  });
  globalShortcut.register('F7', () => {
    for (const v of instances.values()) v.win.show();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers
ipcMain.handle('get-entries', async () => {
  await db.read();
  return db.data.entries || [];
});

ipcMain.handle('save-entries', async (evt, entries) => {
  db.data.entries = entries;
  await db.write();
  return true;
});

ipcMain.handle('open-entry', async (evt, entry) => {
  const id = createInstanceWindow(entry);
  return id;
});

ipcMain.handle('open-all', async () => {
  await db.read();
  const entries = db.data.entries || [];
  entries.forEach(e => createInstanceWindow(e));
  return true;
});

ipcMain.handle('tile-windows', async () => {
  tileWindows();
  return true;
});

ipcMain.handle('set-always-on-top', async (evt, id, flag) => {
  const inst = instances.get(id);
  if (inst && inst.win) inst.win.setAlwaysOnTop(flag);
  return true;
});

ipcMain.handle('close-instance', async (evt, id) => {
  const inst = instances.get(id);
  if (inst && inst.win) inst.win.close();
  return true;
});

ipcMain.handle('show-dialog', async (evt, opts) => {
  return dialog.showMessageBox(mainWindow, opts);
});

// basic cookie export helper (example)
ipcMain.handle('export-cookies', async (evt, id) => {
  const inst = instances.get(id);
  if (!inst || !inst.win) return null;
  try {
    const sess = inst.win.webContents.session;
    const cookies = await sess.cookies.get({});
    const fn = path.join(app.getPath('userData'), `cookies-${id}.json`);
    fs.writeFileSync(fn, JSON.stringify(cookies, null, 2));
    return fn;
  } catch (e) {
    return null;
  }
});

// import cookies (simple example)
ipcMain.handle('import-cookies', async (evt, id, cookieFile) => {
  const inst = instances.get(id);
  if (!inst || !inst.win) return false;
  try {
    const sess = inst.win.webContents.session;
    const raw = fs.readFileSync(cookieFile, 'utf8');
    const cookies = JSON.parse(raw);
    for (const c of cookies) {
      const toSet = {
        url: (c.secure ? 'https://' : 'http://') + c.domain.replace(/^\./, ''),
        name: c.name,
        value: c.value,
        path: c.path,
        expirationDate: c.expirationDate
      };
      await sess.cookies.set(toSet);
    }
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
});
