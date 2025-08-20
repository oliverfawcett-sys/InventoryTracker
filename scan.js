const imageInput = document.getElementById('imageInput')
const scanStatus = document.getElementById('scanStatus')
const scanResult = document.getElementById('scanResult')
const btnCamera = document.getElementById('btnCamera')
const camera = document.getElementById('camera')
const cameraControls = document.getElementById('cameraControls')
const btnCapture = document.getElementById('btnCapture')
const btnCancelCamera = document.getElementById('btnCancelCamera')

let stream = null

// Debug function to check camera support
function checkCameraSupport() {
  console.log('MediaDevices supported:', !!navigator.mediaDevices)
  console.log('getUserMedia supported:', !!navigator.mediaDevices?.getUserMedia)
  console.log('Camera element:', camera)
  console.log('Camera readyState:', camera.readyState)
}

async function handleFile(file) {
  scanStatus.textContent = 'Scanning bottle...'
  scanResult.textContent = ''
  await extractCasAndRedirect(file)
}

async function startCamera() {
  try {
    scanStatus.textContent = 'Starting camera...'
    
    // Check if camera is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera not supported in this browser')
    }
    
    // Request camera access
    stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      } 
    })
    
    // Set up video element
    camera.srcObject = stream
    camera.style.display = 'block'
    
    // Wait for video to be ready
    await new Promise((resolve) => {
      camera.onloadedmetadata = () => resolve()
    })
    
    // Show controls and hide camera button
    cameraControls.style.display = 'block'
    btnCamera.style.display = 'none'
    
    scanStatus.textContent = 'Camera ready. Position the bottle and click Capture.'
    console.log('Camera started successfully')
    
  } catch (e) {
    console.error('Camera error:', e)
    scanStatus.textContent = `Camera error: ${e.message}. Please use file upload instead.`
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
  try {
    if (!stream || camera.readyState !== 4) {
      scanStatus.textContent = 'Camera not ready. Please wait...'
      return
    }
    
    scanStatus.textContent = 'Capturing photo...'
    
    const canvas = document.createElement('canvas')
    canvas.width = camera.videoWidth
    canvas.height = camera.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(camera, 0, 0)
    
    canvas.toBlob(async (blob) => {
      const file = new File([blob], 'camera-photo.jpg', { type: 'image/jpeg' })
      stopCamera()
      scanStatus.textContent = 'Processing photo...'
      await extractCasAndRedirect(file)
    }, 'image/jpeg', 0.9)
    
  } catch (e) {
    console.error('Capture error:', e)
    scanStatus.textContent = `Capture failed: ${e.message}`
  }
}

imageInput.addEventListener('change', () => {
  const file = imageInput.files?.[0]
  if (file) handleFile(file)
})

btnCamera.addEventListener('click', () => {
  checkCameraSupport()
  startCamera()
})
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


