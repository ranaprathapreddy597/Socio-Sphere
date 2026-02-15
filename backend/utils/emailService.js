const nodemailer = require('nodemailer');
const axios = require('axios');

// Configure email transporter
let transporter;
const resendApiKey = process.env.RESEND_API_KEY;
const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS;

if (emailUser && emailPass) {
  // Remove quotes if present (dotenv should handle this, but just in case)
  const cleanUser = emailUser.replace(/^["']|["']$/g, '');
  const cleanPass = emailPass.replace(/^["']|["']$/g, '');
  
  transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: cleanUser,
      pass: cleanPass
    }
  });
  
  // Verify connection (silent unless error)
  transporter.verify((error, success) => {
    if (error) {
      console.error('❌ Email service error:', error.message);
    }
    // Only log success if there was a previous error or in verbose mode
  });
} else if (!resendApiKey) {
  console.log('⚠️  Email not configured - OTP codes will be logged to console');
}

function buildWrapper(content) {
  return `
    <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; border-radius: 16px; padding: 28px; background: #ffffff; border: 1px solid #eef2ff;">
      <div style="text-align:center; margin-bottom:24px;">
        <div style="display:inline-block; padding:12px 20px; border-radius:999px; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; font-weight:600;">SocioSphere</div>
      </div>
      ${content}
      <p style="color:#94a3b8; font-size:12px; margin-top:40px; text-align:center;">If you did not request this, safely ignore this email.</p>
    </div>
  `;
}

async function sendViaResend(payload) {
  if (!resendApiKey) return false;
  try {
    await axios.post(
      'https://api.resend.com/emails',
      {
        from: process.env.EMAIL_FROM || 'SocioSphere <noreply@sociosphere.app>',
        to: payload.to,
        subject: payload.subject,
        html: payload.html
      },
      {
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );
    return { messageId: 'resend' };
  } catch (error) {
    console.error('❌ Resend email error:', error.response?.data || error.message);
    return false;
  }
}

async function sendMail(opts) {
  const payload = {
    from: process.env.EMAIL_FROM || (emailUser ? `SocioSphere <${emailUser}>` : 'SocioSphere <noreply@sociosphere.app>'),
    ...opts
  };

  if (resendApiKey) {
    const result = await sendViaResend(payload);
    if (result) return result;
  }

  if (transporter) {
    try {
      return await transporter.sendMail(payload);
    } catch (error) {
      console.error('❌ Email send error:', error.message);
    }
  }

  console.log('📧 EMAIL NOT CONFIGURED - OTP Code:', opts.subject?.includes('code') ? opts.html?.match(/\d{6}/)?.[0] : 'Check email content');
  console.log('📧 To:', opts.to);
  console.log('📧 Subject:', opts.subject);
  if (opts.html?.includes('one-time code')) {
    const codeMatch = opts.html.match(/>(\d{6})</);
    if (codeMatch) {
      console.log('🔑 OTP CODE:', codeMatch[1]);
    }
  }
  return Promise.resolve({ messageId: 'console-log' });
}

function getEmailStatus() {
  return {
    provider: resendApiKey ? 'resend' : (process.env.EMAIL_SERVICE || 'smtp'),
    configured: Boolean(resendApiKey || transporter),
    smtpConfigured: Boolean(transporter),
    resendConfigured: Boolean(resendApiKey),
    from: process.env.EMAIL_FROM || emailUser || null
  };
}

// Send welcome email
async function sendWelcomeEmail(userEmail, userName) {
  try {
    await sendMail({
      to: userEmail,
      subject: 'Welcome to SocioSphere! 🎉',
      html: buildWrapper(`
        <h1 style="color:#0f172a; margin-bottom:12px;">Welcome, ${userName}!</h1>
        <p style="color:#475569; line-height:1.6;">You just joined a community of explorers, creators, and travelers. Start by completing your profile, sharing a story, or planning a trip.</p>
      `)
    });
  } catch (error) {
    console.error('Email sending failed:', error);
  }
}

async function sendNotificationEmail(userEmail, userName, notificationType, content, cta = '#') {
  const subjects = {
    like: 'Someone loved your post ❤️',
    comment: 'New comment waiting for you 💬',
    follow: 'You just gained a new follower ✨',
    message: 'New conversation started',
    trip: 'Trip update on SocioSphere'
  };

  try {
    await sendMail({
      to: userEmail,
      subject: subjects[notificationType] || 'New notification',
      html: buildWrapper(`
        <h2 style="color:#0f172a;">Hi ${userName},</h2>
        <p style="color:#475569; line-height:1.6;">${content}</p>
        <a href="${cta}" style="display:inline-block; margin-top:24px; background:#6366f1; color:white; padding:12px 32px; border-radius:999px; text-decoration:none;">Open SocioSphere</a>
      `)
    });
  } catch (error) {
    console.error('Notification email failed:', error);
  }
}

async function sendOtpEmail(userEmail, otpCode, purpose = 'login') {
  const subjects = {
    login: 'Your SocioSphere login code',
    'password-reset': 'Reset your SocioSphere password',
    'email-verify': 'Verify your SocioSphere email'
  };
  const verb = purpose === 'password-reset' ? 'reset your password' : 'sign in';
  
  // Log OTP to console only if email is not configured (for development)
  if (!emailUser || !emailPass) {
    console.log('🔑 OTP CODE:', otpCode, 'for', userEmail);
  }
  
  try {
    const result = await sendMail({
      to: userEmail,
      subject: subjects[purpose] || 'Your SocioSphere code',
      html: buildWrapper(`
        <p style="color:#475569;">Use the one-time code below to ${verb}. It expires in 10 minutes.</p>
        <div style="font-size:32px; letter-spacing:8px; font-weight:700; color:#0f172a; text-align:center; margin:24px 0;">${otpCode}</div>
        <p style="color:#94a3b8; font-size:13px;">For security, never share this code with anyone.</p>
      `)
    });
    return result;
  } catch (error) {
    console.error('❌ OTP email failed:', error.message);
    // Log OTP to console if email fails
    if (!emailUser || !emailPass || error) {
      console.log('🔑 OTP CODE (fallback):', otpCode, 'for', userEmail);
    }
    throw error;
  }
}

async function sendTripInviteEmail(userEmail, payload = {}) {
  try {
    await sendMail({
      to: userEmail,
      subject: `${payload.hostName || 'A traveler'} invited you to ${payload.tripTitle}`,
      html: buildWrapper(`
        <h2>Pack your bags! ✈️</h2>
        <p>${payload.hostName || 'Someone'} is planning <strong>${payload.tripTitle}</strong> to ${payload.destination || 'an epic place'} from ${payload.startDate || 'soon'}.</p>
        <p>${payload.message || ''}</p>
      `)
    });
  } catch (error) {
    console.error('Trip invite email failed:', error);
  }
}

module.exports = {
  sendWelcomeEmail,
  sendNotificationEmail,
  sendOtpEmail,
  sendTripInviteEmail,
  getEmailStatus
};