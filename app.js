// ==========================================
// 0. HELPER UI & FORM INTERACTION
// ==========================================
function updateRoleText() {
  const roleSelect = document.getElementById("login-role");
  if (!roleSelect) return;
  const selectedRole = roleSelect.value;
  
  const lblRole = document.getElementById("lbl-role-dipilih");
  const btnLoginText = document.getElementById("btn-login-text");
  
  if (lblRole) lblRole.innerText = selectedRole;
  if (btnLoginText) btnLoginText.innerText = `Masuk sebagai ${selectedRole}`;
}

function togglePasswordVisibility() {
  const passInput = document.getElementById("login-password");
  const icon = document.getElementById("toggle-password");
  if (!passInput || !icon) return;
  
  if (passInput.type === "password") {
    passInput.type = "text";
    icon.classList.remove("fa-eye-slash");
    icon.classList.add("fa-eye");
  } else {
    passInput.type = "password";
    icon.classList.remove("fa-eye");
    icon.classList.add("fa-eye-slash");
  }
}

// ==========================================
// 1. CONFIGURATION & GLOBAL VARIABLES
// ==========================================
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
// 3. INITIALIZATION (ON LOAD)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);
  updateOnlineStatus();

  const savedUser = localStorage.getItem("user_session");
  const savedMaster = localStorage.getItem("master_data");

  if (savedUser) {
    const user = JSON.parse(savedUser);
    if (savedMaster) {
      const master = JSON.parse(savedMaster);
      renderMasterData(master.list_siswa, master.list_mapel, master.list_kelas);
    }
    showAppScreen(user);
  }
});

function updateOnlineStatus() {
  const badgeHeader = document.getElementById("status-koneksi");
  const badgeLogin = document.getElementById("status-koneksi-login");
  const isOnline = navigator.onLine;

  [badgeHeader, badgeLogin].forEach(badge => {
    if (!badge) return;
    if (isOnline) {
      badge.innerHTML = '<span class="dot"></span> Online';
      badge.style.color = "#10b981";
    } else {
      badge.innerHTML = '<span class="dot" style="background:#ef4444"></span> Offline';
      badge.style.color = "#ef4444";
    }
  });
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
      localStorage.setItem("user_session", JSON.stringify(result.user));
      const masterObj = {
        list_siswa: result.list_siswa || [],
        list_mapel: result.list_mapel || [],
        list_kelas: result.list_kelas || []
      };
      localStorage.setItem("master_data", JSON.stringify(masterObj));

      renderMasterData(masterObj.list_siswa, masterObj.list_mapel, masterObj.list_kelas);
      showAppScreen(result.user);
    } else {
      alert("Login gagal: " + result.message);
    }
  } catch (error) {
    console.error("Error login:", error);
    alert("Gagal terhubung ke server. Pastikan koneksi internet stabil.");
  }
}

function showAppScreen(user) {
  document.getElementById("section-login").classList.add("hidden");
  document.getElementById("section-app").classList.remove("hidden");
  
  const role = String(user.role || "").toUpperCase();
  let namaTampil = user.username;

  const dashboardSiswa = document.getElementById("siswa-dashboard");
  const dashboardGuru = document.getElementById("guru-dashboard");

  if (role === "SISWA") {
    if (dashboardSiswa) dashboardSiswa.classList.remove("hidden");
    if (dashboardGuru) dashboardGuru.classList.add("hidden");

    const dataSiswa = masterSiswaGlobal.find(s => String(s.ref_id) === String(user.ref_id));
    if (dataSiswa && dataSiswa.nama_siswa) {
      namaTampil = dataSiswa.nama_siswa;
    }
    
    const elemWelcome = document.getElementById("siswa-nama-welcome");
    if (elemWelcome) elemWelcome.innerText = namaTampil;

    tutupMenuSiswa();
  } else {
    if (dashboardSiswa) dashboardSiswa.classList.add("hidden");
    if (dashboardGuru) dashboardGuru.classList.remove("hidden");
    
    namaTampil = user.nama || user.username || 'Guru';
    
    // Set Nama Guru di Topbar & Welcome Banner
    const elemUserInfo = document.getElementById("user-info");
    const elemWelcomeGuru = document.getElementById("guru-nama-welcome");
    if (elemUserInfo) elemUserInfo.innerText = namaTampil;
    if (elemWelcomeGuru) elemWelcomeGuru.innerText = namaTampil;
  }

  updateSyncCount();
}

function logout() {
  localStorage.removeItem("user_session");
  localStorage.removeItem("master_data");

  document.getElementById("section-app").classList.add("hidden");
  document.getElementById("section-login").classList.remove("hidden");

  if (document.getElementById("login-username")) document.getElementById("login-username").value = "";
  if (document.getElementById("login-password")) document.getElementById("login-password").value = "";

  const pesanEl = document.getElementById("pesan-logout");
  if (pesanEl) {
    pesanEl.classList.remove("hidden");
    setTimeout(() => {
      pesanEl.classList.add("hidden");
    }, 5000);
  }
}

// ==========================================
// 5. MASTER DATA & TAMPILAN KELAS GURU
// ==========================================
function renderMasterData(listSiswa, listMapel, listKelas) {
  masterSiswaGlobal = listSiswa || [];
  masterMapelGlobal = listMapel || [];

  const userSession = JSON.parse(localStorage.getItem("user_session") || "{}");
  const role = String(userSession.role || "").toUpperCase();

  // 1. Render Kartu Pilih Kelas
  const container = document.getElementById("container-kelas");
  const statTotalKelas = document.getElementById("stat-total-kelas");
  const badgeTotalKelas = document.getElementById("badge-total-kelas");

  if (container && role !== "SISWA") {
    const total = listKelas ? listKelas.length : 0;
    if (statTotalKelas) statTotalKelas.innerText = total;
    if (badgeTotalKelas) badgeTotalKelas.innerText = `${total} kelas`;

    container.innerHTML = "";
    if (listKelas && listKelas.length > 0) {
      listKelas.forEach(kelas => {
        const card = document.createElement("div");
        card.style.cssText = `
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 12px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: all 0.2s ease;
        `;

        card.innerHTML = `
          <div style="margin-bottom: 10px;">
            <div style="font-weight: 800; font-size: 14px; color: #0f172a;">Kelas ${kelas}</div>
            <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Kelas Binaan</div>
          </div>
          <button style="width: 100%; background: #2563eb; color: white; border: none; padding: 7px; border-radius: 8px; font-weight: 700; font-size: 11px; cursor: pointer;">
            Input Nilai
          </button>
        `;

        card.onmouseover = () => {
          card.style.borderColor = '#2563eb';
          card.style.transform = 'translateY(-2px)';
        };
        card.onmouseout = () => {
          card.style.borderColor = '#e2e8f0';
          card.style.transform = 'translateY(0)';
        };

        card.onclick = () => bukaFormInputNilai(kelas);
        container.appendChild(card);
      });
    } else {
      container.innerHTML = "<p style='grid-column: 1/-1; text-align: center; color: #94a3b8; padding: 15px;'>Tidak ada kelas binaan.</p>";
    }
  }

  // 2. Render Dropdown Mapel khusus Guru
  const selectMapel = document.getElementById("select-mapel");
  if (selectMapel && role !== "SISWA") {
    selectMapel.innerHTML = '<option value="">-- Pilih Mapel --</option>';
    let mapelGuru = userSession.mapel ? (Array.isArray(userSession.mapel) ? userSession.mapel : userSession.mapel.split(",")) : masterMapelGlobal;

    mapelGuru.forEach(mapel => {
      const namaMapel = mapel.trim();
      if (namaMapel) {
        const opt = document.createElement("option");
        opt.value = namaMapel;
        opt.textContent = namaMapel;
        selectMapel.appendChild(opt);
      }
    });
  }

  tampilkanRiwayatNilai();
}

function bukaFormInputNilai(kelas) {
  kelasAktif = kelas;
  
  // Sembunyikan daftar kelas, tampilkan form
  document.getElementById("view-daftar-kelas").classList.add("hidden");
  document.getElementById("view-form-nilai").classList.remove("hidden");
  
  // Ubah judul
  document.getElementById("judul-kelas-aktif").innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Input Nilai - Kelas ${kelas}`;
  const elJudulRiwayat = document.getElementById("judul-riwayat");
  if (elJudulRiwayat) elJudulRiwayat.textContent = `Riwayat Nilai - Kelas ${kelas}`;

  // Filter daftar siswa hanya untuk kelas ini
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

  // Tampilkan riwayat nilai yang terfilter khusus kelas ini
  tampilkanRiwayatNilai();
}

function kembaliKeDaftarKelas() {
  kelasAktif = ""; // Reset filter kelas
  document.getElementById("view-form-nilai").classList.add("hidden");
  document.getElementById("view-daftar-kelas").classList.remove("hidden");

  const elJudulRiwayat = document.getElementById("judul-riwayat");
  if (elJudulRiwayat) elJudulRiwayat.textContent = "Riwayat Nilai Terinput (Semua Kelas)";
  
  // Tampilkan kembali semua riwayat nilai
  tampilkanRiwayatNilai();
}

// ==========================================
// 6. INPUT & SIMPAN NILAI (GURU)
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
// 7. RIWAYAT NILAI, EDIT & HAPUS
// ==========================================
async function tampilkanRiwayatNilai() {
  const tbody = document.getElementById("tabel-riwayat-body");
  if (!tbody) return;

  // Set indikator memuat data
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 15px; color: #64748b;"><i class="fa-solid fa-spinner fa-spin"></i> Memuat data nilai...</td></tr>';

  // 1. Ambil session user & master data
  let rawSession = localStorage.getItem("user_session") || localStorage.getItem("user") || "{}";
  let userSession = {};
  try {
    userSession = JSON.parse(rawSession);
  } catch (e) {
    userSession = {};
  }

  if (userSession.user) userSession = userSession.user;

  const role = String(userSession.role || "").toUpperCase();
  const userRefId = String(userSession.ref_id || userSession.username || userSession.nis || "").trim();

  // Cari data siswa di master_data untuk fallback nama & pencarian
  const masterData = JSON.parse(localStorage.getItem("master_data") || "{}");
  const listSiswaMaster = masterData.list_siswa || masterSiswaGlobal || [];
  const currentSiswa = listSiswaMaster.find(s => String(s.ref_id) === String(userRefId) || String(s.username) === String(userRefId));

  let listNilai = [];

  // 2. Fetch data dari Google Apps Script Server
  if (navigator.onLine) {
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "getNilai",
          role: role,
          ref_id_guru: userRefId,
          ref_id_siswa: userRefId
        })
      });
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        listNilai = result.data.map(item => ({ ...item, synced: true }));
      }
    } catch (err) {
      console.error("Gagal mengambil data nilai dari server:", err);
    }
  }

  // 3. Fallback: Ambil dari IndexedDB lokal jika offline / server kosong
  if (listNilai.length === 0 && typeof openDB === "function") {
    try {
      const db = await openDB();
      const localData = await new Promise((resolve, reject) => {
        const tx = db.transaction("nilai_offline", "readonly");
        const store = tx.objectStore("nilai_offline");
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      if (role === "SISWA") {
        listNilai = localData.filter(item => {
          const itemRef = String(item.ref_id_siswa || item.nis || "").trim().toLowerCase();
          return itemRef === userRefId.toLowerCase();
        });
      } else {
        listNilai = localData;
      }
    } catch (err) {
      console.error("Gagal membaca dari IndexedDB:", err);
    }
  }

  // Filter khusus untuk Guru jika sedang memilih kelas tertentu
  if (role !== "SISWA" && kelasAktif) {
    listNilai = listNilai.filter(item => String(item.kelas || "").trim().toUpperCase() === String(kelasAktif).trim().toUpperCase());
  }

  // 4. Render Data ke Tabel
  if (!listNilai || listNilai.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 15px; color: #94a3b8;">Belum ada data nilai terinput</td></tr>';
    return;
  }

  tbody.innerHTML = "";
  listNilai.slice().reverse().forEach((item, index) => {
    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid #f1f5f9";

    const badgeStatus = item.synced !== false 
      ? `<span style="background: #dcfce7; color: #166534; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 12px;">Tersinkron</span>`
      : `<span style="background: #fef3c7; color: #92400e; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 12px;">Lokal</span>`;

    const namaSiswaTampil = item.nama_siswa || (currentSiswa ? currentSiswa.nama_siswa : item.ref_id_siswa);
    const mapelTampil = item.mapel || item.mata_pelajaran || "-";
    const jenisTampil = item.jenis_penilaian || item.jenis || "-";
    const nilaiTampil = item.nilai !== undefined ? item.nilai : "-";

    // Tombol Aksi (Edit/Hapus) khusus Guru
    let kolomAksi = "-";
    if (role !== "SISWA" && item.row_index) {
      kolomAksi = `
        <button onclick="editNilai(${item.row_index}, '${namaSiswaTampil}', ${nilaiTampil})" style="background:#3b82f6; color:white; border:none; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer; margin-right:4px;">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button onclick="hapusNilai(${item.row_index}, '${namaSiswaTampil}')" style="background:#ef4444; color:white; border:none; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer;">
          <i class="fa-solid fa-trash"></i>
        </button>
      `;
    }

    tr.innerHTML = `
      <td style="padding: 8px 4px; font-weight: 600;">${namaSiswaTampil}</td>
      <td style="padding: 8px 4px;">${mapelTampil}</td>
      <td style="padding: 8px 4px;">${jenisTampil}</td>
      <td style="padding: 8px 4px; font-weight: 800; color: #2563eb;">${nilaiTampil}</td>
      <td style="padding: 8px 4px;">${badgeStatus}</td>
      <td style="padding: 8px 4px; text-align: center;">${kolomAksi}</td>
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
// 9. LOGIKA NAVIGASI SISWA & FETCH BUKU KASUS
// ==========================================
function switchSiswaTab(tabName) {
  // Sembunyikan Dashboard Siswa
  const dashboard = document.getElementById("siswa-dashboard");
  if (dashboard) dashboard.classList.add("hidden");

  // Sembunyikan semua tab detail
  const viewNilai = document.getElementById("view-tab-nilai");
  const viewKasus = document.getElementById("view-tab-kasus");
  if (viewNilai) viewNilai.classList.add("hidden");
  if (viewKasus) viewKasus.classList.add("hidden");

  // Tampilkan tab yang dipilih & panggil datanya
  if (tabName === 'nilai') {
    if (viewNilai) viewNilai.classList.remove("hidden");
    const btnBack = document.getElementById("btn-back-siswa-nilai");
    if (btnBack) btnBack.classList.remove("hidden");
    
    // PANGGIL FUNGSI AMBIL DATA NILAI
    tampilkanRiwayatNilai();
  } else if (tabName === 'kasus') {
    if (viewKasus) viewKasus.classList.remove("hidden");
    const btnBack = document.getElementById("btn-back-siswa-kasus");
    if (btnBack) btnBack.classList.remove("hidden");
    
    // PANGGIL FUNGSI BUKU KASUS (jika ada)
    if (typeof tampilkanBukuKasus === "function") tampilkanBukuKasus();
  }
}

function tutupMenuSiswa() {
  const viewNilai = document.getElementById("view-tab-nilai");
  const viewKasus = document.getElementById("view-tab-kasus");
  if (viewNilai) viewNilai.classList.add("hidden");
  if (viewKasus) viewKasus.classList.add("hidden");

  const dashboard = document.getElementById("siswa-dashboard");
  if (dashboard) dashboard.classList.remove("hidden");
}

async function loadBukuKasusSiswa() {
  const tbody = document.getElementById("tabel-kasus-body");
  const loading = document.getElementById("loading-kasus");
  if (!tbody) return;

  const userSession = JSON.parse(localStorage.getItem("user_session") || "{}");
  const masterData = JSON.parse(localStorage.getItem("master_data") || "{}");
  
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
          <td><strong>${item.hari}</strong>, ${item.tanggal}<br><small style="color:#666">${item.waktu}</small></td>
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