const { app, BrowserWindow, ipcMain } = require('electron');
const SerialClient = require('./SerialClient.js');
const SerialPort = require('serialport');
var server;
var client;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true
    }
  });

  // and load the index.html of the app.
  mainWindow.loadURL(`file://${__dirname}/index.html`);

  // Open the DevTools.
  //mainWindow.webContents.openDevTools();

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
ipcMain.on('message', (event, arg) => {
  if (arg == 'list'){
    SerialPort.list().then(arg => {
      mainWindow.webContents.send('message', arg);
    });
  } else if (arg.startsWith('connect:')){
    try{
      var port = arg.substr(8);
      client = new SerialClient(server, port);
    } catch(e){
      console.log(e);
    }
  } else if (arg.startsWith('server:')){
    server = arg.substr(7);
    console.log('new server address ' + server);
    if (client){
      //update server address in client
    }
  } else if (arg == 'disconnect') {
    if (client){
    	client.close();
    }
  }
});
