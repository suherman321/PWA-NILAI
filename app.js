// ==========================================
// CONFIGURATION
// ==========================================
// GANTI DENGAN URL WEB APP GOOGLE APPS SCRIPT ANDA
const API_URL = "https://script.google.com/macros/s/AKfycbyzdMJgP3qnc5uWmiw9Lm8pLWEweI8oLMzcOhZDIvYyHU8wf-caygBWjMwj90Kyyam2xg/exec"; 

// Database IndexedDB local storage name
const DB_NAME = "PWA_Nilai_DB";
const DB_VERSION = 1;

// ==========================================
// 1. DATABASE & INITIALIZATION
// ==========================================
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("nilai_offline")) {
        db.createObjectStore("nilai_offline", { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  // Cek status koneksi internet
  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);
  updateOnlineStatus();

  // Load session jika sudah pernah login sebelumnya
  const savedUser = localStorage.getItem("user_session");
  if (savedUser) {
    const user = JSON.parse(savedUser);
    showAppScreen(user);
  }
});

function updateOnlineStatus() {
  const badge = document.getElementById("status-koneksi");
  if (!badge) return;
  if (navigator.onLine) {
    badge.textContent = "Online";
    badge.className = "badge online";
  } else {
    badge.textContent = "Offline";
    badge.className = "badge offline";
  }
}

// ==========================================
// 2. AUTHENTICATION (LOGIN & LOGOUT)
// ==========================================
async function prosesLogin() {
  const usernameInput = document.getElementById("login-username").value.trim();
  const passwordInput = document.getElementById("login-password").value.trim();

  if (!usernameInput || !passwordInput) {
    alert("Username dan Password wajib diisi!");
    return;
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "login",
        username: usernameInput,
        password: passwordInput
      })
    });

    const result = await response.json();

    if (result.success) {
      alert("Login berhasil!");
      localStorage.setItem("user_session", JSON.stringify(result.user));
      showAppScreen(result.user);
      renderMasterData(result.list_siswa, result.list_mapel);
    } else {
      alert("Login gagal: " + result.message);
    }
  } catch (error) {
    console.error("Error login:", error);
    alert("Gagal terhubung ke server. Pastikan API_URL benar dan koneksi internet stabil.");
  }
}

function showAppScreen(user) {
  document.getElementById("section-login").classList.add("hidden");
  document.getElementById("section-app").classList.remove("hidden");
  document.getElementById("user-info").innerText = `Login sebagai: ${user.username || user.nama || 'User'}`;
  tampilkanRiwayatNilai();
  updateSyncCount();
}

function logout() {
  localStorage.removeItem("user_session");
  document.getElementById("section-app").classList.add("hidden");
  document.getElementById("section-login").classList.remove("hidden");
  document.getElementById("login-username").value = "";
  document.getElementById("login-password").value = "";
}

// ==========================================
// 3. MASTER DATA & RENDER DROPDOWN
// ==========================================
function renderMasterData(listSiswa, listMapel) {
  const selectSiswa = document.getElementById("select-siswa");
  const selectMapel = document.getElementById("select-mapel");

  if (listSiswa && listSiswa.length > 0) {
    selectSiswa.innerHTML = '<option value="">-- Pilih Siswa --</option>';
    listSiswa.forEach(siswa => {
      const opt = document.createElement("option");
      opt.value = siswa.ref_id || siswa.id;
      opt.textContent = `${siswa.nama_siswa} (${siswa.kelas})`;
      opt.dataset.nama = siswa.nama_siswa;
      selectSiswa.appendChild(opt);
    });
  }

  if (listMapel && listMapel.length > 0) {
    selectMapel.innerHTML = '<option value="">-- Pilih Mapel --</option>';
    listMapel.forEach(mapel => {
      const opt = document.createElement("option");
      opt.value = mapel;
      opt.textContent = mapel;
      selectMapel.appendChild(opt);
    });
  }
}

// ==========================================
// 4. SIMPAN NILAI & RIWAYAT (OFFLINE-FIRST)
// ==========================================
async function simpanNilai() {
  const selectSiswa = document.getElementById("select-siswa");
  const selectMapel = document.getElementById("select-mapel");
  const selectJenis = document.getElementById("select-jenis");
  const inputNilai = document.getElementById("input-nilai");

  const idSiswa = selectSiswa.value;
  const namaSiswa = selectSiswa.options[selectSiswa.selectedIndex]?.dataset.nama || selectSiswa.options[selectSiswa.selectedIndex]?.text;
  const mapel = selectMapel.value;
  const jenis = selectJenis.value;
  const nilai = inputNilai.value;

  if (!idSiswa || !mapel || !jenis || nilai === "") {
    alert("Harap lengkapi semua isian data nilai!");
    return;
  }

  const dataNilai = {
    ref_id_siswa: idSiswa,
    nama_siswa: namaSiswa,
    mapel: mapel,
    jenis_penilaian: jenis,
    nilai: Number(nilai),
    synced: false,
    timestamp: new Date().toISOString()
  };

  const db = await openDB();
  const tx = db.transaction("nilai_offline", "readwrite");
  await tx.objectStore("nilai_offline").add(dataNilai);

  inputNilai.value = "";
  alert("Nilai berhasil disimpan di penyimpanan lokal!");
  
  tampilkanRiwayatNilai();
  updateSyncCount();

  if (navigator.onLine) {
    syncData();
  }
}

async function tampilkanRiwayatNilai() {
  const tbody = document.getElementById("tabel-riwayat-body");
  if (!tbody) return;

  const db = await openDB();
  const tx = db.transaction("nilai_offline", "readonly");
  const store = tx.objectStore("nilai_offline");
  const listNilai = await store.getAll();

  if (listNilai.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Belum ada data tersimpan di HP/Lokal</td></tr>';
    return;
  }

  tbody.innerHTML = "";
  listNilai.reverse().forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.nama_siswa || item.ref_id_siswa}</td>
      <td>${item.mapel}</td>
      <td>${item.jenis_penilaian}</td>
      <td><strong>${item.nilai}</strong></td>
      <td><span style="color: ${item.synced ? "green" : "orange"}; font-weight: bold;">${item.synced ? "Tersinkron" : "Lokal (Offline)"}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// ==========================================
// 5. SINKRONISASI DATA TO GOOGLE SHEETS
// ==========================================
async function updateSyncCount() {
  const syncCountEl = document.getElementById("sync-count");
  if (!syncCountEl) return;

  const db = await openDB();
  const tx = db.transaction("nilai_offline", "readonly");
  const list = await tx.objectStore("nilai_offline").getAll();
  const unsynced = list.filter(item => !item.synced);

  syncCountEl.textContent = unsynced.length;
}

async function syncData() {
  if (!navigator.onLine) {
    alert("Perangkat Anda sedang Offline. Hubungkan ke internet untuk melakukan sinkronisasi.");
    return;
  }

  const db = await openDB();
  const tx = db.transaction("nilai_offline", "readwrite");
  const store = tx.objectStore("nilai_offline");
  const list = await store.getAll();
  const unsynced = list.filter(item => !item.synced);

  if (unsynced.length === 0) {
    alert("Semua data sudah tersinkronisasi!");
    return;
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "simpanNilaiBulk",
        data: unsynced
      })
    });

    const result = await response.json();

    if (result.success) {
      const updateTx = db.transaction("nilai_offline", "readwrite");
      const updateStore = updateTx.objectStore("nilai_offline");
      
      for (const item of unsynced) {
        item.synced = true;
        await updateStore.put(item);
      }

      alert("Berhasil mengunggah data offline ke Google Sheets!");
      tampilkanRiwayatNilai();
      updateSyncCount();
    } else {
      alert("Gagal sinkronisasi: " + result.message);
    }
  } catch (err) {
    console.error("Sync error:", err);
    alert("Gagal melakukan sinkronisasi ke server.");
  }
}