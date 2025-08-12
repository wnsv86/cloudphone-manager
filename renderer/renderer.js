const listEl = document.getElementById('list');
const openAllBtn = document.getElementById('openAll');
const tileBtn = document.getElementById('tile');
const addBtn = document.getElementById('add');

let entries = [];

async function refresh() {
  entries = await window.api.getEntries();
  renderList();
}

function renderList() {
  listEl.innerHTML = '';
  entries.forEach((e, idx) => {
    const div = document.createElement('div');
    div.className = 'entry';
    div.innerHTML = `
      <div class="row">
        <div class="title">${e.name || 'Unnamed'}</div>
        <div class="actions">
          <button data-idx="${idx}" class="open">Open</button>
          <button data-idx="${idx}" class="export">Export Cookies</button>
          <button data-idx="${idx}" class="delete">Delete</button>
        </div>
      </div>
      <div class="meta">${e.url}</div>
    `;
    listEl.appendChild(div);
  });
}

openAllBtn.addEventListener('click', async () => {
  await window.api.openAll();
});

tileBtn.addEventListener('click', async () => {
  await window.api.tileWindows();
});

addBtn.addEventListener('click', async () => {
  const name = prompt('Entry name', 'China Mobile CloudPhone');
  const url = prompt('H5 URL', 'https://cloud.139.com/');
  if (!url) return;
  entries.push({ id: Date.now().toString(), name, url, width: 360, height: 800 });
  await window.api.saveEntries(entries);
  refresh();
});

listEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const idx = Number(btn.getAttribute('data-idx'));
  if (btn.classList.contains('open')) {
    await window.api.openEntry(entries[idx]);
  } else if (btn.classList.contains('export')) {
    const fn = await window.api.exportCookies(entries[idx].id);
    alert(fn ? 'Exported: ' + fn : 'Export failed');
  } else if (btn.classList.contains('delete')) {
    if (confirm('Delete this entry?')) {
      entries.splice(idx, 1);
      await window.api.saveEntries(entries);
      refresh();
    }
  }
});

refresh();
