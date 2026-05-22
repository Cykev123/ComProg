// =====================
// FindIt — Lost & Found
// app.js (API Integration)
// =====================

const EMOJIS = { Electronics: '📱', Clothing: '👕', Accessories: '👜', Documents: '📄', Pets: '🐾', Other: '📦' };
let currentModalId = null;
let currentUser = null;

// ── Check Auth ─────────────────────────────────────────────────────────────
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      window.location.href = '/login.html';
      return;
    }
    currentUser = await res.json();
    
    // Setup UI with user info
    document.querySelector('.avatar').textContent = currentUser.first_name[0] + currentUser.last_name[0];
    document.querySelector('.profile-avatar').textContent = currentUser.first_name[0] + currentUser.last_name[0];
    document.querySelector('.profile-info h2').textContent = currentUser.first_name + ' ' + currentUser.last_name;
    document.querySelector('.profile-info p').textContent = currentUser.email + ' · Member since ' + new Date(currentUser.created_at).getFullYear();
    
    // Hide Admin tab if not admin
    if (currentUser.role !== 'admin') {
      const adminBtn = document.querySelector(`button[onclick="showPage('admin',this)"]`);
      if (adminBtn) adminBtn.style.display = 'none';
    } else {
      // Redirect admin button to admin page
      const adminBtn = document.querySelector(`button[onclick="showPage('admin',this)"]`);
      if(adminBtn) {
        adminBtn.onclick = () => window.location.href = '/admin.html';
      }
    }
    
    // Populate profile form
    document.getElementById('p-first').value = currentUser.first_name;
    document.getElementById('p-last').value = currentUser.last_name;
    document.getElementById('p-email').value = currentUser.email;
    document.getElementById('p-phone').value = currentUser.phone;

  } catch (err) {
    console.error('Auth error:', err);
    window.location.href = '/login.html';
  }
}

// ── Logout ─────────────────────────────────────────────────────────────────
async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login.html';
  } catch (err) {
    console.error('Logout error:', err);
  }
}

// ── Update Profile ─────────────────────────────────────────────────────────
async function updateProfile() {
  const first_name = document.getElementById('p-first').value;
  const last_name = document.getElementById('p-last').value;
  const email = document.getElementById('p-email').value;
  const phone = document.getElementById('p-phone').value;
  const password = document.getElementById('p-pass').value;

  try {
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name, last_name, email, phone, password })
    });
    
    if (res.ok) {
      showToast('Profile updated successfully!');
      document.getElementById('p-pass').value = '';
      checkAuth(); // refresh user info
    } else {
      const data = await res.json();
      showToast('Error: ' + data.error);
    }
  } catch (err) {
    console.error('Profile update error:', err);
    showToast('Failed to update profile');
  }
}

// ── Load Data ──────────────────────────────────────────────────────────────
async function loadHomeItems() {
  try {
    const res = await fetch('/api/items?limit=4');
    const items = await res.json();
    document.getElementById('home-grid').innerHTML = '';
    items.forEach(item => renderCard(item, 'home-grid'));
  } catch (err) {
    console.error('Failed to load home items:', err);
  }
}

async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    const stats = await res.json();
    const statCards = document.querySelectorAll('.stat-card .num');
    if (statCards.length >= 3) {
      statCards[0].textContent = stats.total;
      statCards[1].textContent = stats.claimed;
      statCards[2].textContent = stats.rate + '%';
    }
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

async function filterItems() {
  const q = document.getElementById('search-input').value;
  const status = document.getElementById('filter-status').value;
  const cat = document.getElementById('filter-cat').value;
  
  let url = '/api/items?';
  if (q) url += `search=${encodeURIComponent(q)}&`;
  if (status) url += `status=${encodeURIComponent(status)}&`;
  if (cat) url += `category=${encodeURIComponent(cat)}`;

  try {
    const res = await fetch(url);
    const items = await res.json();
    document.getElementById('browse-grid').innerHTML = '';
    items.forEach(item => renderCard(item, 'browse-grid'));
  } catch (err) {
    console.error('Failed to filter items:', err);
  }
}

async function loadMyPosts() {
  try {
    const res = await fetch('/api/my-items');
    const items = await res.json();
    document.getElementById('my-posts-grid').innerHTML = '';
    items.forEach(item => renderCard(item, 'my-posts-grid'));
  } catch (err) {
    console.error('Failed to load my posts:', err);
  }
}

async function loadMyClaims() {
  try {
    const res = await fetch('/api/claims');
    const claims = await res.json();
    const tbody = document.getElementById('my-claims-body');
    tbody.innerHTML = '';
    
    claims.forEach(c => {
      const statusHtml = {
        pending:  '<span class="status-pill pill-pending">⏳ Pending</span>',
        approved: '<span class="status-pill pill-approved">✅ Approved</span>',
        rejected: '<span class="status-pill pill-rejected">❌ Rejected</span>',
      }[c.status];
      
      const d = new Date(c.created_at).toLocaleDateString();
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${c.item_name}</strong></td>
        <td>${d}</td>
        <td>${statusHtml}</td>
        <td style="font-size:0.82rem;color:var(--muted)">${c.proof.substring(0, 50)}…</td>`;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error('Failed to load my claims:', err);
  }
}

// ── Render ─────────────────────────────────────────────────────────────────
function renderCard(item, container) {
  const div = document.createElement('div');
  div.className = 'item-card';
  const statusClass = { lost: 'badge-lost', found: 'badge-found', claimed: 'badge-claimed' }[item.status];
  
  // Format Date
  const dateObj = new Date(item.date_reported);
  const formattedDate = dateObj.toLocaleDateString();

  div.innerHTML = `
    <div class="item-photo">
      ${EMOJIS[item.category] || '📦'}
      <span class="item-badge ${statusClass}">${item.status}</span>
    </div>
    <div class="item-body">
      <div class="item-title">${item.name}</div>
      <div class="item-meta">
        <span>📍 ${item.location}</span>
        <span>📅 ${formattedDate}</span>
      </div>
      <div class="item-footer">
        <span style="font-size:0.8rem;color:var(--muted)">By ${item.poster}</span>
        <button class="btn-sm ${item.type === 'lost' ? 'blue' : 'red'}" onclick="openModal(${item.id})">
          ${item.type === 'lost' ? 'I Found It' : 'Claim Item'}
        </button>
      </div>
    </div>`;
  document.getElementById(container).appendChild(div);
}

// ── Modal ──────────────────────────────────────────────────────────────────
async function openModal(id) {
  try {
    const res = await fetch(`/api/items/${id}`);
    if (!res.ok) return;
    const item = await res.json();
    
    currentModalId = item.id;
    document.getElementById('modal-photo').textContent = EMOJIS[item.category] || '📦';
    document.getElementById('modal-title').textContent = item.name;
    
    const badge = document.getElementById('modal-badge');
    badge.textContent = item.status;
    badge.className   = 'item-badge ' + { lost: 'badge-lost', found: 'badge-found', claimed: 'badge-claimed' }[item.status];
    
    document.getElementById('modal-date').textContent = new Date(item.date_reported).toLocaleDateString();
    document.getElementById('modal-location').textContent = item.location;
    document.getElementById('modal-category').textContent = item.category;
    document.getElementById('modal-poster').textContent = item.poster;
    document.getElementById('modal-desc').textContent = item.description || 'No description provided';
    
    // Hide claim section if item is claimed OR if current user posted it
    const claimSection = document.getElementById('modal-claim-section');
    if (item.status === 'claimed' || item.user_id === currentUser.id) {
      claimSection.style.display = 'none';
    } else {
      claimSection.style.display = 'block';
    }
    
    document.getElementById('item-modal').classList.add('open');
  } catch (err) {
    console.error('Failed to load item details:', err);
  }
}

function closeModal() {
  document.getElementById('item-modal').classList.remove('open');
}

// ── Claims ─────────────────────────────────────────────────────────────────
async function submitClaim() {
  const claimant_name = document.getElementById('claim-name').value.trim();
  const proof = document.getElementById('claim-proof').value.trim();
  const contact = document.getElementById('claim-contact').value.trim();
  
  if (!claimant_name || !proof) { showToast('Please fill in required fields'); return; }
  
  try {
    const res = await fetch('/api/claims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: currentModalId, claimant_name, proof, contact })
    });
    
    if (res.ok) {
      document.getElementById('claim-name').value = '';
      document.getElementById('claim-proof').value = '';
      document.getElementById('claim-contact').value = '';
      closeModal();
      showToast('✅ Claim submitted! Admin will review shortly.');
      loadMyClaims();
    } else {
      showToast('❌ Failed to submit claim.');
    }
  } catch (err) {
    console.error('Claim submit error:', err);
  }
}

// ── Report ─────────────────────────────────────────────────────────────────
async function submitReport() {
  const name     = document.getElementById('item-name').value.trim();
  const location = document.getElementById('item-location').value.trim();
  const date_reported = document.getElementById('item-date').value;
  
  if (!name || !location || !date_reported) { showToast('Please fill in required fields'); return; }
  
  const type     = document.querySelector('input[name="item-type"]:checked').value;
  const category = document.getElementById('item-category').value;
  const description = document.getElementById('item-desc').value;
  const contact  = document.getElementById('item-contact').value;
  
  try {
    const res = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type, category, date_reported, location, description, contact })
    });
    
    if (res.ok) {
      document.getElementById('item-name').value = '';
      document.getElementById('item-location').value = '';
      document.getElementById('item-date').value = new Date().toISOString().split('T')[0];
      document.getElementById('item-desc').value = '';
      document.getElementById('item-contact').value = '';
      document.getElementById('upload-preview').innerHTML = '';
      
      showToast('📋 Item reported successfully!');
      showPage('browse', document.querySelectorAll('.nav-links button')[1]);
      
      // Refresh data
      loadHomeItems();
      filterItems();
      loadMyPosts();
      loadStats();
    } else {
      showToast('❌ Failed to report item.');
    }
  } catch (err) {
    console.error('Report error:', err);
  }
}

// ── Navigation ─────────────────────────────────────────────────────────────
function showPage(id, btn, type) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  if (btn) {
    document.querySelectorAll('.nav-links button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  if (id === 'report' && type) {
    document.getElementById(type === 'lost' ? 'type-lost' : 'type-found').checked = true;
  }
  if (id === 'report') {
    document.getElementById('report-title').textContent =
      type === 'found' ? 'Report a Found Item' :
      type === 'lost'  ? 'Report a Lost Item'  : 'Report an Item';
  }
}

function switchTab(id, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  btn.classList.add('active');
}

// ── Upload (Visual only for now) ───────────────────────────────────────────
function triggerUpload() { document.getElementById('file-input').click(); }

function handleUpload(event) {
  const preview = document.getElementById('upload-preview');
  Array.from(event.target.files).forEach(file => {
    const thumb = document.createElement('div');
    thumb.className = 'preview-thumb';
    const ext = file.name.split('.').pop().toUpperCase();
    thumb.innerHTML = `<span style="font-size:0.7rem;color:var(--muted)">${ext}</span><div class="preview-remove" onclick="this.parentNode.remove()">✕</div>`;
    const reader = new FileReader();
    reader.onload = e => {
      thumb.style.backgroundImage = `url(${e.target.result})`;
      thumb.style.backgroundSize  = 'cover';
      thumb.querySelector('span').style.display = 'none';
    };
    reader.readAsDataURL(file);
    preview.appendChild(thumb);
  });
}

// ── Toast ──────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('item-modal').addEventListener('click', function (e) {
    if (e.target === this) closeModal();
  });

  document.getElementById('item-date').value = new Date().toISOString().split('T')[0];

  // Load Initial Data
  checkAuth();
  loadHomeItems();
  loadStats();
  filterItems();
  loadMyPosts();
  loadMyClaims();
});
