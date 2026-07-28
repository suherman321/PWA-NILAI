// ==========================================
// 1. CONFIGURATION & GLOBAL VARIABLES
// ==========================================
// GANTI DENGAN URL APPS SCRIPT ANDA DI SINI
const API_URL = "https://script.google.com/macros/s/AKfycbyzdMJgP3qnc5uWmiw9Lm8pLWEweI8oLMzcOhZDIvYyHU8wf-caygBWjMwj90Kyyam2xg/exec"; 

const DB_NAME = "PWA_Nilai_DB";
const DB_VERSION = 1;

let masterSiswaGlobal = [];
let masterMapelGlobal = [];
let kelasAktif = ""; 

// ==========================================
// 2. DATABASE INDEXEDDB
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
// 3. INITIALIZATION (ON LOAD / REFRESH)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);
  updateOnlineStatus();

  const savedUser = localStorage.getItem("user_session");
  const savedMaster = localStorage.getItem("master_data");

  if (savedUser) {
    const user = JSON.parse(savedUser);
    
    // Harus memuat master data dulu sebelum menampilkan layar, agar nama siswa terbaca
    if (savedMaster) {
      const master = JSON.parse(savedMaster);
      renderMasterData(master.list_siswa, master.list_mapel, master.list_kelas);
    }
    
    showAppScreen(user);
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
// 4. AUTHENTICATION (LOGIN & LOGOUT)
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
      const masterObj = {
        list_siswa: result.list_siswa || [],
        list_mapel: result.list_mapel || [],
        list_kelas: result.list_kelas || []
      };
      localStorage.setItem("master_data", JSON.stringify(masterObj));

      // Urutan wajib: Render Master dulu, baru Tampilkan Layar
      renderMasterData(masterObj.list_siswa, masterObj.list_mapel, masterObj.list_kelas);
      showAppScreen(result.user);
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
  
  const role = String(user.role || "").toUpperCase();
  let namaTampil = user.username;

  const tabSiswaNav = document.getElementById("siswa-tab-nav");

  if (role === "SISWA") {
    // Tampilkan tombol navigasi tab jika login sebagai Siswa
    if (tabSiswaNav) tabSiswaNav.classList.remove("hidden");
    
    const dataSiswa = masterSiswaGlobal.find(s => String(s.ref_id) === String(user.ref_id));
    if (dataSiswa && dataSiswa.nama_siswa) {
      namaTampil = dataSiswa.nama_siswa;
    }
    // Default buka Tab Nilai
    switchSiswaTab('nilai');
  } else {
    // Sembunyikan navigasi tab jika login sebagai Guru
    if (tabSiswaNav) tabSiswaNav.classList.add("hidden");
    document.getElementById("view-tab-nilai").classList.remove("hidden");
    document.getElementById("view-tab-kasus").classList.add("hidden");
    
    namaTampil = user.nama || user.username || 'Guru';
  }

  document.getElementById("user-info").innerText = namaTampil;
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
// 5. MASTER DATA & TAMPILAN KELAS
// ==========================================
function renderMasterData(listSiswa, listMapel, listKelas) {
  masterSiswaGlobal = listSiswa || [];
  masterMapelGlobal = listMapel || [];

  const userSession = JSON.parse(localStorage.getItem("user_session") || "{}");
  const role = String(userSession.role || "").toUpperCase();

  const container = document.getElementById("container-kelas");
  
  if (container) {
    container.innerHTML = "";
    
    // LOGIKA ROLE: Jika Siswa, sembunyikan menu kelas
    if (role === "SISWA") {
      container.style.display = "none";
      if (container.previousElementSibling) {
        container.previousElementSibling.style.display = "none"; // Sembunyikan tulisan "Pilih Kelas Binaan"
      }
    } 
    // LOGIKA ROLE: Jika Guru, tampilkan menu kelas
    else {
      container.style.display = ""; 
      if (container.previousElementSibling) {
        container.previousElementSibling.style.display = "";
      }

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
  }

  const selectMapel = document.getElementById("select-mapel");
  if (selectMapel && role !== "SISWA") {
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
  kelasAktif = kelas;
  document.getElementById("view-daftar-kelas").classList.add("hidden");
  document.getElementById("view-form-nilai").classList.remove("hidden");
  document.getElementById("judul-kelas-aktif").textContent = `Input Nilai - Kelas ${kelas}`;
  
  const elJudulRiwayat = document.getElementById("judul-riwayat");
  if (elJudulRiwayat) elJudulRiwayat.textContent = `Riwayat Nilai - Kelas ${kelas}`;

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

  tampilkanRiwayatNilai();
}

function kembaliKeDaftarKelas() {
  kelasAktif = "";
  document.getElementById("view-form-nilai").classList.add("hidden");
  document.getElementById("view-daftar-kelas").classList.remove("hidden");

  const elJudulRiwayat = document.getElementById("judul-riwayat");
  if (elJudulRiwayat) elJudulRiwayat.textContent = "Riwayat Nilai Terinput (Semua Kelas)";
  
  tampilkanRiwayatNilai();
}

// ==========================================
// 6. INPUT & SIMPAN NILAI 
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
    kelas: kelasAktif,
    synced: false,
    timestamp: new Date().toISOString()
  };

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

    if (navigator.onLine) {
      await syncData(true);
    } else {
      alert("Nilai disimpan secara Offline di HP.");
    }
  } catch (err) {
    console.error("Gagal menyimpan:", err);
    alert("Gagal menyimpan data nilai.");
  }
}

// ==========================================
// 7. TAMPILKAN RIWAYAT NILAI, EDIT & HAPUS
// ==========================================
async function tampilkanRiwayatNilai() {
  const tbody = document.getElementById("tabel-riwayat-body");
  if (!tbody) return;

  let listNilai = [];
  const userSession = JSON.parse(localStorage.getItem("user_session") || "{}");
  const role = String(userSession.role || "").toUpperCase();

  // 1. Ambil Data dari Google Sheets saat Online dengan filter kualifikasi pengguna
  if (navigator.onLine) {
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "getNilai",
          role: role,
          ref_id_guru: userSession.ref_id || "",
          ref_id_siswa: userSession.ref_id || ""
        })
      });
      const result = await response.json();
      if (result.success) {
        listNilai = result.data.map(item => ({ ...item, synced: true }));
      }
    } catch (err) {
      console.error("Gagal ambil dari server:", err);
    }
  } 
  
  // 2. Jika Offline / Ambil Server Kosong, Ambil dari IndexedDB
  if (listNilai.length === 0) {
    try {
      const db = await openDB();
      const localData = await new Promise((resolve, reject) => {
        const tx = db.transaction("nilai_offline", "readonly");
        const store = tx.objectStore("nilai_offline");
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      // Filter lokal berdasarkan Role
      if (role === "SISWA") {
        listNilai = localData.filter(item => String(item.ref_id_siswa) === String(userSession.ref_id));
      } else {
        listNilai = localData.filter(item => String(item.ref_id_guru) === String(userSession.ref_id));
      }
    } catch (err) {
      console.error("Gagal membaca lokal:", err);
    }
  }

  // 3. Filter Tambahan Kelas Aktif khusus Guru (jika sedang memilih kelas tertentu)
  if (role !== "SISWA" && kelasAktif !== "") {
    listNilai = listNilai.filter(item => {
      if (item.kelas) {
        return String(item.kelas).trim().toUpperCase() === kelasAktif.trim().toUpperCase();
      }
      const siswa = masterSiswaGlobal.find(s => String(s.ref_id) === String(item.ref_id_siswa));
      return siswa && String(siswa.kelas).trim().toUpperCase() === kelasAktif.trim().toUpperCase();
    });
  }

  if (!listNilai || listNilai.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Belum ada data nilai terinput</td></tr>';
    return;
  }

  // 4. Render ke Tabel
  tbody.innerHTML = "";
  listNilai.reverse().forEach(item => {
    const tr = document.createElement("tr");
    
    let btnAksi = "-";
    if (role !== "SISWA" && navigator.onLine && item.row_index) {
      btnAksi = `
        <button onclick="editNilai(${item.row_index}, '${item.nama_siswa}', ${item.nilai})" style="padding: 2px 6px; font-size: 11px; background: #ffc107; color: black; border: none; border-radius: 4px; cursor: pointer;">Edit</button>
        <button onclick="hapusNilai(${item.row_index}, '${item.nama_siswa}')" style="padding: 2px 6px; font-size: 11px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">Hapus</button>
      `;
    }

    tr.innerHTML = `
      <td>${item.nama_siswa || item.ref_id_siswa}</td>
      <td>${item.mapel}</td>
      <td>${item.jenis_penilaian}</td>
      <td><strong>${item.nilai}</strong></td>
      <td><span style="color: ${item.synced ? "green" : "orange"}; font-weight: bold;">${item.synced ? "Tersinkron" : "Lokal"}</span></td>
      <td>${btnAksi}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function editNilai(rowIndex, namaSiswa, nilaiLama) {
  const nilaiBaru = prompt(`Edit nilai untuk ${namaSiswa}:`, nilaiLama);
  if (nilaiBaru === null || nilaiBaru.trim() === "" || isNaN(nilaiBaru)) return;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "updateNilai",
        row_index: rowIndex,
        nilai: Number(nilaiBaru)
      })
    });
    const result = await response.json();
    if (result.success) {
      alert("Nilai berhasil diubah!");
      await tampilkanRiwayatNilai();
    } else {
      alert("Gagal mengedit nilai: " + result.message);
    }
  } catch (err) {
    alert("Terjadi kesalahan jaringan.");
  }
}

async function hapusNilai(rowIndex, namaSiswa) {
  if (!confirm(`Yakin ingin menghapus nilai untuk ${namaSiswa}?`)) return;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "deleteNilai",
        row_index: rowIndex
      })
    });
    const result = await response.json();
    if (result.success) {
      alert("Nilai berhasil dihapus!");
      await tampilkanRiwayatNilai();
    } else {
      alert("Gagal menghapus nilai: " + result.message);
    }
  } catch (err) {
    alert("Terjadi kesalahan jaringan.");
  }
}

// ==========================================
// 8. SINKRONISASI DATA KE GOOGLE SHEETS
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
// ==========================================
// 9. LOGIKA NAVIGASI TAB SISWA & FETCH BUKU KASUS
// ==========================================
function switchSiswaTab(tabName) {
  const btnNilai = document.getElementById("btn-tab-nilai");
  const btnKasus = document.getElementById("btn-tab-kasus");
  const viewNilai = document.getElementById("view-tab-nilai");
  const viewKasus = document.getElementById("view-tab-kasus");

  if (tabName === 'nilai') {
    viewNilai.classList.remove("hidden");
    viewKasus.classList.add("hidden");
    btnNilai.style.backgroundColor = "#007bff";
    btnKasus.style.backgroundColor = "#6c757d";
  } else if (tabName === 'kasus') {
    viewNilai.classList.add("hidden");
    viewKasus.classList.remove("hidden");
    btnNilai.style.backgroundColor = "#6c757d";
    btnKasus.style.backgroundColor = "#007bff";
    
    // Muat data buku kasus dari server Apps Script
    loadBukuKasusSiswa();
  }
}

async function loadBukuKasusSiswa() {
  const tbody = document.getElementById("tabel-kasus-body");
  const loading = document.getElementById("loading-kasus");
  if (!tbody) return;

  const userSession = JSON.parse(localStorage.getItem("user_session") || "{}");
  const masterData = JSON.parse(localStorage.getItem("master_data") || "{}");
  
  // Cari NISN siswa berdasarkan ref_id login
  const listSiswa = masterData.list_siswa || [];
  const currentSiswa = listSiswa.find(s => String(s.ref_id) === String(userSession.ref_id));
  
  if (!currentSiswa || !currentSiswa.nisn) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">NISN tidak ditemukan.</td></tr>';
    return;
  }

  if (loading) loading.style.display = "block";
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Memuat data...</td></tr>';

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "getBukuKasus",
        nisn: currentSiswa.nisn
      })
    });

    const result = await response.json();
    if (loading) loading.style.display = "none";

    if (result.success && result.data && result.data.length > 0) {
      tbody.innerHTML = "";
      result.data.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><strong>${item.hari}</strong>, ${item.tanggal}<br><small color="#666">${item.waktu}</small></td>
          <td style="color: #dc3545; font-weight: bold;">${item.kasus}</td>
          <td>${item.tindak_lanjut}</td>
          <td>${item.guru_piket}</td>
        `;
        tbody.appendChild(tr);
      });
    } else {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: green; font-weight: bold;">Tidak ada catatan pelanggaran/kasus. 🎉</td></tr>';
    }
  } catch (err) {
    console.error("Gagal memuat buku kasus:", err);
    if (loading) loading.style.display = "none";
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: red;">Gagal terhubung ke server.</td></tr>';
  }
}