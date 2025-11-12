/**
 * BoldVPN Setup Wizard
 * Guides new users through initial configuration
 */

class SetupWizard {
    constructor(portal) {
        this.portal = portal;
        this.currentStep = 1;
        this.totalSteps = 4;
        this.selectedServer = null;
    }

    async start() {
        // Check if user has already completed setup
        try {
            const response = await fetch(`${this.portal.apiBase}/devices`, {
                headers: { 'Authorization': `Bearer ${this.portal.token}` }
            });

            if (response.ok) {
                const devices = await response.json();
                if (devices.length > 0) {
                    // User already has devices, skip wizard
                    return false;
                }
            }
        } catch (error) {
            console.error('Error checking setup status:', error);
        }

        // Show wizard
        this.showWizard();
        return true;
    }

    showWizard() {
        // Create wizard overlay
        const wizardHTML = `
            <div id="setup-wizard-overlay" class="wizard-overlay">
                <div class="wizard-container">
                    <div class="wizard-header">
                        <h2>Welcome to BoldVPN! 🚀</h2>
                        <p>Let's get your VPN set up in a few easy steps</p>
                        <div class="wizard-progress">
                            <div class="wizard-progress-bar" style="width: ${(this.currentStep / this.totalSteps) * 100}%"></div>
                        </div>
                        <p class="wizard-step-counter">Step ${this.currentStep} of ${this.totalSteps}</p>
                    </div>

                    <div class="wizard-content">
                        <div id="wizard-step-1" class="wizard-step active">
                            <h3>📱 What device are you setting up?</h3>
                            <p>Choose the device you want to connect to BoldVPN</p>
                            <div class="device-options">
                                <button class="device-option" data-device="My iPhone">
                                    📱 iPhone
                                </button>
                                <button class="device-option" data-device="My Android">
                                    📱 Android
                                </button>
                                <button class="device-option" data-device="My Laptop">
                                    💻 Laptop
                                </button>
                                <button class="device-option" data-device="My Desktop">
                                    🖥️ Desktop
                                </button>
                                <button class="device-option" data-device="My Tablet">
                                    📲 Tablet
                                </button>
                                <button class="device-option" id="custom-device">
                                    ✏️ Custom Name
                                </button>
                            </div>
                        </div>

                        <div id="wizard-step-2" class="wizard-step">
                            <h3>🌍 Choose Your Server</h3>
                            <p>Select the VPN server location you want to connect to</p>
                            <div id="wizard-servers-container">
                                <!-- Servers loaded here -->
                            </div>
                        </div>

                        <div id="wizard-step-3" class="wizard-step">
                            <h3>⚙️ Creating Your Configuration</h3>
                            <div class="wizard-loading">
                                <div class="spinner"></div>
                                <p>Generating WireGuard keys...</p>
                                <p>Configuring firewall...</p>
                                <p>Creating VPN profile...</p>
                            </div>
                        </div>

                        <div id="wizard-step-4" class="wizard-step">
                            <h3>✅ All Set!</h3>
                            <p>Your VPN is ready to use. Follow these steps:</p>
                            <div class="wizard-instructions">
                                <div class="instruction-step">
                                    <div class="instruction-number">1</div>
                                    <div class="instruction-content">
                                        <h4>Download WireGuard App</h4>
                                        <div class="download-links">
                                            <a href="https://apps.apple.com/app/wireguard/id1441195209" target="_blank" class="download-btn">
                                                📱 iOS App Store
                                            </a>
                                            <a href="https://play.google.com/store/apps/details?id=com.wireguard.android" target="_blank" class="download-btn">
                                                📱 Google Play
                                            </a>
                                            <a href="https://www.wireguard.com/install/" target="_blank" class="download-btn">
                                                💻 Desktop Apps
                                            </a>
                                        </div>
                                    </div>
                                </div>
                                <div class="instruction-step">
                                    <div class="instruction-number">2</div>
                                    <div class="instruction-content">
                                        <h4>Download Your Configuration</h4>
                                        <button id="wizard-download-config" class="btn btn-primary btn-large">
                                            📥 Download VPN Config
                                        </button>
                                    </div>
                                </div>
                                <div class="instruction-step">
                                    <div class="instruction-number">3</div>
                                    <div class="instruction-content">
                                        <h4>Import Configuration</h4>
                                        <p>Open WireGuard app → Add Tunnel → Import from file → Select downloaded config</p>
                                    </div>
                                </div>
                                <div class="instruction-step">
                                    <div class="instruction-number">4</div>
                                    <div class="instruction-content">
                                        <h4>Connect!</h4>
                                        <p>Toggle the connection switch in WireGuard app. You're now protected! 🎉</p>
                                    </div>
                                </div>
                            </div>
                            <button id="wizard-finish" class="btn btn-success btn-large">
                                Go to Dashboard
                            </button>
                        </div>
                    </div>

                    <div class="wizard-footer">
                        <button id="wizard-back" class="btn btn-secondary" style="display: none;">← Back</button>
                        <button id="wizard-skip" class="btn btn-text">Skip Setup</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', wizardHTML);
        this.bindWizardEvents();
    }

    bindWizardEvents() {
        // Device selection
        document.querySelectorAll('.device-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const deviceName = e.target.dataset.device;
                if (deviceName) {
                    this.selectDevice(deviceName);
                } else {
                    // Custom device name
                    const custom = prompt('Enter custom device name:');
                    if (custom) this.selectDevice(custom);
                }
            });
        });

        // Skip button
        document.getElementById('wizard-skip').addEventListener('click', () => {
            this.close();
        });

        // Finish button
        const finishBtn = document.getElementById('wizard-finish');
        if (finishBtn) {
            finishBtn.addEventListener('click', () => {
                this.close();
                this.portal.loadDashboardData();
            });
        }
    }

    async selectDevice(deviceName) {
        this.deviceName = deviceName;
        this.nextStep();

        // Load servers for step 2
        await this.loadServersForWizard();
    }

    async loadServersForWizard() {
        try {
            const response = await fetch(`${this.portal.apiBase}/servers`);
            if (response.ok) {
                const servers = await response.json();
                this.renderServersForWizard(servers.filter(s => !s.isPremium)); // Free users only see non-premium
            }
        } catch (error) {
            console.error('Failed to load servers:', error);
        }
    }

    renderServersForWizard(servers) {
        const container = document.getElementById('wizard-servers-container');
        if (!container) return;

        container.innerHTML = servers.map(server => `
            <div class="wizard-server-option" data-server-id="${server.id}">
                <div class="server-flag">${server.flag}</div>
                <div class="server-details">
                    <h4>${server.country}, ${server.city}</h4>
                    <p>Load: ${server.load.toFixed(1)}% | Latency: ${server.latency}ms</p>
                </div>
                <div class="server-status status-${server.status}">
                    ${server.status}
                </div>
            </div>
        `).join('');

        // Bind click events
        document.querySelectorAll('.wizard-server-option').forEach(option => {
            option.addEventListener('click', () => {
                const serverId = parseInt(option.dataset.serverId);
                this.selectServer(serverId);
            });
        });
    }

    async selectServer(serverId) {
        this.selectedServer = serverId;
        this.nextStep();

        // Start creating device
        await this.createDevice();
    }

    async createDevice() {
        try {
            const response = await fetch(`${this.portal.apiBase}/devices`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.portal.token}`
                },
                body: JSON.stringify({
                    deviceName: this.deviceName,
                    serverId: this.selectedServer
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.deviceId = data.device.id;
                this.nextStep(); // Go to success screen
                this.bindDownloadButton();
            } else {
                alert('Error creating device: ' + (data.error || 'Unknown error'));
                this.close();
            }
        } catch (error) {
            console.error('Create device error:', error);
            alert('Network error. Please try again or skip setup.');
            this.close();
        }
    }

    bindDownloadButton() {
        const downloadBtn = document.getElementById('wizard-download-config');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                this.portal.downloadConfig(this.deviceId);
            });
        }
    }

    nextStep() {
        // Hide current step
        document.querySelector('.wizard-step.active')?.classList.remove('active');

        // Show next step
        this.currentStep++;
        const nextStep = document.getElementById(`wizard-step-${this.currentStep}`);
        if (nextStep) {
            nextStep.classList.add('active');
        }

        // Update progress bar
        const progressBar = document.querySelector('.wizard-progress-bar');
        if (progressBar) {
            progressBar.style.width = `${(this.currentStep / this.totalSteps) * 100}%`;
        }

        // Update step counter
        const stepCounter = document.querySelector('.wizard-step-counter');
        if (stepCounter) {
            stepCounter.textContent = `Step ${this.currentStep} of ${this.totalSteps}`;
        }
    }

    close() {
        const overlay = document.getElementById('setup-wizard-overlay');
        if (overlay) {
            overlay.remove();
        }
    }
}

// Auto-start wizard for new users
if (typeof BoldVPNPortal !== 'undefined') {
    const originalShowDashboard = BoldVPNPortal.prototype.showDashboard;
    BoldVPNPortal.prototype.showDashboard = async function() {
        originalShowDashboard.call(this);
        
        // Start wizard after dashboard loads
        setTimeout(async () => {
            const wizard = new SetupWizard(this);
            await wizard.start();
        }, 500);
    };
}

