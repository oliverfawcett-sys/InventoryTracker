const storageKey = 'inventoryItemsV2'
const locationsKey = 'inventoryLocationsV1'

const lookupForm = document.getElementById('lookupForm')
const lookupQueryInput = document.getElementById('lookupQuery')
const lookupError = document.getElementById('lookupError')

const itemForm = document.getElementById('itemForm')
const itemName = document.getElementById('itemName')
const vendor = document.getElementById('vendor')
const catalog = document.getElementById('catalog')
const cas = document.getElementById('cas')
const price = document.getElementById('price')
const unitSize = document.getElementById('unitSize')
const amount = document.getElementById('amount')
const amountUnit = document.getElementById('amountUnit')
const minStock = document.getElementById('minStock')
const maxStock = document.getElementById('maxStock')
const url = document.getElementById('url')
const locationSelect = document.getElementById('location')
const newLocationInput = document.getElementById('newLocation')
const addLocationBtn = document.getElementById('addLocationBtn')
const formError = document.getElementById('formError')

const viewerEl = document.getElementById('viewer3d-small')
let viewer
let spinHandle = null

const defaultUnits = ['mL', 'L', 'g', 'kg', 'mg', 'µL', 'units']

function showLookupSection(show) {
  const lookupSection = document.querySelector('.card:has(#lookupForm)')
  if (lookupSection) {
    lookupSection.style.display = show ? 'block' : 'none'
  }
}

function loadLocations() {
  const raw = localStorage.getItem(locationsKey)
  const list = raw ? JSON.parse(raw) : []
  return list
}

function saveLocations(list) {
  localStorage.setItem(locationsKey, JSON.stringify(list))
}

function renderLocations() {
  const list = loadLocations()
  locationSelect.innerHTML = ''
  const frag = document.createDocumentFragment()
  list.forEach(loc => {
    const opt = document.createElement('option')
    opt.value = loc
    opt.textContent = loc
    frag.appendChild(opt)
  })
  locationSelect.appendChild(frag)
}

function ensureDefaultLocations() {
  const raw = localStorage.getItem(locationsKey)
  if (!raw) saveLocations(['Main Lab', 'Cold Room', 'Chemical Store'])
}

function renderAmountUnits() {
  amountUnit.innerHTML = ''
  const frag = document.createDocumentFragment()
  defaultUnits.forEach(u => {
    const opt = document.createElement('option')
    opt.value = u
    opt.textContent = u
    frag.appendChild(opt)
  })
  amountUnit.appendChild(frag)
}

function loadItems() {
  const raw = localStorage.getItem(storageKey)
  return raw ? JSON.parse(raw) : []
}

function saveItems(items) {
  localStorage.setItem(storageKey, JSON.stringify(items))
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

async function fetchPubChemSummary(query) {
  const base = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound'
  const url = `${base}/name/${encodeURIComponent(query.trim())}/JSON`
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
  if (!res.ok) throw new Error('Lookup failed')
  const data = await res.json()
  const record = data?.PC_Compounds?.[0]
  if (!record) throw new Error('No results')
  const id = record?.id?.id?.cid
  let casVal = ''
  let title = ''
  try {
    const propRes = await fetch(`${base}/cid/${id}/property/Title/JSON`)
    if (propRes.ok) {
      const prop = await propRes.json()
      const p = prop?.PropertyTable?.Properties?.[0]
      title = p?.Title || ''
    }
  } catch (_) {}
  try {
    const synRes = await fetch(`${base}/cid/${id}/synonyms/JSON`)
    if (synRes.ok) {
      const syn = await synRes.json()
      const list = syn?.InformationList?.Information?.[0]?.Synonym || []
      const found = list.find(s => /^(\d{1,7}-\d{2}-\d)$/.test(s))
      casVal = found || ''
    }
  } catch (_) {}
  return { cid: id, name: title || (lookupQueryInput.value || '').trim(), cas: casVal }
}

function initViewer() {
  if (!viewerEl || typeof $3Dmol === 'undefined') return
  viewer = $3Dmol.createViewer(viewerEl, { backgroundColor: '#ffffff' })
  viewer.render()
  if (viewerEl && viewerEl.querySelector('canvas')) {
    const canvas = viewerEl.querySelector('canvas')
    canvas.style.position = 'absolute'
    canvas.style.inset = '0'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
  }
  window.addEventListener('resize', () => {
    if (viewer) viewer.resize()
  })
}

async function render3DModel(cid) {
  if (!viewer || !cid) return
  viewerEl.innerHTML = ''
  viewer = $3Dmol.createViewer(viewerEl, { backgroundColor: '#ffffff' })
  try {
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=3d`
    const res = await fetch(url)
    if (!res.ok) throw new Error('No 3D available')
    const sdf = await res.text()
    viewer.addModel(sdf, 'sdf')
    viewer.setStyle({}, { stick: { radius: 0.12 } })
    viewer.zoomTo()
    viewer.render()
    if (viewerEl && viewerEl.querySelector('canvas')) {
      const canvas = viewerEl.querySelector('canvas')
      canvas.style.position = 'absolute'
      canvas.style.inset = '0'
      canvas.style.width = '100%'
      canvas.style.height = '100%'
    }
    if (viewer) viewer.resize()
    animateSpin(viewer)
  } catch (_) {}
}

function animateSpin(viewer) {
  if (spinHandle) cancelAnimationFrame(spinHandle)
  function step() {
    viewer.rotate(1, 'y')
    viewer.render()
    spinHandle = requestAnimationFrame(step)
  }
  spinHandle = requestAnimationFrame(step)
}

document.addEventListener('DOMContentLoaded', () => {
  checkAuth()
  ensureDefaultLocations()
  renderLocations()
  renderAmountUnits()
  initViewer()
  
  showLookupSection(true)
  
  cas.addEventListener('input', () => {
    if (!cas.value.trim()) {
      showLookupSection(true)
    }
  })
  
  try {
    const imageData = localStorage.getItem('scannedImageData')
    if (imageData) {
      localStorage.removeItem('scannedImageData')
      const imagePreview = document.getElementById('imagePreview')
      const scannedImage = document.getElementById('scannedImage')
      if (imagePreview && scannedImage) {
        scannedImage.src = imageData
        imagePreview.style.display = 'block'
      }
    }
  } catch (_) {}
  
  try {
    const raw = localStorage.getItem('pendingNewItemPopulate')
    if (raw) {
      localStorage.removeItem('pendingNewItemPopulate')
      const p = JSON.parse(raw)
      if (p?.cas && !cas.value) cas.value = p.cas
      if (typeof p?.amount === 'number' && !Number.isNaN(p.amount)) amount.value = String(p.amount)
      if (p?.amountUnit) amountUnit.value = p.amountUnit
      if (p?.cas) {
        fetchPubChemSummary(p.cas).then(info => {
          if (info.name && !itemName.value) itemName.value = info.name
          if (info.cid) render3DModel(info.cid)
          showLookupSection(false)
        }).catch(() => {
          showLookupSection(true)
        })
      }
    }
  } catch (_) {}
})

function checkAuth() {
  const token = localStorage.getItem('authToken')
  const user = localStorage.getItem('currentUser')
  
  if (!token || !user) {
    window.location.href = 'login.html'
    return
  }
}

lookupForm.addEventListener('submit', async e => {
  e.preventDefault()
  lookupError.textContent = ''
  const q = (lookupQueryInput.value || '').trim()
  if (!q) {
    lookupError.textContent = 'Enter a CAS or name.'
    return
  }
  try {
    const info = await fetchPubChemSummary(q)
    if (info.name && !itemName.value) itemName.value = info.name
    if (info.cas && !cas.value) cas.value = info.cas
    if (info.cid) render3DModel(info.cid)
    showLookupSection(false)
  } catch (_) {
    lookupError.textContent = 'No match found.'
    showLookupSection(true)
  }
})

addLocationBtn.addEventListener('click', () => {
  const name = (newLocationInput.value || '').trim()
  if (!name) return
  const list = loadLocations()
  if (!list.includes(name)) {
    list.push(name)
    saveLocations(list)
    renderLocations()
    locationSelect.value = name
  }
  newLocationInput.value = ''
})

itemForm.addEventListener('submit', async e => {
  e.preventDefault()
  formError.textContent = ''
  if (!itemName.value) {
    formError.textContent = 'Item Name is required.'
    return
  }
  
  try {
    const token = localStorage.getItem('authToken')
    const imageData = localStorage.getItem('scannedImageData') || null
    const modelCid = viewer ? viewer.getModelIds()[0] : null
    
    const response = await fetch('/api/inventory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        itemName: itemName.value.trim(),
        vendor: vendor.value.trim(),
        catalog: catalog.value.trim(),
        cas: cas.value.trim(),
        price: price.value ? Number(price.value) : null,
        unitSize: unitSize.value.trim(),
        amount: amount.value ? Number(amount.value) : null,
        amountUnit: amountUnit.value,
        minStock: minStock.value ? Number(minStock.value) : null,
        maxStock: maxStock.value ? Number(maxStock.value) : null,
        url: url.value.trim(),
        location: locationSelect.value,
        imageData: imageData,
        modelCid: modelCid
      })
    })
    
    if (response.ok) {
      localStorage.removeItem('scannedImageData')
      window.location.href = 'index.html'
    } else {
      const data = await response.json()
      formError.textContent = data.message || 'Failed to add item'
    }
  } catch (error) {
    console.error('Submit error:', error)
    formError.textContent = 'Network error. Please try again.'
  }
})


