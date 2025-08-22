const express = require('express')
const multer = require('multer')
const OpenAI = require('openai')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { Pool } = require('pg')
const nodemailer = require('nodemailer')

const app = express()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))
app.use(express.static(__dirname))

// Error handling middleware for payload size
app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ message: 'Request payload too large. Please try with a smaller image.' })
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request payload too large. Please try with a smaller image.' })
  }
  next(error)
})

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'
const RESET_TOKENS = new Map()

let transporter

if (process.env.SENDGRID_API_KEY) {
  transporter = nodemailer.createTransport({
    host: 'smtp.sendgrid.net',
    port: 587,
    secure: false,
    auth: {
      user: 'apikey',
      pass: process.env.SENDGRID_API_KEY
    }
  })
  console.log('Using SendGrid for email')
} else if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  })
  console.log('Using Gmail SMTP for email')
} else {
  console.log('No email configuration found - password reset emails will not work')
}

async function createTablesIfNotExist() {
  try {
    console.log('Checking database tables...')
    
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
    
    const createInventoriesTable = `
      CREATE TABLE IF NOT EXISTS inventories (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
    
    const createInventoryItemsTable = `
      CREATE TABLE IF NOT EXISTS inventory_items (
        id SERIAL PRIMARY KEY,
        inventory_id INTEGER REFERENCES inventories(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        item_name VARCHAR(255) NOT NULL,
        vendor VARCHAR(255),
        catalog VARCHAR(255),
        cas VARCHAR(255),
        price DECIMAL(10,2),
        unit_size VARCHAR(255),
        amount DECIMAL(10,2),
        amount_unit VARCHAR(50),
        min_stock DECIMAL(10,2),
        max_stock DECIMAL(10,2),
        url TEXT,
        location VARCHAR(255),
        image_data TEXT,
        model_cid VARCHAR(255),
        lot_number VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
    
    const createLocationsTable = `
      CREATE TABLE IF NOT EXISTS locations (
        id SERIAL PRIMARY KEY,
        inventory_id INTEGER REFERENCES inventories(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
    
    await pool.query(createUsersTable)
    await pool.query(createInventoriesTable)
    await pool.query(createInventoryItemsTable)
    await pool.query(createLocationsTable)
    
    // Ensure lot_number column exists (for existing tables)
    try {
      await pool.query(`
        ALTER TABLE inventory_items 
        ADD COLUMN IF NOT EXISTS lot_number VARCHAR(255)
      `)
      console.log('Ensured lot_number column exists')
    } catch (error) {
      console.log('lot_number column already exists or error:', error.message)
    }
    
    console.log('Database tables ready!')
  } catch (error) {
    console.error('Error creating tables:', error)
  }
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  
  if (!token) {
    return res.status(401).json({ message: 'Access token required' })
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' })
    req.user = user
    next()
  })
}

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body
    
    const userCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email])
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Email already registered' })
    }
    
    const hashedPassword = await bcrypt.hash(password, 10)
    
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, hashedPassword]
    )
    
    res.status(201).json({ message: 'User created successfully' })
  } catch (error) {
    console.error('Signup error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body
    
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email])
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }
    
    const user = result.rows[0]
    
    const validPassword = await bcrypt.compare(password, user.password_hash)
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }
    
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    )
    
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email }
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body
    
    const result = await pool.query('SELECT id, name FROM users WHERE email = $1', [email])
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Email not found' })
    }
    
    const user = result.rows[0]
    const resetToken = jwt.sign(
      { userId: user.id, email: email },
      JWT_SECRET,
      { expiresIn: '1h' }
    )
    
    RESET_TOKENS.set(resetToken, {
      userId: user.id,
      email: email,
      expiresAt: Date.now() + (60 * 60 * 1000)
    })
    
    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password.html?token=${resetToken}`
    
    if (!transporter) {
      console.error('No email transporter configured')
      RESET_TOKENS.delete(resetToken)
      return res.status(500).json({ 
        message: 'Email service not configured. Please contact support.' 
      })
    }
    
    const senderName = process.env.EMAIL_SENDER_NAME || 'Inventory Tracker'
    const senderEmail = process.env.EMAIL_USER || 'noreply@inventorytracker.com'
    
    const mailOptions = {
      from: `"${senderName}" <${senderEmail}>`,
      to: email,
      subject: 'Password Reset Request - Inventory Tracker',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8fafc; padding: 20px;">
          <div style="background-color: white; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="color: #1e40af; margin: 0; font-size: 28px; font-weight: 700;">🧪 Inventory Tracker</h1>
              <p style="color: #6b7280; margin: 8px 0 0 0; font-size: 16px;">Lab Equipment Management System</p>
            </div>
            
            <h2 style="color: #1e40af; margin: 0 0 24px 0; font-size: 22px; font-weight: 600;">Password Reset Request</h2>
            
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">Hello <strong>${user.name}</strong>,</p>
            
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">You recently requested to reset your password for your Inventory Tracker account. Click the button below to set a new password:</p>
            
            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetUrl}" style="background-color: #1e40af; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(30, 64, 175, 0.2);">Reset Password</a>
            </div>
            
            <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; margin: 24px 0;">
              <p style="color: #6b7280; font-size: 14px; margin: 0; text-align: center;">
                <strong>⚠️ Security Notice:</strong> This link will expire in 1 hour for your security.
              </p>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 0 0 16px 0;">If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
            
            <div style="text-align: center;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">Best regards,</p>
              <p style="color: #1e40af; font-size: 14px; font-weight: 600; margin: 4px 0 0 0;">Inventory Tracker Team</p>
              <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0 0;">Lab Equipment Management System</p>
            </div>
          </div>
        </div>
      `
    }
    
    try {
      await transporter.sendMail(mailOptions)
      console.log(`Password reset email sent to ${email}`)
      res.json({ message: 'Password reset link sent to your email' })
    } catch (emailError) {
      console.error('Email sending failed:', emailError)
      console.error('Email error details:', {
        code: emailError.code,
        command: emailError.command,
        response: emailError.response
      })
      RESET_TOKENS.delete(resetToken)
      
      if (emailError.code === 'EAUTH') {
        res.status(500).json({ message: 'Email authentication failed. Check your email credentials.' })
      } else if (emailError.code === 'ECONNECTION') {
        res.status(500).json({ message: 'Email connection failed. Please try again later.' })
      } else {
        res.status(500).json({ message: 'Failed to send email. Please try again.' })
      }
    }
    
  } catch (error) {
    console.error('Forgot password error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body
    
    const resetData = RESET_TOKENS.get(token)
    if (!resetData) {
      return res.status(400).json({ message: 'Invalid or expired reset token' })
    }
    
    if (Date.now() > resetData.expiresAt) {
      RESET_TOKENS.delete(token)
      return res.status(400).json({ message: 'Reset token has expired' })
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [hashedPassword, resetData.userId]
    )
    
    RESET_TOKENS.delete(token)
    
    console.log(`Password reset successful for user ${resetData.userId}`)
    
    res.json({ message: 'Password reset successfully' })
  } catch (error) {
    console.error('Reset password error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

app.get('/api/inventories', authenticateToken, async (req, res) => {
  try {
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [req.user.userId])
    if (userCheck.rows.length === 0) {
      return res.status(401).json({ message: 'User not found. Please log in again.' })
    }
    
    const result = await pool.query(
      'SELECT * FROM inventories WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.userId]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Get inventories error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

app.post('/api/inventories', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body
    
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [req.user.userId])
    if (userCheck.rows.length === 0) {
      return res.status(401).json({ message: 'User not found. Please log in again.' })
    }
    
    const result = await pool.query(
      'INSERT INTO inventories (user_id, name, description) VALUES ($1, $2, $3) RETURNING *',
      [req.user.userId, name, description]
    )
    
    const newInventory = result.rows[0]
    
    res.status(201).json(newInventory)
  } catch (error) {
    console.error('Create inventory error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

app.delete('/api/inventories/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM inventories WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.userId]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Inventory not found' })
    }
    
    res.json({ message: 'Inventory deleted' })
  } catch (error) {
    console.error('Delete inventory error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

app.get('/api/inventory/:inventoryId', authenticateToken, async (req, res) => {
  try {
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [req.user.userId])
    if (userCheck.rows.length === 0) {
      return res.status(401).json({ message: 'User not found. Please log in again.' })
    }
    
    const result = await pool.query(
      'SELECT * FROM inventory_items WHERE inventory_id = $1 AND user_id = $2 ORDER BY created_at DESC',
      [req.params.inventoryId, req.user.userId]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Get inventory error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

app.get('/api/locations/:inventoryId', authenticateToken, async (req, res) => {
  try {
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [req.user.userId])
    if (userCheck.rows.length === 0) {
      return res.status(401).json({ message: 'User not found. Please log in again.' })
    }
    
    const result = await pool.query(
      'SELECT * FROM locations WHERE inventory_id = $1 AND user_id = $2 ORDER BY name',
      [req.params.inventoryId, req.user.userId]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Get locations error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

app.post('/api/locations/:inventoryId', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body
    const result = await pool.query(
      'INSERT INTO locations (inventory_id, user_id, name) VALUES ($1, $2, $3) RETURNING *',
      [req.params.inventoryId, req.user.userId, name]
    )
    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Add location error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

app.delete('/api/locations/:locationId', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM locations WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.locationId, req.user.userId]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Location not found' })
    }
    
    res.json({ message: 'Location deleted' })
  } catch (error) {
    console.error('Delete location error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

app.get('/api/inventory', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM inventory_items WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.userId]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Get inventory error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

app.post('/api/inventory', authenticateToken, async (req, res) => {
  try {
    const { inventoryId, itemName, vendor, catalog, cas, price, unitSize, amount, amountUnit, minStock, maxStock, url, location, imageData, modelCid, lotNumber } = req.body
    
    if (!inventoryId) {
      return res.status(400).json({ message: 'Inventory ID is required' })
    }
    
    console.log('Adding inventory item:', {
      inventoryId,
      itemName,
      vendor,
      catalog,
      cas,
      lotNumber,
      imageDataLength: imageData ? imageData.length : 0,
      modelCid
    })
    
    const result = await pool.query(
      `INSERT INTO inventory_items 
       (inventory_id, user_id, item_name, vendor, catalog, cas, price, unit_size, amount, amount_unit, min_stock, max_stock, url, location, image_data, model_cid, lot_number) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) 
       RETURNING *`,
      [inventoryId, req.user.userId, itemName, vendor, catalog, cas, price, unitSize, amount, amountUnit, minStock, maxStock, url, location, imageData, modelCid, lotNumber]
    )
    
    console.log('Item added successfully with ID:', result.rows[0].id)
    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Add inventory error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

app.delete('/api/inventory/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM inventory_items WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.userId]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Item not found' })
    }
    
    res.json({ message: 'Item deleted' })
  } catch (error) {
    console.error('Delete inventory error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

app.post('/api/extract-cas', authenticateToken, upload.single('image'), async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    res.status(500).json({ error: 'OPENAI_API_KEY not set' })
    return
  }
  if (!req.file) {
    res.status(400).json({ error: 'No image uploaded' })
    return
  }
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const mime = req.file.mimetype || 'image/jpeg'
    const dataUrl = `data:${mime};base64,${req.file.buffer.toString('base64')}`
    const sys = 'Extract from product label images. Reply with strict JSON only: {"cas": string|null, "massValue": number|null, "massUnit": string|null, "vendor": string|null, "productCode": string|null, "lotNumber": string|null}. massUnit should be a short unit like g, mg, kg, mL, L, µL. vendor should be the company/brand name. productCode should be the catalog/product code (like F005423). lotNumber should be the batch/lot number (like L409495). If not visible, use nulls.'
    const user = [{ type: 'text', text: 'Find CAS, mass value, unit, vendor, product code, and lot number on this label and return JSON only.' }, { type: 'image_url', image_url: { url: dataUrl } }]
    const resp = await client.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: sys }, { role: 'user', content: user }], temperature: 0 })
    const text = (resp.choices?.[0]?.message?.content || '').trim()
    let parsed = null
    const fenceMatch = text.match(/\{[\s\S]*\}/)
    if (fenceMatch) {
      try { parsed = JSON.parse(fenceMatch[0]) } catch (_) {}
    }
    if (!parsed) {
      const cleaned = text.replace(/^```json\s*|^```|```$/gmi, '').replace(/^json\s*/i, '').trim()
      try { parsed = JSON.parse(cleaned) } catch (_) {}
    }
    if (!parsed) {
      const casMatch = text.match(/\b(\d{2,7}-\d{2}-\d)\b/)
      let mv = null, mu = null, vendor = null, productCode = null, lotNumber = null
      const massMatch = text.match(/(\d+(?:\.\d+)?)\s*(mg|g|kg|µg|ug|ml|mL|l|L|µL)/i)
      if (massMatch) {
        mv = Number(massMatch[1])
        const unitRaw = massMatch[2]
        mu = unitRaw.replace(/^ug$/i, 'µg').replace(/^ml$/i, 'mL').replace(/^l$/i, 'L')
      }
      res.status(200).json({ cas: casMatch ? casMatch[1] : '', massValue: mv, massUnit: mu, vendor: vendor, productCode: productCode, lotNumber: lotNumber, raw: text })
      return
    }
    const cas = typeof parsed.cas === 'string' ? parsed.cas : ''
    const massValue = typeof parsed.massValue === 'number' ? parsed.massValue : null
    const massUnit = typeof parsed.massUnit === 'string' ? parsed.massUnit : null
    const vendor = typeof parsed.vendor === 'string' ? parsed.vendor : null
    const productCode = typeof parsed.productCode === 'string' ? parsed.productCode : null
    const lotNumber = typeof parsed.lotNumber === 'string' ? parsed.lotNumber : null
    res.json({ cas, massValue, massUnit, vendor, productCode, lotNumber })
  } catch (e) {
    res.status(500).json({ error: 'OpenAI request failed', message: String(e?.message || e) })
  }
})

app.post('/api/migrate-db', async (req, res) => {
  try {
    console.log('Starting database migration...')
    
    const migrations = [
      {
        name: 'Add image_data column',
        sql: `ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS image_data TEXT`
      },
      {
        name: 'Add model_cid column',
        sql: `ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS model_cid VARCHAR(255)`
      },
      {
        name: 'Add inventory_id column',
        sql: `ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS inventory_id INTEGER`
      },
      {
        name: 'Add inventory_id to locations',
        sql: `ALTER TABLE locations ADD COLUMN IF NOT EXISTS inventory_id INTEGER REFERENCES inventories(id) ON DELETE CASCADE`
      },
      {
        name: 'Add lot_number column',
        sql: `ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS lot_number VARCHAR(255)`
      }
    ]
    
    for (const migration of migrations) {
      try {
        console.log(`Running migration: ${migration.name}`)
        await pool.query(migration.sql)
        console.log(`✓ ${migration.name} completed`)
      } catch (error) {
        console.log(`⚠ ${migration.name} failed:`, error.message)
        // Continue with other migrations even if one fails
      }
    }
    
    console.log('Database migration completed!')
    res.json({ 
      message: 'Database migration completed successfully',
      migrations: migrations.length
    })
  } catch (error) {
    console.error('Migration error:', error)
    res.status(500).json({ message: 'Migration failed', error: error.message })
  }
})

app.post('/api/migrate-to-inventories', async (req, res) => {
  try {
    console.log('Starting inventory migration...')
    
    const { userId } = req.body
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' })
    }
    
    const client = await pool.connect()
    
    try {
      await client.query('BEGIN')
      
      const createDefaultInventory = `
        INSERT INTO inventories (user_id, name, description) 
        VALUES ($1, 'Default Inventory', 'Migrated from existing data') 
        RETURNING id
      `
      
      const inventoryResult = await client.query(createDefaultInventory, [userId])
      const inventoryId = inventoryResult.rows[0].id
      
      const updateExistingItems = `
        UPDATE inventory_items 
        SET inventory_id = $1 
        WHERE user_id = $2 AND inventory_id IS NULL
      `
      
      await client.query(updateExistingItems, [inventoryId, userId])
      
      await client.query('COMMIT')
      
      console.log('Inventory migration completed!')
      res.json({ 
        message: 'Inventory migration completed successfully',
        inventoryId: inventoryId
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Inventory migration error:', error)
    res.status(500).json({ message: 'Inventory migration failed', error: error.message })
  }
})

app.post('/api/clear-all-data', authenticateToken, async (req, res) => {
  try {
    console.log('Starting complete data clear operation...')
    
    const client = await pool.connect()
    
    try {
      await client.query('BEGIN')
      
      await client.query('DELETE FROM inventory_items')
      await client.query('DELETE FROM locations')
      await client.query('DELETE FROM inventories')
      await client.query('DELETE FROM users')
      
      await client.query('COMMIT')
      
      console.log('Complete data clear operation completed!')
      res.json({ message: 'All data cleared successfully. The entire database has been wiped clean. You can now start completely fresh!' })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Data clear error:', error)
    res.status(500).json({ message: 'Data clear failed', error: error.message })
  }
})

app.post('/api/export-inventory/:inventoryId', authenticateToken, async (req, res) => {
  try {
    const { inventoryId } = req.params
    
    const userCheck = await pool.query('SELECT id, email, name FROM users WHERE id = $1', [req.user.userId])
    if (userCheck.rows.length === 0) {
      return res.status(401).json({ message: 'User not found. Please log in again.' })
    }
    
    const user = userCheck.rows[0]
    
    const inventoryCheck = await pool.query('SELECT name FROM inventories WHERE id = $1 AND user_id = $2', [inventoryId, req.user.userId])
    if (inventoryCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Inventory not found' })
    }
    
    const inventory = inventoryCheck.rows[0]
    
    const itemsResult = await pool.query(
      'SELECT * FROM inventory_items WHERE inventory_id = $1 AND user_id = $2 ORDER BY created_at DESC',
      [inventoryId, req.user.userId]
    )
    
    const locationsResult = await pool.query(
      'SELECT * FROM locations WHERE inventory_id = $1 AND user_id = $2 ORDER BY name',
      [inventoryId, req.user.userId]
    )
    
    const items = itemsResult.rows
    const locations = locationsResult.rows
    
    if (!transporter) {
      return res.status(500).json({ message: 'Email service not configured. Please contact support.' })
    }
    
    const csvContent = generateCSVContent(items, locations, inventory.name)
    const csvBuffer = Buffer.from(csvContent, 'utf-8')
    const csvBase64 = csvBuffer.toString('base64')
    
    const senderName = process.env.EMAIL_SENDER_NAME || 'Inventory Tracker'
    const senderEmail = process.env.EMAIL_USER || 'noreply@inventorytracker.com'
    
    const mailOptions = {
      from: `"${senderName}" <${senderEmail}>`,
      to: user.email,
      subject: `CSV Export - ${inventory.name} Inventory`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8fafc; padding: 20px;">
          <div style="background-color: white; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="color: #1e40af; margin: 0; font-size: 28px; font-weight: 700;">🧪 Inventory Tracker</h1>
              <p style="color: #6b7280; margin: 8px 0 0 0; font-size: 16px;">Lab Equipment Management System</p>
            </div>
            
            <h2 style="color: #1e40af; margin: 0 0 24px 0; font-size: 22px; font-weight: 600;">CSV Export Complete</h2>
            
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">Hello <strong>${user.name}</strong>,</p>
            
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">Your CSV export for <strong>${inventory.name}</strong> inventory has been generated successfully.</p>
            
            <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; margin: 24px 0;">
              <p style="color: #6b7280; font-size: 14px; margin: 0; text-align: center;">
                <strong>📊 Export Summary:</strong><br>
                • Items: ${items.length}<br>
                • Locations: ${locations.length}<br>
                • Generated: ${new Date().toLocaleString()}
              </p>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 0 0 16px 0;">The CSV file is attached to this email. You can open it in Excel, Google Sheets, or any spreadsheet application.</p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
            
            <div style="text-align: center;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">Best regards,</p>
              <p style="color: #1e40af; font-size: 14px; font-weight: 600; margin: 4px 0 0 0;">Inventory Tracker Team</p>
              <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0 0;">Lab Equipment Management System</p>
            </div>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `${inventory.name.replace(/[^a-zA-Z0-9]/g, '_')}_inventory_${new Date().toISOString().split('T')[0]}.csv`,
          content: csvBase64,
          encoding: 'base64'
        }
      ]
    }
    
    await transporter.sendMail(mailOptions)
    console.log(`CSV export email sent to ${user.email} for inventory ${inventoryId}`)
    
    res.json({ 
      message: 'CSV export sent successfully',
      itemCount: items.length,
      locationCount: locations.length
    })
    
  } catch (error) {
    console.error('Export inventory error:', error)
    res.status(500).json({ message: 'Export failed. Please try again.' })
  }
})

app.post('/api/vendor-lookup', authenticateToken, async (req, res) => {
  try {
    const { vendor, productCode, cas } = req.body
    
    if (!vendor || !productCode) {
      return res.status(400).json({ message: 'Vendor and product code are required' })
    }
    
    console.log(`Looking up vendor data for ${vendor} product ${productCode}`)
    
    let vendorData = null
    
    // Fluorochem integration
    if (vendor.toLowerCase().includes('fluorochem')) {
      vendorData = await lookupFluorochemProduct(productCode, cas)
    }
    // Sigma-Aldrich integration
    else if (vendor.toLowerCase().includes('sigma') || vendor.toLowerCase().includes('aldrich')) {
      vendorData = await lookupSigmaAldrichProduct(productCode, cas)
    }
    // Fisher Scientific integration
    else if (vendor.toLowerCase().includes('fisher') || vendor.toLowerCase().includes('thermo')) {
      vendorData = await lookupFisherProduct(productCode, cas)
    }
    // Generic web search fallback
    else {
      vendorData = await genericVendorSearch(vendor, productCode, cas)
    }
    
    if (vendorData) {
      res.json(vendorData)
    } else {
      res.status(404).json({ message: 'No vendor information found' })
    }
    
  } catch (error) {
    console.error('Vendor lookup error:', error)
    res.status(500).json({ message: 'Vendor lookup failed', error: error.message })
  }
})

async function lookupFluorochemProduct(productCode, cas) {
  try {
    console.log(`Looking up Fluorochem product: ${productCode}`)
    
    // Try direct product URL first
    const productUrl = `https://www.fluorochem.co.uk/products/${productCode}`
    
    // Use a headless browser approach or fetch with proper headers
    const response = await fetch(productUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })
    
    if (response.ok) {
      const html = await response.text()
      
      // Extract price information
      const priceMatch = html.match(/£\s*([\d,]+\.?\d*)/)
      const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : null
      
      // Extract availability
      const availabilityMatch = html.match(/availability[:\s]*([^<>\n]+)/i)
      const availability = availabilityMatch ? availabilityMatch[1].trim() : null
      
      // Extract description
      const descMatch = html.match(/<meta[^>]*description[^>]*content="([^"]+)"/i)
      const description = descMatch ? descMatch[1] : null
      
      return {
        vendor: 'Fluorochem Ltd.',
        productUrl: productUrl,
        price: price,
        availability: availability,
        description: description,
        source: 'fluorochem.co.uk'
      }
    }
    
    // Fallback: Search their catalog
    const searchUrl = `https://www.fluorochem.co.uk/search?q=${encodeURIComponent(productCode)}`
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })
    
    if (searchResponse.ok) {
      const searchHtml = await searchResponse.text()
      
      // Look for product links in search results
      const productLinkMatch = searchHtml.match(/href="([^"]*products[^"]*${productCode}[^"]*)"/i)
      if (productLinkMatch) {
        const foundProductUrl = `https://www.fluorochem.co.uk${productLinkMatch[1]}`
        return {
          vendor: 'Fluorochem Ltd.',
          productUrl: foundProductUrl,
          price: null,
          availability: null,
          description: null,
          source: 'fluorochem.co.uk (search result)'
        }
      }
    }
    
    return null
    
  } catch (error) {
    console.error('Fluorochem lookup error:', error)
    return null
  }
}

async function lookupSigmaAldrichProduct(productCode, cas) {
  try {
    console.log(`Looking up Sigma-Aldrich product: ${productCode}`)
    
    // Sigma-Aldrich product URLs
    const productUrl = `https://www.sigmaaldrich.com/US/en/product/${productCode}`
    
    const response = await fetch(productUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })
    
    if (response.ok) {
      const html = await response.text()
      
      // Extract price information
      const priceMatch = html.match(/\$([\d,]+\.?\d*)/)
      const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : null
      
      // Extract availability
      const availabilityMatch = html.match(/availability[:\s]*([^<>\n]+)/i)
      const availability = availabilityMatch ? availabilityMatch[1].trim() : null
      
      return {
        vendor: 'Sigma-Aldrich',
        productUrl: productUrl,
        price: price,
        availability: availability,
        description: null,
        source: 'sigmaaldrich.com'
      }
    }
    
    return null
    
  } catch (error) {
    console.error('Sigma-Aldrich lookup error:', error)
    return null
  }
}

async function lookupFisherProduct(productCode, cas) {
  try {
    console.log(`Looking up Fisher Scientific product: ${productCode}`)
    
    // Fisher Scientific product URLs
    const productUrl = `https://www.fishersci.com/shop/products/${productCode}`
    
    const response = await fetch(productUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })
    
    if (response.ok) {
      const html = await response.text()
      
      // Extract price information
      const priceMatch = html.match(/\$([\d,]+\.?\d*)/)
      const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : null
      
      return {
        vendor: 'Fisher Scientific',
        productUrl: productUrl,
        price: price,
        availability: null,
        description: null,
        source: 'fishersci.com'
      }
    }
    
    return null
    
  } catch (error) {
    console.error('Fisher Scientific lookup error:', error)
    return null
  }
}

async function genericVendorSearch(vendor, productCode, cas) {
  try {
    console.log(`Generic search for ${vendor} product ${productCode}`)
    
    // Try to construct a search URL based on common vendor patterns
    const searchQueries = [
      `${vendor} ${productCode}`,
      `${vendor} ${productCode} ${cas || ''}`,
      `${productCode} ${vendor}`,
      `${cas || ''} ${vendor}`
    ].filter(q => q.trim())
    
    // For now, return a generic search suggestion
    return {
      vendor: vendor,
      productUrl: null,
      price: null,
      availability: null,
      description: null,
      source: 'generic_search',
      searchQueries: searchQueries,
      note: `Try searching for: ${searchQueries[0]}`
    }
    
  } catch (error) {
    console.error('Generic vendor search error:', error)
    return null
  }
}

function generateCSVContent(items, locations, inventoryName) {
  const headers = [
    'Item Name',
    'Vendor',
    'Catalog Number',
    'CAS Number',
    'Lot Number',
    'Price',
    'Unit Size',
    'Amount in Stock',
    'Amount Unit',
    'Min Stock',
    'Max Stock',
    'URL',
    'Location',
    'Model CID',
    'Created Date'
  ]
  
  const csvRows = [headers.join(',')]
  
  items.forEach(item => {
    const row = [
      `"${(item.item_name || '').replace(/"/g, '""')}"`,
      `"${(item.vendor || '').replace(/"/g, '""')}"`,
      `"${(item.catalog || '').replace(/"/g, '""')}"`,
      `"${(item.cas || '').replace(/"/g, '""')}"`,
      `"${(item.lot_number || '').replace(/"/g, '""')}"`,
      item.price || '',
      `"${(item.unit_size || '').replace(/"/g, '""')}"`,
      item.amount || '',
      `"${(item.amount_unit || '').replace(/"/g, '""')}"`,
      item.min_stock || '',
      item.max_stock || '',
      `"${(item.url || '').replace(/"/g, '""')}"`,
      `"${(item.location || '').replace(/"/g, '""')}"`,
      `"${(item.model_cid || '').replace(/"/g, '""')}"`,
      `"${item.created_at || ''}"`
    ]
    csvRows.push(row.join(','))
  })
  
  csvRows.push('') // Empty row for separation
  csvRows.push('Locations') // Locations header
  csvRows.push('Location Name,Created Date')
  
  locations.forEach(location => {
    const row = [
      `"${(location.name || '').replace(/"/g, '""')}"`,
      `"${location.created_at || ''}"`
    ]
    csvRows.push(row.join(','))
  })
  
  return csvRows.join('\n')
}

function cleanupExpiredTokens() {
  const now = Date.now()
  for (const [token, data] of RESET_TOKENS.entries()) {
    if (now > data.expiresAt) {
      RESET_TOKENS.delete(token)
    }
  }
}

setInterval(cleanupExpiredTokens, 5 * 60 * 1000)

const port = process.env.PORT || 3000
app.listen(port, async () => {
  console.log(`Server running on port ${port}`)
  console.log('Authentication system ready!')
  console.log('Email configuration:', {
    user: process.env.EMAIL_USER ? 'Set' : 'Not set',
    pass: process.env.EMAIL_PASS ? 'Set' : 'Not set'
  })
  
  try {
    await createTablesIfNotExist()
    console.log('Database initialization completed successfully')
  } catch (error) {
    console.error('Database initialization failed:', error)
    console.log('You may need to run the database migration manually')
  }
})


