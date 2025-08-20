const express = require('express')
const multer = require('multer')
const OpenAI = require('openai')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { Pool } = require('pg')

const app = express()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

app.use(express.json())
app.use(express.static(__dirname))

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

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
    
    const createInventoryTable = `
      CREATE TABLE IF NOT EXISTS inventory_items (
        id SERIAL PRIMARY KEY,
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
    
    const createLocationsTable = `
      CREATE TABLE IF NOT EXISTS locations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
    
    await pool.query(createUsersTable)
    await pool.query(createInventoryTable)
    await pool.query(createLocationsTable)
    
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
    const { itemName, vendor, catalog, cas, price, unitSize, amount, amountUnit, minStock, maxStock, url, location, imageData, modelCid } = req.body
    
    const result = await pool.query(
      `INSERT INTO inventory_items 
       (user_id, item_name, vendor, catalog, cas, price, unit_size, amount, amount_unit, min_stock, max_stock, url, location, image_data, model_cid) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) 
       RETURNING *`,
      [req.user.userId, itemName, vendor, catalog, cas, price, unitSize, amount, amountUnit, minStock, maxStock, url, location, imageData, modelCid]
    )
    
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
    const sys = 'Extract from product label images. Reply with strict JSON only: {"cas": string|null, "massValue": number|null, "massUnit": string|null}. massUnit should be a short unit like g, mg, kg, mL, L, µL. If not visible, use nulls.'
    const user = [{ type: 'text', text: 'Find CAS, mass value and unit on this label and return JSON only.' }, { type: 'image_url', image_url: { url: dataUrl } }]
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
      let mv = null, mu = null
      const massMatch = text.match(/(\d+(?:\.\d+)?)\s*(mg|g|kg|µg|ug|ml|mL|l|L|µL)/i)
      if (massMatch) {
        mv = Number(massMatch[1])
        const unitRaw = massMatch[2]
        mu = unitRaw.replace(/^ug$/i, 'µg').replace(/^ml$/i, 'mL').replace(/^l$/i, 'L')
      }
      res.status(200).json({ cas: casMatch ? casMatch[1] : '', massValue: mv, massUnit: mu, raw: text })
      return
    }
    const cas = typeof parsed.cas === 'string' ? parsed.cas : ''
    const massValue = typeof parsed.massValue === 'number' ? parsed.massValue : null
    const massUnit = typeof parsed.massUnit === 'string' ? parsed.massUnit : null
    res.json({ cas, massValue, massUnit })
  } catch (e) {
    res.status(500).json({ error: 'OpenAI request failed', message: String(e?.message || e) })
  }
})

app.post('/api/migrate-db', async (req, res) => {
  try {
    console.log('Starting database migration...')
    
    const addImageDataColumn = `
      ALTER TABLE inventory_items 
      ADD COLUMN IF NOT EXISTS image_data TEXT
    `
    
    const addModelCidColumn = `
      ALTER TABLE inventory_items 
      ADD COLUMN IF NOT EXISTS model_cid VARCHAR(255)
    `
    
    await pool.query(addImageDataColumn)
    await pool.query(addModelCidColumn)
    
    console.log('Database migration completed!')
    res.json({ message: 'Database migration completed successfully' })
  } catch (error) {
    console.error('Migration error:', error)
    res.status(500).json({ message: 'Migration failed', error: error.message })
  }
})

const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log(`Server running on port ${port}`)
  console.log('Authentication system ready!')
  createTablesIfNotExist()
})


