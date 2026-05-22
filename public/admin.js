// =====================
// FindIt — Lost & Found
// admin.js (Admin Dashboard Logic)
// =====================

const EMOJIS = { Electronics: '📱', Clothing: '👕', Accessories: '👜', Documents: '📄', Pets: '🐾', Other: '📦' };

// ── Check Admin Auth ───────────────────────────────────────────────────────
async function checkAdminAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      window.location.href = '/login.html';
      return;
    }
    const user = await res.json();
    if (user.role !== 'admin') {
      window.location.href = '/index.html'; // Redirect normal users
      return;
    }
    
    // Set UI
    document.querySelector('.avatar').textContent = user.first_name[0] + user.last_name[0];
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

// ── Load Stats ─────────────────────────────────────────────────────────────
async function loadAdminStats() {
  try {
    const res = await fetch('/api/stats');
    const stats = await res.json();
    document.getElementById('a-lost').textContent = stats.lost;
    document.getElementById('a-found').textContent = stats.found;
    document.getElementById('a-claims').textContent = stats.pending;
    document.getElementById('a-claimed').textContent = stats.claimed;
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// ── Load Pending Claims ────────────────────────────────────────────────────
async function loadAdminClaims() {
  try {
    const res = await fetch('/api/claims');
    const claims = await res.json();
    const tbody = document.getElementById('admin-claims-body');
    tbody.innerHTML = '';
    
    // Show pending claims
    const pendingClaims = claims.filter(c => c.status === 'pending');
    
    if (pendingClaims.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted)">No pending claims</td></tr>';
      return;
    }

    pendingClaims.forEach(c => {
      const d = new Date(c.created_at).toLocaleDateString();
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${c.item_name}</strong></td>
        <td>${c.claimant_name}</td>
        <td>
          <div style="font-size:0.82rem;color:var(--muted);max-width:250px">${c.proof}</div>
          <div style="font-size:0.75rem;color:var(--sti-blue);margin-top:4px">📞 ${c.contact}</div>
        </td>
        <td>${d}</td>
        <td>
          <div class="action-btns">
            <button class="btn-approve" onclick="approveClaim(${c.id})">Approve</button>
            <button class="btn-reject" onclick="rejectClaim(${c.id})">Reject</button>
          </div>
        </td>`;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error('Failed to load claims:', err);
  }
}

// ── Load All Items ─────────────────────────────────────────────────────────
async function loadAdminItems() {
  try {
    const res = await fetch('/api/items');
    const items = await res.json();
    document.getElementById('admin-items-grid').innerHTML = '';
    
    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'item-card';
      const statusClass = { lost: 'badge-lost', found: 'badge-found', claimed: 'badge-claimed' }[item.status];
      const d = new Date(item.date_reported).toLocaleDateString();

      div.innerHTML = `
        <div class="item-photo">
          ${EMOJIS[item.category] || '📦'}
          <span class="item-badge ${statusClass}">${item.status}</span>
        </div>
        <div class="item-body">
          <div class="item-title">${item.name}</div>
          <div class="item-meta">
            <span>📍 ${item.location}</span>
            <span>📅 ${d}</span>
          </div>
          <div class="item-footer">
            <span style="font-size:0.8rem;color:var(--muted)">By ${item.poster}</span>
            <button class="btn-sm ghost" style="color:var(--red)" onclick="deleteItem(${item.id})">Delete</button>
          </div>
        </div>`;
      document.getElementById('admin-items-grid').appendChild(div);
    });
  } catch (err) {
    console.error('Failed to load items:', err);
  }
}

// ── Actions ────────────────────────────────────────────────────────────────
async function approveClaim(id) {
  if(!confirm("Are you sure you want to approve this claim?")) return;
  try {
    const res = await fetch(`/api/claims/${id}/approve`, { method: 'PUT' });
    if (res.ok) {
      showToast('✅ Claim approved! Item marked as claimed.');
      refreshAll();
    } else {
      showToast('❌ Failed to approve claim.');
    }
  } catch (err) {
    console.error('Approve error:', err);
  }
}

async function rejectClaim(id) {
  if(!confirm("Are you sure you want to reject this claim?")) return;
  try {
    const res = await fetch(`/api/claims/${id}/reject`, { method: 'PUT' });
    if (res.ok) {
      showToast('❌ Claim rejected.');
      refreshAll();
    } else {
      showToast('❌ Failed to reject claim.');
    }
  } catch (err) {
    console.error('Reject error:', err);
  }
}

async function deleteItem(id) {
  if(!confirm("Are you sure you want to delete this item permanently?")) return;
  try {
    const res = await fetch(`/api/items/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('🗑️ Item deleted.');
      refreshAll();
    } else {
      showToast('❌ Failed to delete item.');
    }
  } catch (err) {
    console.error('Delete error:', err);
  }
}

// ── Utils ──────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function refreshAll() {
  loadAdminStats();
  loadAdminClaims();
  loadAdminItems();
}

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  checkAdminAuth();
  refreshAll();
});
