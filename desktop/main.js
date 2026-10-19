const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {

    const win = new BrowserWindow({

        width: 1600,
        height: 900,

        minWidth: 1200,
        minHeight: 700,

        autoHideMenuBar: true,

        icon: path.join(__dirname, 'icon.ico'),

        webPreferences: {

            preload: path.join(__dirname, 'preload.js'),

            contextIsolation: true,

            nodeIntegration: false

        }

    });

    // Cloud version
    //win.loadURL('https://erp.prodnex.com.br');

    // Local development
     win.loadURL('http://localhost:8080');

}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {

    if (process.platform !== 'darwin')
        app.quit();

});