import { app, BrowserWindow, ipcMain, protocol, net } from 'electron';
import path from 'path';
import fs from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import { pathToFileURL } from 'url';



// Register custom protocol as privileged BEFORE app.ready()
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true } }
]);

let mainWindow: BrowserWindow | null = null;
const PODCAST_DIR = path.join(app.getPath('userData'), 'podcasts');

// Ensure podcast directory exists
if (!fs.existsSync(PODCAST_DIR)) {
  fs.mkdirSync(PODCAST_DIR, { recursive: true });
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    autoHideMenuBar: true,
    backgroundColor: '#1a1a1a',
    icon: app.isPackaged
      ? path.join(__dirname, '../dist/icon.ico')
      : path.join(__dirname, '../public/icon.ico')
  });



  // Set Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data: http: https:; " +
          "media-src 'self' http: https: blob:; " +
          "connect-src 'self' https://api.podcastindex.org https://api.openai.com https://speech.googleapis.com https://api.assemblyai.com https://*.assemblyai.com; " +
          "font-src 'self' data:;"
        ]
      }
    });
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    if (!app.isPackaged) {
      mainWindow.loadURL('http://localhost:5173');
    } else {
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
  }
};

// IPC Handlers
ipcMain.handle('ping', () => 'pong');

const downloadControllers = new Map<string, AbortController>();

ipcMain.handle('download-file', async (_, url: string, filename: string) => {
  const filePath = path.join(PODCAST_DIR, filename);

  if (fs.existsSync(filePath)) {
    return filePath;
  }

  const controller = new AbortController();
  downloadControllers.set(filename, controller);

  try {
    const response = await net.fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Failed to download: ${response.statusText}`);
    if (!response.body) throw new Error('No response body');

    const fileStream = fs.createWriteStream(filePath);

    // Convert Web ReadableStream to Node Readable
    const nodeStream = Readable.fromWeb(response.body as import('stream/web').ReadableStream);

    // Listen for abort on the controller to destroy the stream
    const abortHandler = () => {
      if (nodeStream && !nodeStream.destroyed) nodeStream.destroy();
      if (fileStream && !fileStream.destroyed) fileStream.destroy();
    };
    controller.signal.addEventListener('abort', abortHandler);

    await pipeline(nodeStream, fileStream, { signal: controller.signal });

    controller.signal.removeEventListener('abort', abortHandler);
    return filePath;
  } catch (error: any) {
    // If aborted, delete the partial file
    if (error.name === 'AbortError' || error.code === 'ABORT_ERR') {
      console.log(`Download cancelled: ${filename}`);
      try {
        await fs.promises.unlink(filePath);
      } catch (e) {
        // Ignore unlink error
      }
      throw new Error('Download cancelled');
    }
    throw error;
  } finally {
    downloadControllers.delete(filename);
  }
});

ipcMain.handle('cancel-download', async (_, filename: string) => {
  const controller = downloadControllers.get(filename);
  if (controller) {
    controller.abort();
    downloadControllers.delete(filename);

    // Try to delete the file immediately if it exists (double check)
    const filePath = path.join(PODCAST_DIR, filename);
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (e) {
      console.error('Error deleting cancelled file:', e);
    }
  }
});

ipcMain.handle('delete-file', async (_, filename: string) => {
  const filePath = path.join(PODCAST_DIR, filename);
  if (fs.existsSync(filePath)) {
    await fs.promises.unlink(filePath);
  }
});

ipcMain.handle('check-file-exists', async (_, filename: string) => {
  const filePath = path.join(PODCAST_DIR, filename);
  return fs.existsSync(filePath);
});

ipcMain.handle('read-file', async (_, filename: string) => {
  const filePath = path.join(PODCAST_DIR, filename);
  return fs.promises.readFile(filePath);
});

ipcMain.handle('get-file-path', async (_, filename: string) => {
  return path.join(PODCAST_DIR, filename);
});

ipcMain.handle('read-file-base64', async (_, filename: string) => {
  const filePath = path.join(PODCAST_DIR, filename);
  const fileBuffer = await fs.promises.readFile(filePath);
  return fileBuffer.toString('base64');
});

// Audio compression using ffmpeg
ipcMain.handle('compress-audio', async (_, inputFilename: string, bitrateKbps: number = 64): Promise<string> => {
  const inputPath = path.join(PODCAST_DIR, inputFilename);
  const outputFilename = inputFilename.replace('.mp3', '-compressed.mp3');
  const outputPath = path.join(PODCAST_DIR, outputFilename);

  console.log(`[ffmpeg] Compressing ${inputFilename} to ${bitrateKbps}kbps`);

  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error('ffmpeg not found'));
      return;
    }

    let finalFfmpegPath = ffmpegPath;
    if (app.isPackaged) {
      finalFfmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked');
    }

    const ffmpeg = spawn(finalFfmpegPath, [
      '-i', inputPath,
      '-b:a', `${bitrateKbps}k`,
      '-ac', '1', // mono
      '-y', // overwrite
      outputPath
    ]);

    ffmpeg.stderr.on('data', (data) => {
      console.log(`[ffmpeg] ${data}`);
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`[ffmpeg] Compression complete: ${outputFilename}`);
        resolve(outputFilename);
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on('error', (err) => {
      console.error(`[ffmpeg] Error:`, err);
      reject(err);
    });
  });
});

// App restart handler
ipcMain.handle('restart-app', () => {
  app.relaunch();
  app.exit(0);
});

// Storage info handler
ipcMain.handle('get-storage-info', async () => {
  try {
    const files = await fs.promises.readdir(PODCAST_DIR);
    let totalSize = 0;
    let fileCount = 0;

    for (const file of files) {
      if (file.endsWith('.mp3')) {
        const stats = await fs.promises.stat(path.join(PODCAST_DIR, file));
        totalSize += stats.size;
        fileCount++;
      }
    }

    return {
      totalSizeBytes: totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      fileCount,
      storagePath: PODCAST_DIR
    };
  } catch (error) {
    console.error('Error getting storage info:', error);
    return {
      totalSizeBytes: 0,
      totalSizeMB: '0.00',
      fileCount: 0,
      storagePath: PODCAST_DIR
    };
  }
});

app.whenReady().then(() => {
  protocol.handle('local-media', async (request) => {
    try {
      // Remove protocol and strip any trailing slashes (browser adds them)
      let url = request.url.replace('local-media://', '').replace(/\/+$/, '');
      const decodedUrl = decodeURIComponent(url);
      const filePath = path.join(PODCAST_DIR, decodedUrl);

      console.log(`[Main] local-media request: ${request.url} -> ${filePath}`);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error(`[Main] File not found: ${filePath}`);
        return new Response('File not found', { status: 404 });
      }

      const stats = fs.statSync(filePath);
      const fileSize = stats.size;
      const range = request.headers.get('Range');

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;

        console.log(`[Main] Serving range: ${start}-${end}/${fileSize}`);

        const fileStream = fs.createReadStream(filePath, { start, end });
        // Convert Node Readable to Web ReadableStream
        const webStream = Readable.toWeb(fileStream) as unknown as ReadableStream;

        return new Response(webStream, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize.toString(),
            'Content-Type': 'audio/mpeg'
          }
        });
      } else {
        console.log(`[Main] Serving full file: ${fileSize} bytes`);
        const fileStream = fs.createReadStream(filePath);
        // Convert Node Readable to Web ReadableStream
        const webStream = Readable.toWeb(fileStream) as unknown as ReadableStream;

        return new Response(webStream, {
          status: 200,
          headers: {
            'Content-Length': fileSize.toString(),
            'Accept-Ranges': 'bytes',
            'Content-Type': 'audio/mpeg'
          }
        });
      }

    } catch (error) {
      console.error(`[Main] Error handling local-media request:`, error);
      return new Response('Internal error', { status: 500 });
    }
  });

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
