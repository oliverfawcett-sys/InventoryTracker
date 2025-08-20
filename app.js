const storageKey = 'inventoryItemsV2'
const searchInput = document.getElementById('searchInput')
const inventoryTable = document.getElementById('inventoryTable')
const itemCount = document.getElementById('itemCount')

let items = []
let query = ''

function load() {
  const raw = localStorage.getItem(storageKey)
  items = raw ? JSON.parse(raw) : []
  let changed = false
  items.forEach(i => {
    if (!i.id) {
      i.id = 'itm_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
      changed = true
    }
  })
  if (changed) save()
}

function save() {
  localStorage.setItem(storageKey, JSON.stringify(items))
}

function normalize(value) {
  return value.toString().trim().toLowerCase()
}

function matches(item, q) {
  if (!q) return true
  const n = normalize(q)
  const fields = [
    item.vendor, item.catalog, item.itemName, item.cas, item.amount, 
    item.unitSize, item.price, item.location, item.url, item.minStock, item.maxStock
  ]
  return fields.filter(Boolean).some(v => normalize(v).includes(n))
}

function render() {
  const filtered = items.filter(i => matches(i, query))
  inventoryTable.innerHTML = ''
  const frag = document.createDocumentFragment()
  
  filtered.forEach(i => {
    const tr = document.createElement('tr')
    const cells = [
      i.vendor || '',
      i.catalog || '',
      i.itemName || '',
      i.cas || '',
      (i.amount ?? '') + (i.amountUnit ? ' ' + i.amountUnit : ''),
      i.unitSize || '',
      typeof i.price === 'number' ? String(i.price) : (i.price || ''),
      i.location || '',
      i.url ? 'Link' : '',
      i.minStock || '',
      i.maxStock || ''
    ]
    
    cells.forEach((text, idx) => {
      const td = document.createElement('td')
      if (idx === 8 && i.url) {
        const a = document.createElement('a')
        a.href = i.url
        a.target = '_blank'
        a.rel = 'noopener'
        a.textContent = 'Link'
        td.appendChild(a)
      } else {
        td.textContent = text
      }
      tr.appendChild(td)
    })
    
    const tdAction = document.createElement('td')
    const delBtn = document.createElement('button')
    delBtn.type = 'button'
    delBtn.className = 'btn danger'
    delBtn.textContent = 'Delete'
    delBtn.addEventListener('click', () => deleteItem(i.id))
    tdAction.appendChild(delBtn)
    tr.appendChild(tdAction)
    frag.appendChild(tr)
  })
  
  inventoryTable.appendChild(frag)
  itemCount.textContent = filtered.length === 1 ? '1 item' : filtered.length + ' items'
}

function deleteItem(id) {
  items = items.filter(i => i.id !== id)
  save()
  render()
}

document.addEventListener('DOMContentLoaded', () => {
  load()
  render()
})

searchInput.addEventListener('input', e => {
  query = e.target.value
  render()
})

 


