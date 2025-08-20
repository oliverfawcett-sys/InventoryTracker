const imageInput = document.getElementById('imageInput')
const scanStatus = document.getElementById('scanStatus')
const scanResult = document.getElementById('scanResult')
const btnCamera = document.getElementById('btnCamera')
const camera = document.getElementById('camera')
const cameraControls = document.getElementById('cameraControls')
const btnCapture = document.getElementById('btnCapture')
const btnCancelCamera = document.getElementById('btnCancelCamera')

let stream = null

async function handleFile(file) {
  scanStatus.textContent = 'Scanning bottle...'
  scanResult.textContent = ''
  await extractCasAndRedirect(file)
}

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    camera.srcObject = stream
    camera.style.display = 'block'
    cameraControls.style.display = 'block'
    btnCamera.style.display = 'none'
    scanStatus.textContent = 'Camera ready. Position the bottle and click Capture.'
  } catch (e) {
    scanStatus.textContent = 'Camera access denied. Please use file upload instead.'
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop())
    stream = null
  }
  camera.style.display = 'none'
  cameraControls.style.display = 'none'
  btnCamera.style.display = 'inline-flex'
  scanStatus.textContent = ''
}

async function capturePhoto() {
  const canvas = document.createElement('canvas')
  canvas.width = camera.videoWidth
  canvas.height = camera.videoHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(camera, 0, 0)
  
  canvas.toBlob(async (blob) => {
    const file = new File([blob], 'camera-photo.jpg', { type: 'image/jpeg' })
    stopCamera()
    await extractCasAndRedirect(file)
  }, 'image/jpeg')
}

imageInput.addEventListener('change', () => {
  const file = imageInput.files?.[0]
  if (file) handleFile(file)
})

btnCamera.addEventListener('click', startCamera)
btnCapture.addEventListener('click', capturePhoto)
btnCancelCamera.addEventListener('click', stopCamera)

async function extractCasAndRedirect(file) {
  try {
    const form = new FormData()
    form.append('image', file)
    const res = await fetch('/api/extract-cas', { method: 'POST', body: form })
    const data = await res.json()
    
    if (!res.ok) {
      scanStatus.textContent = 'Scan failed: ' + (data.message || 'Server error')
      setTimeout(() => window.location.href = 'new.html', 2000)
      return
    }
    
    if (data.cas) {
      const payload = { cas: data.cas, amount: data.massValue ?? null, amountUnit: data.massUnit || null }
      try { localStorage.setItem('pendingNewItemPopulate', JSON.stringify(payload)) } catch (_) {}
      scanStatus.textContent = 'Information found! Opening form...'
    } else {
      scanStatus.textContent = 'No information found. Opening empty form...'
    }
    
    const reader = new FileReader()
    reader.onload = function(e) {
      try { localStorage.setItem('scannedImageData', e.target.result) } catch (_) {}
    }
    reader.readAsDataURL(file)
    
    setTimeout(() => {
      try { window.location.href = 'new.html' } catch (_) {}
    }, 1000)
    
  } catch (e) {
    scanStatus.textContent = 'Scan failed: ' + (e?.message || e)
    setTimeout(() => window.location.href = 'new.html', 2000)
  }
}

async function lookupNameByCas(cas) {
  try {
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(cas)}/property/Title/JSON`
    const res = await fetch(url)
    if (!res.ok) return ''
    const data = await res.json()
    const p = data?.PropertyTable?.Properties?.[0]
    return p?.Title || ''
  } catch (_) {
    return ''
  }
}


