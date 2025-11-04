/**
 * BoldVPN Captive Portal - Clean build matching login.html
 */

let settings = {};
let langText = {};

// Load settings and initialize
$(document).ready(() => {
    $.loadSettings().done(() => {
        initializeVanta();
        updateLogo();
        setupAuth();
        checkConnectionStatus();
        fetchUserIPAndLocation();
    });
});

// Load settings from config
$.loadSettings = () => {
    return $.ajax({
        url: 'config/settings.json',
        dataType: 'json'
    }).done((data) => {
        settings = data;
        loadLanguage();
    });
};

// Load language
const loadLanguage = () => {
    const lang = settings.default_lang || 'en';
    $.ajax({
        url: `langs/${lang}.json`,
        dataType: 'json'
    }).done((data) => {
        langText = data;
        updateUI();
    });
};

// Update UI with language text
const updateUI = () => {
    $('#cp_portal_head_title').text(langText.cp_portal_head_title || 'Portal Login');
    $('#cp_portal_info').text(langText.cp_portal_info || 'Enter your credentials to access the BoldVPN network.');
    $('#username').text(langText.username || 'Username');
    $('#userpass').text(langText.userpass || 'Password');
    $('#signin').text(langText.signin || 'Log in');
    $('#signin_anon').text(langText.signin_anon || 'Sign in');
    $('#logoff').text(langText.logoff || 'Log out');
    $('#status').text(langText.status || 'Device connected');
    $('#anon_title').text(langText.anon_title || 'Sign in');
    $('#termcondition1').text(langText.termcondition1 || 'I accept ');
    $('#termcondition2').text(langText.termcondition2 || ' of the provision of internet access services.');
    $('#termcondition_anon1').text(langText.termcondition_anon1 || 'I accept ');
    $('#termcondition_anon2').text(langText.termcondition_anon2 || ' of the provision of internet access services.');
    $('#rules').text(langText.rules || 'terms');
    $('#rules_anon').text(langText.rules_anon || 'terms');
    $('#status_pretext1').text(langText.status_pretext1 || '');
    $('#status_pretext2').text(langText.status_pretext2 || '');
    $('#anon_pretext1').text(langText.anon_pretext1 || '');
    $('#cp_portal_cookies_note').text(langText.cp_portal_cookies_note || '');
    $('title').text(langText.pagetitle || 'BoldVPN Portal Login');
};

// Initialize Vanta globe background
const initializeVanta = () => {
    const script1 = document.createElement('script');
    script1.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js';
    document.head.appendChild(script1);
    
    script1.onload = () => {
        const script2 = document.createElement('script');
        script2.src = 'https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.globe.min.js';
        document.head.appendChild(script2);
        
        script2.onload = () => {
            if (window.VANTA) {
                VANTA.GLOBE({
                    el: "#vanta-background",
                    mouseControls: true,
                    touchControls: true,
                    gyroControls: false,
                    minHeight: 200.00,
                    minWidth: 200.00,
                    scale: 1.00,
                    scaleMobile: 1.00,
                    color: 0x38bdf8,
                    color2: 0x0ea5e9,
                    backgroundColor: 0x0b1120,
                    size: 1.2
                });
            }
        };
    };
};

// Update logo with cache-busting
const updateLogo = () => {
    const timestamp = new Date().getTime();
    const logoHtml = `<img class="logo" src="/images/logo.svg?v=${timestamp}" alt="BoldVPN" /> <span>BoldVPN</span>`;
    $('#logo').html(logoHtml);
};

// Fetch IP and location
const fetchUserIPAndLocation = () => {
    fetch('https://ipapi.co/json/')
        .then(response => response.json())
        .then(data => {
            const ipLocation = `IP: ${data.ip || 'N/A'} | ${data.city || ''} ${data.country_name || ''}`;
            const ipInfo = `<p class="tiny center muted" style="margin-top: 16px;">${ipLocation}</p>`;
            $('#cp_portal_cookies_note').after(ipInfo);
        })
        .catch(() => {
            // Silently fail if IP lookup doesn't work
        });
};

// Setup authentication handlers
const setupAuth = () => {
    // Remove readonly after page loads
    setTimeout(() => {
        $('#inputUsername, #inputPassword').removeAttr('readonly');
    }, 100);
    
    // Update button state based on checkbox
    const updateButtonState = () => {
        const rulesChecked = $('#login-rules, #login-rules-anon').is(':checked');
        $('#signin, #signin_anon').prop('disabled', !rulesChecked);
    };
    
    $('#login-rules, #login-rules-anon').on('change', updateButtonState);
    updateButtonState();
    
    // Login button handler
    $('#signin, #signin_anon').on('click', function() {
        const username = $('#inputUsername').val().trim();
        const password = $('#inputPassword').val().trim();
        const rulesChecked = $('#login-rules, #login-rules-anon').is(':checked');
        
        // Clear previous errors
        $('.error-message').remove();
        
        // Validation like login.html
        if (!username) {
            $('#inputUsername').after('<p class="error-message small" style="color: #ef4444; margin: 4px 0 0 0;">Username is required</p>');
            $('#inputUsername').focus();
            return;
        }
        
        if (!password) {
            $('#inputPassword').after('<p class="error-message small" style="color: #ef4444; margin: 4px 0 0 0;">Password is required</p>');
            $('#inputPassword').focus();
            return;
        }
        
        if (!rulesChecked) {
            return;
        }
        
        // Call OPNsense login API
        $(this).prop('disabled', true).text('Logging in...');
        
        $.ajax({
            type: 'POST',
            url: '/api/captiveportal/access/logon/',
            dataType: 'json',
            data: {
                user: username,
                password: password
            }
        }).done((data) => {
            if (data.clientState === 'AUTHORIZED') {
                checkConnectionStatus();
            } else {
                $('.error-message').remove();
                $(this).before('<p class="error-message small center" style="color: #ef4444; margin: 0 0 12px 0;">Invalid username or password</p>');
                $(this).prop('disabled', false).text(langText.signin || 'Log in');
            }
        }).fail(() => {
            $('.error-message').remove();
            $(this).before('<p class="error-message small center" style="color: #ef4444; margin: 0 0 12px 0;">Connection error. Please try again.</p>');
            $(this).prop('disabled', false).text(langText.signin || 'Log in');
        });
    });
    
    // Logout button handler
    $('#logoff').on('click', function() {
        $(this).prop('disabled', true).text('Logging out...');
        $.ajax({
            type: 'POST',
            url: '/api/captiveportal/access/logoff/',
            dataType: 'json'
        }).done(() => {
            location.reload();
        }).fail(() => {
            location.reload();
        });
    });
    
    // Rules link handler - simple alert instead of modal
    $('#rules, #rules_anon').on('click', function(e) {
        e.preventDefault();
        alert('Please read and accept the terms of service for network access.');
    });
};

// Check connection status
const checkConnectionStatus = () => {
    $.ajax({
        type: 'POST',
        url: '/api/captiveportal/access/status/',
        dataType: 'json'
    }).done((data) => {
        if (data.clientState === 'AUTHORIZED') {
            $('#login_normal, #login_none').addClass('d-none');
            $('#logout_undefined').removeClass('d-none');
        } else if (data.authType === 'none') {
            $('#login_normal').addClass('d-none');
            $('#login_none').removeClass('d-none');
        } else {
            $('#login_normal').removeClass('d-none');
            $('#login_none, #logout_undefined').addClass('d-none');
        }
    }).fail(() => {
        // Show login form even if API fails (for testing)
        $('#login_normal').removeClass('d-none');
    });
};
