const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('CONSART', {

    version: '1.0.0',

    platform: process.platform

});