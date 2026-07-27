// ==========================================
// CONFIGURATION & GLOBAL VARIABLES
// ==========================================
const API_URL = "https://script.google.com/macros/s/AKfycbyzdMJgP3qnc5uWmiw9Lm8pLWEweI8oLMzcOhZDIvYyHU8wf-caygBWjMwj90Kyyam2xg/exec"; 

const DB_NAME = "PWA_Nilai_DB";
const DB_VERSION = 1;

let masterSiswaGlobal = [];
let masterMapelGlobal = [];

// ==========================================
// 1. DATABASE INDEXEDDB
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

// ==========================================
// 2. INITIALIZATION (ON LOAD / REFRESH)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);
  updateOnlineStatus();

  // Load Sesi & Master Data dari LocalStorage jika ada (Agar tidak hilang saat refresh)
  const savedUser = localStorage.getItem("user_session");
  const savedMaster = localStorage.getItem("master_data");

  if (savedUser) {
    const user = JSON.parse(savedUser);
    showAppScreen(user);

    if (savedMaster) {
      const master = JSON.parse(savedMaster);
      renderMasterData(master.list_siswa, master.list_mapel, master.list_kelas);
    }
  }
});

function updateOnlineStatus() {
  const badge = document.getElementById("status-koneksi");
  if (!badge) return;
  if (navigator.onLine) {
    badge.textContent = "Online";
    badge.style.backgroundColor = "#28a745";
  } else {
    badge.textContent = "Offline";
    badge.style.backgroundColor = "#dc3545";
  }
}

// ==========================================
// 3. AUTHENTICATION (LOGIN & LOGOUT)
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
      
      // Simpan User & Master Data ke LocalStorage
      localStorage.setItem("user_session", JSON.stringify(result.user));
      const masterObj = {
        list_siswa: result.list_siswa || [],
        list_mapel: result.list_mapel || [],
        list_kelas: result.list_kelas || []
      };
      localStorage.setItem("master_data", JSON.stringify(masterObj));

      showAppScreen(result.user);
      renderMasterData(masterObj.list_siswa, masterObj.list_mapel, masterObj.list_kelas);
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
  document.getElementById("user-info").innerText = `${user.username || user.nama || 'Guru'}`;
  tampilkanRiwayatNilai();
  updateSyncCount();
}

function logout() {
  localStorage.removeItem("user_session");
  localStorage.removeItem("master_data");
  document.getElementById("section-app").classList.add("hidden");
  document.getElementById("section-login").classList.remove("hidden");
  document.getElementById("login-username").value = "";
  document.getElementById("login-password").value = "";
}

// ==========================================
// 4. MASTER DATA & TAMPILAN KELAS
// ==========================================
function renderMasterData(listSiswa, listMapel, listKelas) {
  masterSiswaGlobal = listSiswa || [];
  masterMapelGlobal = listMapel || [];

  // Render Kartu Kelas Binaan
  const container = document.getElementById("container-kelas");
  if (container) {
    container.innerHTML = "";
    if (listKelas && listKelas.length > 0) {
      listKelas.forEach(kelas => {
        const card = document.createElement("div");
        card.style = "background: #007bff; color: white; padding: 15px 10px; border-radius: 8px; text-align: center; cursor: pointer; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1);";
        card.innerHTML = `<div style="font-size: 16px;">Kelas ${kelas}</div><div style="font-size: 11px; opacity: 0.8; font-weight: normal; margin-top: 4px;">Klik untuk input</div>`;
        card.onclick = () => bukaFormInputNilai(kelas);
        container.appendChild(card);
      });
    } else {
      container.innerHTML = "<p style='grid-column: span 2;'>Tidak ada kelas binaan.</p>";
    }
  }

  // Pre-fill Dropdown Mapel Guru
  const selectMapel = document.getElementById("select-mapel");
  if (selectMapel) {
    selectMapel.innerHTML = '<option value="">-- Pilih Mapel --</option>';
    masterMapelGlobal.forEach(mapel => {
      const opt = document.createElement("option");
      opt.value = mapel;
      opt.textContent = mapel;
      selectMapel.appendChild(opt);
    });
  }

  tampilkanRiwayatNilai();
}

function bukaFormInputNilai(kelas) {
  document.getElementById("view-daftar-kelas").classList.add("hidden");
  document.getElementById("view-form-nilai").classList.remove("hidden");
  document.getElementById("judul-kelas-aktif").textContent = `Input Nilai - Kelas ${kelas}`;

  const siswaKelasIni = masterSiswaGlobal.filter(s => String(s.kelas).trim().toUpperCase() === String(kelas).trim().toUpperCase());

  const selectSiswa = document.getElementById("select-siswa");
  selectSiswa.innerHTML = '<option value="">-- Pilih Siswa --</option>';
  
  siswaKelasIni.forEach(siswa => {
    const opt = document.createElement("option");
    opt.value = siswa.ref_id;
    opt.textContent = `${siswa.nama_siswa} (${siswa.nisn})`;
    opt.dataset.nama = siswa.nama_siswa;
    selectSiswa.appendChild(opt);
  });
}

function kembaliKeDaftarKelas() {
  document.getElementById("view-form-nilai").classList.add("hidden");
  document.getElementById("view-daftar-kelas").classList.remove("hidden");
}

// ==========================================
// 5. INPUT & SIMPAN NILAI (FIXED)
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

  const userSession = JSON.parse(localStorage.getItem("user_session") || "{}");

  const dataNilai = {
    ref_id_siswa: idSiswa,
    nama_siswa: namaSiswa,
    mapel: mapel,
    jenis_penilaian: jenis,
    nilai: Number(nilai),
    ref_id_guru: userSession.ref_id || "",
    synced: false,
    timestamp: new Date().toISOString()
  };

  // Simpan ke IndexedDB dengan penanganan Promise yang benar
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("nilai_offline", "readwrite");
      const store = tx.objectStore("nilai_offline");
      const req = store.add(dataNilai);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    inputNilai.value = "";
    await tampilkanRiwayatNilai();
    await updateSyncCount();

    // Jika Online, langsung otomatis sinkronkan ke Google Sheets
    if (navigator.onLine) {
      await syncData(true); // true = silent/otomatis
    } else {
      alert("Nilai disimpan secara Offline di HP/Browser.");
    }
  } catch (err) {
    console.error("Gagal menyimpan ke IndexedDB:", err);
    alert("Gagal menyimpan data nilai.");
  }
}

async function tampilkanRiwayatNilai() {
  const tbody = document.getElementById("tabel-riwayat-body");
  if (!tbody) return;

  try {
    const db = await openDB();
    const listNilai = await new Promise((resolve, reject) => {
      const tx = db.transaction("nilai_offline", "readonly");
      const store = tx.objectStore("nilai_offline");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (!listNilai || listNilai.length === 0) {
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
  } catch (err) {
    console.error("Gagal mengambil riwayat nilai:", err);
  }
}

// ==========================================
// 6. SINKRONISASI DATA KE GOOGLE SHEETS
// ==========================================
async function updateSyncCount() {
  const syncCountEl = document.getElementById("sync-count");
  if (!syncCountEl) return;

  try {
    const db = await openDB();
    const list = await new Promise((resolve, reject) => {
      const tx = db.transaction("nilai_offline", "readonly");
      const store = tx.objectStore("nilai_offline");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    const unsynced = list.filter(item => !item.synced);
    syncCountEl.textContent = unsynced.length;
  } catch (err) {
    console.error("Error sync count:", err);
  }
}

async function syncData(isAuto = false) {
  if (!navigator.onLine) {
    if (!isAuto) alert("Perangkat Anda sedang Offline.");
    return;
  }

  const db = await openDB();
  const list = await new Promise((resolve, reject) => {
    const tx = db.transaction("nilai_offline", "readonly");
    const store = tx.objectStore("nilai_offline");
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const unsynced = list.filter(item => !item.synced);

  if (unsynced.length === 0) {
    if (!isAuto) alert("Semua data sudah tersinkronisasi!");
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
      // Tandai data sebagai 'synced: true'
      for (const item of unsynced) {
        item.synced = true;
        await new Promise((resolve) => {
          const txUpdate = db.transaction("nilai_offline", "readwrite");
          const storeUpdate = txUpdate.objectStore("nilai_offline");
          storeUpdate.put(item);
          txUpdate.oncomplete = () => resolve();
        });
      }

      if (!isAuto) alert("Berhasil mengunggah data ke Google Sheets!");
      await tampilkanRiwayatNilai();
      await updateSyncCount();
    } else {
      if (!isAuto) alert("Gagal sinkronisasi: " + result.message);
    }
  } catch (err) {
    console.error("Sync error:", err);
    if (!isAuto) alert("Gagal melakukan sinkronisasi ke server.");
  }
}