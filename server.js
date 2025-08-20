const express = require('express')
const multer = require('multer')
const OpenAI = require('openai')

const app = express()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

app.use(express.static(__dirname))

app.post('/api/extract-cas', upload.single('image'), async (req, res) => {
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

const port = process.env.PORT || 3000
app.listen(port, () => {})


