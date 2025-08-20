# Email Setup for Password Reset

## Option 1: Gmail SMTP (Recommended for Development)

### Step 1: Enable 2-Factor Authentication
1. Go to your Google Account settings
2. Enable 2-Factor Authentication if not already enabled

### Step 2: Generate App Password
1. Go to Google Account → Security → 2-Step Verification
2. Click "App passwords" at the bottom
3. Select "Mail" and "Other (Custom name)"
4. Name it "Inventory Tracker"
5. Copy the generated 16-character password

### Step 3: Set Environment Variables
Add these to your `.env` file or set them in your hosting environment:

```bash
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-16-char-app-password
EMAIL_SENDER_NAME=Inventory Tracker
```

## Option 2: SendGrid (Alternative)

### Step 1: Create SendGrid Account
1. Go to [sendgrid.com](https://sendgrid.com)
2. Sign up for free account (100 emails/day)
3. Verify your sender email

### Step 2: Get API Key
1. Go to Settings → API Keys
2. Create new API Key with "Mail Send" permissions
3. Copy the API key

### Step 3: Update Server Code
Replace the nodemailer configuration in `server.js`:

```javascript
const transporter = nodemailer.createTransporter({
  host: 'smtp.sendgrid.net',
  port: 587,
  secure: false,
  auth: {
    user: 'apikey',
    pass: process.env.SENDGRID_API_KEY
  }
})
```

### Step 4: Set Environment Variables
```bash
SENDGRID_API_KEY=your-sendgrid-api-key
EMAIL_SENDER_NAME=Inventory Tracker
```

## What the Email Will Look Like

**From:** `your-email@gmail.com` (or `noreply@inventorytracker.com`)
**Subject:** `Password Reset Request - Inventory Tracker`

The email will contain:
- Professional HTML formatting
- Your name
- A blue "Reset Password" button
- Link that expires in 1 hour
- Clear instructions

## Testing

1. Install dependencies: `npm install`
2. Set environment variables
3. Restart your server
4. Try the forgot password feature
5. Check your email (and spam folder)

## Troubleshooting

- **"Invalid credentials"**: Check your Gmail app password
- **"Email not sent"**: Check server logs for email errors
- **Email in spam**: Check spam folder, mark as "not spam"
- **Server restart needed**: After changing environment variables
