import { Picoboot, Target } from './vendor/picoflash/index.js';
import { uf2ToFlashBuffer } from './vendor/picoflash/uf2.js';

const connectButton = document.getElementById('updater-connect');
const flashButton = document.getElementById('updater-flash');
const statusElement = document.getElementById('updater-status');
const progressBar = document.getElementById('updater-progress');

let picoboot = null;
let connection = null;
let busy = false;
// an update just finished or failed. the device then restarts or gets unplugged, and that USB
// disconnect must not replace "update complete" (or the error) with the hold-the-button prompt
let keepResult = false;

const IDLE_MESSAGE = 'hold the update button while you connect decameron, then click connect device.';

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
        } else if (!keepResult) {
            setStatus(IDLE_MESSAGE, 'secondary');
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
    keepResult = false;
    connectButton.disabled = true;
    flashButton.disabled = true;
    connectButton.classList.remove('btn-success');
    connectButton.classList.add('btn-primary');
    setProgress(0);

    try {
        if (device) {
            setStatus('device found. connecting...');
        } else {
            setStatus('choose “RP2 Boot” in the browser window.');
            device = await Picoboot.requestDevice([new Target('RP2040')]);
        }

        setStatus('connecting...');
        picoboot = device;
        connection = await picoboot.connect();

        await connection.resetInterface();
        await connection.setExclusiveAccess(2);
        await connection.exitXip();

        setStatus('connected. click update device.', 'success');
        flashButton.disabled = false;
    } catch (error) {
        await cleanup();

        if (error.message.includes('claim interface') || error.message.includes('Unable to claim interface')) {
            setStatus('could not connect: another tab or program is using the device. close it, unplug decameron and try again.', 'danger');
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
        setStatus('downloading the latest camera list...');
        const response = await fetch(flashButton.dataset.firmware, { cache: 'no-store' });

        if (!response.ok) {
            throw new Error(`download failed (${response.status})`);
        }

        const uf2 = new Uint8Array(await response.arrayBuffer());
        const { address, data } = uf2ToFlashBuffer(uf2);
        const target = connection.getTarget();
        const sectorSize = target.flashSectorSize();
        const eraseSize = Math.ceil(data.length / sectorSize) * sectorSize;

        setStatus('preparing the device...');
        setProgress(0);

        const eraseChunkSize = 64 * 1024;

        for (let offset = 0; offset < eraseSize; offset += eraseChunkSize) {
            const chunkSize = Math.min(eraseChunkSize, eraseSize - offset);
            await connection.flashErase(address + offset, chunkSize);
            setProgress(Math.round(((offset + chunkSize) / eraseSize) * 10));
        }

        setStatus('writing the update. keep the cable connected...');
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
        setStatus('update complete. decameron has restarted: unplug it and take it back to the car.', 'success');
        keepResult = true;
    } catch (error) {
        await cleanup();
        setStatus(`update failed: ${error.message}. put decameron back in update mode and try again; nothing is broken.`, 'danger');
        keepResult = true;
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
    setStatus('this browser can’t update over USB. use Chrome or Edge on a computer, or the manual update.', 'danger');
    // this browser can only do the manual update: the browser fold starts closed and greyed out
    // (Bootstrap's opacity-50; its contents also pe-none, so nothing in it can be clicked), apart from the
    // red status line saying why, and the manual fold opens. done straight away, without animation,
    // since this happens while the page loads
    // the page has usually painted by now: switch off the arrow turn while the folds change, so they don't spin on load
    const toggles = document.querySelectorAll('[data-bs-target="#browser-update-steps"], [data-bs-target="#manual-update-steps"]');
    toggles.forEach((toggle) => toggle.classList.add('no-transition'));
    requestAnimationFrame(() => requestAnimationFrame(() => toggles.forEach((toggle) => toggle.classList.remove('no-transition'))));
    const browserSteps = document.getElementById('browser-update-steps');
    browserSteps?.classList.remove('show');
    browserSteps?.querySelectorAll('.accordion-body > :not(#updater-status)').forEach((el) => {
        el.classList.add('opacity-50', 'pe-none', 'user-select-none');
    });
    document.querySelectorAll('[data-bs-target="#browser-update-steps"]').forEach((toggle) => {
        toggle.classList.add('collapsed');
        toggle.setAttribute('aria-expanded', 'false');
        // grey the title, but keep the red reason next to it readable while the fold is closed
        toggle.querySelector('[data-fold-title]')?.classList.add('opacity-50');
    });
    document.getElementById('updater-unsupported')?.classList.remove('d-none');
    const manual = document.getElementById('manual-update-steps');
    manual?.classList.add('show');
    document.querySelectorAll('[data-bs-target="#manual-update-steps"]').forEach((toggle) => {
        toggle.classList.remove('collapsed');
        toggle.setAttribute('aria-expanded', 'true');
    });
} else {
    connectButton.addEventListener('click', () => connectDevice());
    flashButton.addEventListener('click', flashDevice);

    navigator.usb.addEventListener('connect', checkKnownDevices);
    navigator.usb.addEventListener('disconnect', async (event) => {
        // unplugged after connecting but before updating: let go of it, so the page stops saying "connected"
        if (!busy && picoboot && event.device === picoboot.device) {
            await cleanup();
            flashButton.disabled = true;
        }
        checkKnownDevices();
    });

    setStatus(IDLE_MESSAGE);
    checkKnownDevices();
}
