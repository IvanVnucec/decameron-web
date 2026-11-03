import { Picoboot, Target } from './vendor/picoflash/index.js';
import { uf2ToFlashBuffer } from './vendor/picoflash/uf2.js';

const connectButton = document.getElementById('updater-connect');
const flashButton = document.getElementById('updater-flash');
const statusElement = document.getElementById('updater-status');
const progressBar = document.getElementById('updater-progress');

let picoboot = null;
let connection = null;
let busy = false;

function setStatus(message, tone = 'secondary') {
    statusElement.textContent = message;
    statusElement.classList.remove('text-secondary', 'text-success', 'text-danger');
    statusElement.classList.add(`text-${tone}`);
}

function setProgress(percent) {
    progressBar.style.width = `${percent}%`;
    progressBar.parentElement.setAttribute('aria-valuenow', String(percent));
}

async function cleanup() {
    try {
        if (picoboot) {
            await picoboot.disconnect();
        }
    } catch (error) {
        console.warn('Could not disconnect updater device:', error);
    }

    picoboot = null;
    connection = null;
}

async function checkKnownDevices() {
    if (busy || connection) {
        return;
    }

    try {
        const devices = await Picoboot.getDevices([new Target('RP2040')]);

        if (devices.length > 0) {
            setStatus('device found. connecting...', 'success');
            connectButton.classList.remove('btn-primary');
            connectButton.classList.add('btn-success');
            await connectDevice(devices[0]);
        } else {
            setStatus('put the device in update mode, then click connect device.', 'secondary');
            connectButton.classList.remove('btn-success');
            connectButton.classList.add('btn-primary');
        }
    } catch (error) {
        console.warn('Could not check for known devices:', error);
    }
}

async function connectDevice(device = null) {
    if (busy) {
        return;
    }

    busy = true;
    connectButton.disabled = true;
    flashButton.disabled = true;
    connectButton.classList.remove('btn-success');
    connectButton.classList.add('btn-primary');
    setProgress(0);

    try {
        if (device) {
            setStatus('device found. connecting...');
        } else {
            setStatus('browser window opened. select the RP2040 device.');
            device = await Picoboot.requestDevice([new Target('RP2040')]);
        }

        setStatus('connecting...');
        picoboot = device;
        connection = await picoboot.connect();

        await connection.resetInterface();
        await connection.setExclusiveAccess(2);
        await connection.exitXip();

        setStatus(`connected: ${picoboot.getTarget().toString()}`, 'success');
        flashButton.disabled = false;
    } catch (error) {
        await cleanup();

        if (error.message.includes('claim interface') || error.message.includes('Unable to claim interface')) {
            setStatus('could not connect: the device is already in use by another tab or application. close picoflash or any other updater, then try again.', 'danger');
        } else if (error.message.includes('Access denied')) {
            setStatus('could not open the device: USB access denied. close other apps or tabs using it, then try again.', 'danger');
        } else {
            setStatus(`could not connect: ${error.message}`, 'danger');
        }
    } finally {
        busy = false;
        connectButton.disabled = false;
    }
}

async function flashDevice() {
    if (busy || !connection) {
        return;
    }

    busy = true;
    connectButton.disabled = true;
    flashButton.disabled = true;

    try {
        setStatus('downloading firmware...');
        const response = await fetch('downloads/catchcam.uf2', { cache: 'no-store' });

        if (!response.ok) {
            throw new Error(`download failed (${response.status})`);
        }

        const uf2 = new Uint8Array(await response.arrayBuffer());
        const { address, data } = uf2ToFlashBuffer(uf2);
        const target = connection.getTarget();
        const sectorSize = target.flashSectorSize();
        const eraseSize = Math.ceil(data.length / sectorSize) * sectorSize;

        setStatus('erasing flash...');
        setProgress(0);

        const eraseChunkSize = 64 * 1024;

        for (let offset = 0; offset < eraseSize; offset += eraseChunkSize) {
            const chunkSize = Math.min(eraseChunkSize, eraseSize - offset);
            await connection.flashErase(address + offset, chunkSize);
            setProgress(Math.round(((offset + chunkSize) / eraseSize) * 10));
        }

        setStatus('flashing...');
        const chunkSize = 64 * 1024;

        for (let offset = 0; offset < data.length; offset += chunkSize) {
            const chunk = data.subarray(offset, offset + chunkSize);
            await connection.flashWrite(address + offset, chunk);
            const percent = 10 + Math.round(((offset + chunk.length) / data.length) * 90);
            setProgress(percent);
        }

        setProgress(100);
        setStatus('update complete. restarting the device...', 'success');

        try {
            await connection.reboot(100);
        } catch (error) {
            console.warn('Reboot command failed after flashing:', error);
        }

        await cleanup();
        setStatus('update complete. the device has restarted.', 'success');
    } catch (error) {
        await cleanup();
        setStatus(`update failed: ${error.message}`, 'danger');
    } finally {
        busy = false;
        connectButton.disabled = false;
        flashButton.disabled = true;
    }
}

if (!connectButton || !flashButton || !statusElement || !progressBar) {
    console.warn('Updater elements not found.');
} else if (!('usb' in navigator) || !window.isSecureContext) {
    connectButton.disabled = true;
    flashButton.disabled = true;
    setStatus('browser update needs Chrome or Edge on a secure connection. use the manual steps below.', 'danger');
} else {
    connectButton.addEventListener('click', () => connectDevice());
    flashButton.addEventListener('click', flashDevice);

    navigator.usb.addEventListener('connect', checkKnownDevices);
    navigator.usb.addEventListener('disconnect', checkKnownDevices);

    setStatus('put the device in update mode with the paperclip, then click connect device.');
    checkKnownDevices();
}
