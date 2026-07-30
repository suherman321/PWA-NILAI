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
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyzdMJgP3qnc5uWmiw9Lm8pLWEweI8oLMzcOhZDIvYyHU8wf-caygBWjMwj90Kyyam2xg/exec"; 
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
  const dashboardAdmin = document.getElementById("admin-dashboard");

  // Reset tampilan awal dashboard
  if (dashboardSiswa) dashboardSiswa.classList.add("hidden");
  if (dashboardGuru) dashboardGuru.classList.add("hidden");
  if (dashboardAdmin) dashboardAdmin.classList.add("hidden");

  if (role === "SISWA") {
    if (dashboardSiswa) dashboardSiswa.classList.remove("hidden");

    const dataSiswa = masterSiswaGlobal.find(s => 
      String(s.ref_id) === String(user.ref_id) || 
      String(s.nisn) === String(user.username) || 
      String(s.ref_id) === String(user.username)
    );
    if (dataSiswa && dataSiswa.nama_siswa) {
      namaTampil = dataSiswa.nama_siswa;
    }
    
    const elemWelcome = document.getElementById("siswa-nama-welcome");
    if (elemWelcome) elemWelcome.innerText = namaTampil;

    tutupMenuSiswa();
    tampilkanRiwayatNilai();
  } else if (role === "ADMIN") {
    // Tampilan Khusus Admin
    if (dashboardAdmin) {
        dashboardAdmin.classList.remove("hidden");
    } else if (dashboardGuru) {
        // Fallback jika container khusus admin tidak ada di HTML, gunakan dashboard guru
        dashboardGuru.classList.remove("hidden");
    }

    namaTampil = user.nama || user.username || 'Administrator';

    const elemUserInfo = document.getElementById("user-info");
    const elemWelcomeAdmin = document.getElementById("admin-nama-welcome") || document.getElementById("guru-nama-welcome");
    if (elemUserInfo) elemUserInfo.innerText = `${namaTampil} (Admin)`;
    if (elemWelcomeAdmin) elemWelcomeAdmin.innerText = namaTampil;

    // --- TAMBAHAN UNTUK TAB ADMIN ---
    // 1. Set default tab yang aktif ke 'nilai' saat awal login
    switchAdminTab('nilai'); 
    
    // 2. Inisialisasi event listener klik untuk semua tombol menu admin
    initAdminTabListeners();
} else {
    // Role GURU
    if (dashboardGuru) dashboardGuru.classList.remove("hidden");
    
    namaTampil = user.nama || user.username || 'Guru';
    
    const elemUserInfo = document.getElementById("user-info");
    const elemWelcomeGuru = document.getElementById("guru-nama-welcome");
    if (elemUserInfo) elemUserInfo.innerText = namaTampil;
    if (elemWelcomeGuru) elemWelcomeGuru.innerText = namaTampil;

    tampilkanRiwayatNilai();
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
// 5. MASTER DATA & TAMPILAN KELAS (GURU / ADMIN)
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

        const subTitle = (role === "ADMIN") ? "Akses Kelas Admin" : "Kelas Binaan";

        card.innerHTML = `
          <div style="margin-bottom: 10px;">
            <div style="font-weight: 800; font-size: 14px; color: #0f172a;">Kelas ${kelas}</div>
            <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${subTitle}</div>
          </div>
          <button style="width: 100%; background: #2563eb; color: white; border: none; padding: 7px; border-radius: 8px; font-weight: 700; font-size: 11px; cursor: pointer;">
            Input / Kelola Nilai
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

  // 2. Render Dropdown Mapel (Guru & Admin)
  const selectMapel = document.getElementById("select-mapel");
  if (selectMapel && role !== "SISWA") {
    selectMapel.innerHTML = '<option value="">-- Pilih Mapel --</option>';

    // Admin mendapatkan akses ke seluruh mata pelajaran global
    let listMapelAkses = masterMapelGlobal;
    if (role === "GURU") {
      listMapelAkses = userSession.mapel 
        ? (Array.isArray(userSession.mapel) ? userSession.mapel : userSession.mapel.split(",")) 
        : masterMapelGlobal;
    }

    listMapelAkses.forEach(mapel => {
      const namaMapel = typeof mapel === "string" ? mapel.trim() : (mapel.nama_mapel || mapel.mapel || "").trim();
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
  
  document.getElementById("view-daftar-kelas").classList.add("hidden");
  document.getElementById("view-form-nilai").classList.remove("hidden");
  
  document.getElementById("judul-kelas-aktif").innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Input Nilai - Kelas ${kelas}`;
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
// 6. INPUT & SIMPAN NILAI (GURU & ADMIN)
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
    ref_id_guru: userSession.ref_id || userSession.username || "",
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

  let tbody = document.getElementById("tabel-riwayat-body");
  if (role === "SISWA") {
    const tbodySiswa = document.getElementById("tabel-riwayat-siswa-body");
    if (tbodySiswa) tbody = tbodySiswa;
  }

  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 15px; color: #64748b;"><i class="fa-solid fa-spinner fa-spin"></i> Memuat data nilai...</td></tr>';

  const masterData = JSON.parse(localStorage.getItem("master_data") || "{}");
  const listSiswaMaster = masterData.list_siswa || masterSiswaGlobal || [];
  const currentSiswa = listSiswaMaster.find(s => 
    String(s.ref_id) === String(userRefId) || 
    String(s.username) === String(userRefId) ||
    String(s.nisn) === String(userRefId)
  );

  let listNilai = [];

  // Fetch data dari Google Apps Script Server
  if (navigator.onLine) {
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "getNilai",
          role: role,
          ref_id_guru: role === "ADMIN" ? "" : userRefId, // Admin bisa tarik seluruh data
          ref_id_siswa: currentSiswa ? currentSiswa.ref_id : userRefId
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

  // Fallback: IndexedDB
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
          const targetRef = currentSiswa ? String(currentSiswa.ref_id).toLowerCase() : userRefId.toLowerCase();
          return itemRef === targetRef;
        });
      } else {
        listNilai = localData;
      }
    } catch (err) {
      console.error("Gagal membaca dari IndexedDB:", err);
    }
  }

  // Update Statistik Nilai Terinput (Guru & Admin)
  if (role !== "SISWA") {
    const statTotalNilai = document.getElementById("stat-total-nilai");
    if (statTotalNilai) {
      statTotalNilai.innerText = listNilai.length;
    }
  }

  // Filter jika memilih kelas tertentu
  if (role !== "SISWA" && kelasAktif) {
    listNilai = listNilai.filter(item => String(item.kelas || "").trim().toUpperCase() === String(kelasAktif).trim().toUpperCase());
  }

  if (!listNilai || listNilai.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 15px; color: #94a3b8;">Belum ada data nilai terinput</td></tr>';
    return;
  }

  tbody.innerHTML = "";
  listNilai.slice().reverse().forEach((item) => {
    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid #f1f5f9";

    const badgeStatus = item.synced !== false 
      ? `<span style="background: #dcfce7; color: #166534; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 12px;">Tersinkron</span>`
      : `<span style="background: #fef3c7; color: #92400e; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 12px;">Lokal</span>`;

    const namaSiswaTampil = item.nama_siswa || (currentSiswa ? currentSiswa.nama_siswa : item.ref_id_siswa);
    const mapelTampil = item.mapel || item.mata_pelajaran || "-";
    const jenisTampil = item.jenis_penilaian || item.jenis || "-";
    const nilaiTampil = item.nilai !== undefined ? item.nilai : "-";

    let kolomAksi = "-";
    // Role GURU dan ADMIN diizinkan mengedit/menghapus data nilai
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
  const dashboard = document.getElementById("siswa-dashboard");
  if (dashboard) dashboard.classList.add("hidden");

  const tabNilai = document.getElementById("view-tab-nilai");
  const tabKasus = document.getElementById("view-tab-kasus");
  const tabKehadiran = document.getElementById("view-tab-kehadiran");
  if (tabNilai) tabNilai.classList.add("hidden");
  if (tabKasus) tabKasus.classList.add("hidden");
  if (tabKehadiran) tabKehadiran.classList.add("hidden");

  const btnBackNilai = document.getElementById("btn-back-siswa-nilai");
  const btnBackKasus = document.getElementById("btn-back-siswa-kasus");
  const btnBackKehadiran = document.getElementById("btn-back-siswa-kehadiran");
  if (btnBackNilai) btnBackNilai.classList.remove("hidden");
  if (btnBackKasus) btnBackKasus.classList.remove("hidden");
  if (btnBackKehadiran) btnBackKehadiran.classList.remove("hidden");

  if (tabName === 'nilai') {
    if (tabNilai) tabNilai.classList.remove("hidden");
    muatHalamanNilaiSiswa();
  } else if (tabName === 'kasus') {
    if (tabKasus) tabKasus.classList.remove("hidden");
    if (typeof loadBukuKasusSiswa === "function") {
      loadBukuKasusSiswa();
    }
  } else if (tabName === 'kehadiran') {
    if (tabKehadiran) tabKehadiran.classList.remove("hidden");
    if (typeof loadKehadiranSiswa === "function") {
      loadKehadiranSiswa();
    }
  }
}

function tutupMenuSiswa() {
  const tabNilai = document.getElementById("view-tab-nilai");
  const tabKasus = document.getElementById("view-tab-kasus");
  const tabKehadiran = document.getElementById("view-tab-kehadiran");
  if (tabNilai) tabNilai.classList.add("hidden");
  if (tabKasus) tabKasus.classList.add("hidden");
  if (tabKehadiran) tabKehadiran.classList.add("hidden");

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
  const currentSiswa = listSiswa.find(s => 
    String(s.ref_id) === String(userSession.ref_id) || 
    String(s.nisn) === String(userSession.username)
  );
  
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

// ==========================================
// 10. LOGIKA INTERAKTIF KARTU MAPEL SISWA
// ==========================================
let rawDataNilaiSiswa = [];

function muatHalamanNilaiSiswa() {
  const containerMapel = document.getElementById("container-level-mapel");
  const containerRincian = document.getElementById("container-level-rincian");
  
  if (containerMapel) containerMapel.classList.remove("hidden");
  if (containerRincian) containerRincian.classList.add("hidden");

  const userSession = JSON.parse(localStorage.getItem("user_session") || "{}");
  const userRefId = String(userSession.ref_id || userSession.username || "").trim();

  const gridContainer = document.getElementById("grid-kartu-mapel");
  if (!gridContainer) return;
  
  gridContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 20px; color: #64748b;"><i class="fa-solid fa-spinner fa-spin"></i> Memuat daftar mata pelajaran...</div>`;

  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "getNilai",
      role: "SISWA",
      ref_id_siswa: userRefId
    })
  })
  .then(res => res.json())
  .then(res => {
    if (res.success && Array.isArray(res.data)) {
      rawDataNilaiSiswa = res.data;
      renderKartuMapel(res.data);
    } else {
      gridContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #ef4444;">Gagal memuat data nilai.</div>`;
    }
  })
  .catch(err => {
    console.error("Error getNilai siswa:", err);
    gridContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #ef4444;">Terjadi kesalahan koneksi.</div>`;
  });
}

function renderKartuMapel(dataNilai) {
  const gridContainer = document.getElementById("grid-kartu-mapel");
  if (!gridContainer) return;
  gridContainer.innerHTML = "";

  const mapelAdaNilai = new Set();
  dataNilai.forEach(item => {
    if (item.mapel && item.nilai !== null && item.nilai !== undefined && item.nilai !== "") {
      mapelAdaNilai.add(item.mapel.trim());
    }
  });

  if (mapelAdaNilai.size === 0) {
    gridContainer.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 30px; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1; color: #64748b;">
        <i class="fa-solid fa-folder-open" style="font-size: 24px; margin-bottom: 8px; color: #94a3b8;"></i><br>
        Belum ada nilai mata pelajaran yang diinput oleh guru.
      </div>`;
    return;
  }

  mapelAdaNilai.forEach(namaMapel => {
    const jumlahNilai = dataNilai.filter(d => d.mapel && d.mapel.trim() === namaMapel).length;

    const card = document.createElement("div");
    card.style.cssText = `
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    `;

    card.onmouseover = () => {
      card.style.borderColor = "#2563eb";
      card.style.transform = "translateY(-2px)";
      card.style.boxShadow = "0 4px 12px rgba(37, 99, 235, 0.15)";
    };
    card.onmouseout = () => {
      card.style.borderColor = "#e2e8f0";
      card.style.transform = "translateY(0)";
      card.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";
    };

    card.onclick = () => bukaRincianNilaiMapel(namaMapel);

    card.innerHTML = `
      <div>
        <div style="width: 32px; height: 32px; border-radius: 6px; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; margin-bottom: 8px; font-size: 14px;">
          <i class="fa-solid fa-book-bookmark"></i>
        </div>
        <h5 style="margin: 0 0 4px 0; font-size: 13px; font-weight: 700; color: #1e293b;">${namaMapel}</h5>
      </div>
      <div style="font-size: 11px; color: #64748b; margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
        <span>${jumlahNilai} Nilai</span>
        <i class="fa-solid fa-chevron-right" style="font-size: 10px; color: #94a3b8;"></i>
      </div>
    `;

    gridContainer.appendChild(card);
  });
}

function bukaRincianNilaiMapel(namaMapel) {
  const containerMapel = document.getElementById("container-level-mapel");
  const containerRincian = document.getElementById("container-level-rincian");
  
  if (containerMapel) containerMapel.classList.add("hidden");
  if (containerRincian) containerRincian.classList.remove("hidden");

  const elemJudul = document.getElementById("judul-mapel-terpilih");
  const elemBadge = document.getElementById("badge-mapel-terpilih");
  
  if (elemJudul) elemJudul.innerText = namaMapel;
  if (elemBadge) elemBadge.innerText = namaMapel;

  const tbody = document.getElementById("tabel-riwayat-siswa-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  const listDetail = rawDataNilaiSiswa.filter(item => item.mapel && item.mapel.trim() === namaMapel);

  if (listDetail.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#64748b;">Tidak ada rincian nilai untuk mata pelajaran ini.</td></tr>`;
    return;
  }

  listDetail.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.nama_siswa || "-"}</td>
      <td><strong>${row.mapel || "-"}</strong></td>
      <td>${row.jenis_penilaian || "-"}</td>
      <td><strong style="color: #2563eb;">${row.nilai !== undefined ? row.nilai : "-"}</strong></td>
      <td><span style="background:#dcfce7; color:#166534; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:600;">Tersinkron</span></td>
      <td style="text-align:center;">
        <span style="color:#94a3b8; font-size:11px;">Hanya Lihat</span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function kembaliKeDaftarMapel() {
  const containerMapel = document.getElementById("container-level-mapel");
  const containerRincian = document.getElementById("container-level-rincian");
  
  if (containerRincian) containerRincian.classList.add("hidden");
  if (containerMapel) containerMapel.classList.remove("hidden");
}

// ==========================================
// 11. LOGIKA INTERAKTIF KARTU KEHADIRAN SISWA
// ==========================================
let rawDataKehadiranSiswa = [];

async function loadKehadiranSiswa() {
  const containerMapel = document.getElementById("container-kehadiran-level-mapel");
  const containerRincian = document.getElementById("container-kehadiran-level-rincian");
  
  if (containerMapel) containerMapel.classList.remove("hidden");
  if (containerRincian) containerRincian.classList.add("hidden");

  const gridContainer = document.getElementById("grid-kartu-kehadiran-mapel");
  if (!gridContainer) return;

  const userSession = JSON.parse(localStorage.getItem("user_session") || "{}");
  const nisnSiswa = userSession.username || userSession.nisn || userSession.ref_id_siswa;

  if (!nisnSiswa) {
    gridContainer.innerHTML = '<div style="grid-column: 1/-1; text-align:center; color:red;">Gagal mengidentifikasi data siswa. Silakan login ulang.</div>';
    return;
  }

  gridContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 20px; color: #64748b;"><i class="fa-solid fa-spinner fa-spin"></i> Memuat daftar presensi mapel...</div>`;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "getKehadiran",
        ref_id_siswa: nisnSiswa
      })
    });

    const result = await response.json();

    if (result.success) {
      rawDataKehadiranSiswa = result.data || [];
      renderKartuMapelKehadiran(rawDataKehadiranSiswa);
    } else {
      gridContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #ef4444;">Gagal: ${result.message}</div>`;
    }
  } catch (err) {
    gridContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #ef4444;">Terjadi kesalahan koneksi.</div>';
    console.error("Error loadKehadiranSiswa:", err);
  }
}

function renderKartuMapelKehadiran(dataKehadiran) {
  const gridContainer = document.getElementById("grid-kartu-kehadiran-mapel");
  if (!gridContainer) return;
  gridContainer.innerHTML = "";

  const mapelAdaPresensi = new Set();
  dataKehadiran.forEach(item => {
    if (item.mapel) {
      mapelAdaPresensi.add(item.mapel.trim());
    }
  });

  if (mapelAdaPresensi.size === 0) {
    gridContainer.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 30px; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1; color: #64748b;">
        <i class="fa-solid fa-clipboard-user" style="font-size: 24px; margin-bottom: 8px; color: #94a3b8;"></i><br>
        Belum ada catatan presensi pada mata pelajaran manapun.
      </div>`;
    return;
  }

  mapelAdaPresensi.forEach(namaMapel => {
    const totalAbsenMapel = dataKehadiran.filter(d => d.mapel && d.mapel.trim() === namaMapel).length;

    const card = document.createElement("div");
    card.style.cssText = `
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    `;

    card.onmouseover = () => {
      card.style.borderColor = "#16a34a";
      card.style.transform = "translateY(-2px)";
      card.style.boxShadow = "0 4px 12px rgba(22, 163, 74, 0.15)";
    };
    card.onmouseout = () => {
      card.style.borderColor = "#e2e8f0";
      card.style.transform = "translateY(0)";
      card.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";
    };

    card.onclick = () => bukaRincianKehadiranMapel(namaMapel);

    card.innerHTML = `
      <div>
        <div style="width: 32px; height: 32px; border-radius: 6px; background: #f0fdf4; color: #16a34a; display: flex; align-items: center; justify-content: center; margin-bottom: 8px; font-size: 14px;">
          <i class="fa-solid fa-calendar-check"></i>
        </div>
        <h5 style="margin: 0 0 4px 0; font-size: 13px; font-weight: 700; color: #1e293b;">${namaMapel}</h5>
      </div>
      <div style="font-size: 11px; color: #64748b; margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
        <span>${totalAbsenMapel} Catatan</span>
        <i class="fa-solid fa-chevron-right" style="font-size: 10px; color: #94a3b8;"></i>
      </div>
    `;

    gridContainer.appendChild(card);
  });
}

function bukaRincianKehadiranMapel(namaMapel) {
  const containerMapel = document.getElementById("container-kehadiran-level-mapel");
  const containerRincian = document.getElementById("container-kehadiran-level-rincian");
  
  if (containerMapel) containerMapel.classList.add("hidden");
  if (containerRincian) containerRincian.classList.remove("hidden");

  document.getElementById("judul-mapel-kehadiran-terpilih").innerText = namaMapel;
  document.getElementById("badge-mapel-kehadiran-terpilih").innerText = namaMapel;

  const tbody = document.getElementById("tabel-kehadiran-body");
  if (!tbody) return;

  const listFiltered = rawDataKehadiranSiswa.filter(item => item.mapel && item.mapel.trim() === namaMapel);

  let stat = { hadir: 0, izin: 0, sakit: 0, alpa: 0 };
  listFiltered.forEach(item => {
    const ket = (item.keterangan || "").toLowerCase();
    if (ket === "hadir") stat.hadir++;
    else if (ket === "izin") stat.izin++;
    else if (ket === "sakit") stat.sakit++;
    else if (ket === "alpa" || ket === "alpha") stat.alpa++;
  });

  document.getElementById("stat-hadir").textContent = stat.hadir;
  document.getElementById("stat-izin").textContent = stat.izin;
  document.getElementById("stat-sakit").textContent = stat.sakit;
  document.getElementById("stat-alpa").textContent = stat.alpa;

  if (listFiltered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Belum ada catatan presensi.</td></tr>';
  } else {
    let htmlRows = "";
    listFiltered.forEach(item => {
      let color = "#64748b";
      const ket = (item.keterangan || "").toLowerCase();
      if (ket === "hadir") color = "#16a34a";
      else if (ket === "izin") color = "#2563eb";
      else if (ket === "sakit") color = "#ca8a04";
      else if (ket === "alpa" || ket === "alpha") color = "#dc2626";

      let tglFormatted = item.tanggal;
      if (item.tanggal && item.tanggal.includes("GMT")) {
        try {
          tglFormatted = new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch(e){}
      }

      let waktuFormatted = item.waktu;
      if (item.waktu && item.waktu.includes("GMT")) {
        try {
          waktuFormatted = new Date(item.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        } catch(e){}
      }

      htmlRows += `<tr>
        <td>${tglFormatted}</td>
        <td>${waktuFormatted}</td>
        <td><span style="color: ${color}; font-weight: bold;">${item.keterangan}</span></td>
      </tr>`;
    });
    tbody.innerHTML = htmlRows;
  }
}

function kembaliKeDaftarMapelKehadiran() {
  const containerMapel = document.getElementById("container-kehadiran-level-mapel");
  const containerRincian = document.getElementById("container-kehadiran-level-rincian");
  
  if (containerRincian) containerRincian.classList.add("hidden");
  if (containerMapel) containerMapel.classList.remove("hidden");
}
function switchAdminTab(tabName) {
    const views = {
        nilai: document.getElementById("admin-view-nilai"),
        absen: document.getElementById("admin-view-absen"),
        kasus: document.getElementById("admin-view-kasus"),
        user:  document.getElementById("admin-view-user")
    };

    // Reset status tombol
    document.querySelectorAll("[data-admin-tab]").forEach(btn => {
        btn.classList.remove("active");
        btn.style.backgroundColor = "#ffffff";
        btn.style.color = "#334155";
    });

    // Sembunyikan semua tab
    Object.values(views).forEach(view => {
        if (view) view.classList.add("hidden");
    });

    // Tampilkan tab aktif
    if (views[tabName]) {
        views[tabName].classList.remove("hidden");
    }

    // Sorot tombol aktif
    const activeBtn = document.querySelector(`[data-admin-tab="${tabName}"]`);
    if (activeBtn) {
        activeBtn.classList.add("active");
        activeBtn.style.backgroundColor = "#2563eb";
        activeBtn.style.color = "#ffffff";
    }

    // Panggil pemuat data sesuai tab yang dipilih
    if (tabName === 'nilai') tampilkanNilaiAdmin();
    if (tabName === 'absen') tampilkanAbsenAdmin();
    if (tabName === 'kasus') tampilkanKasusAdmin();
    if (tabName === 'user')  tampilkanUserAdmin();
}


function initAdminTabListeners() {
    document.querySelectorAll("[data-admin-tab]").forEach(button => {
        button.addEventListener("click", () => {
            const target = button.getAttribute("data-admin-tab");
            switchAdminTab(target);
        });
    });
}
// 1. MONITORING NILAI
function tampilkanNilaiAdmin() {
  const container = document.getElementById("tbl-nilai-body") || document.querySelector("#admin-view-nilai tbody");
  if (!container) return;

  container.innerHTML = `<tr><td colspan="6" style="text-align:center;">Memuat data nilai...</td></tr>`;

  fetch(`${SCRIPT_URL}?action=getNilai`)
    .then(res => res.json())
    .then(dataNilai => {
      if (!dataNilai || dataNilai.length === 0) {
        container.innerHTML = `<tr><td colspan="6" style="text-align:center;">Belum ada data nilai.</td></tr>`;
        return;
      }
      let html = "";
      dataNilai.forEach((item) => {
        html += `
          <tr>
            <td>${item.kelas}</td>
            <td>${item.namaSiswa}</td>
            <td>${item.mapel}</td>
            <td>${item.jenis}</td>
            <td><b>${item.nilai}</b></td>
            <td>
              <button class="btn-edit" onclick="handleEditNilai(${item.id})">Edit</button>
              <button class="btn-delete" onclick="handleHapusNilai(${item.id})">Hapus</button>
            </td>
          </tr>`;
      });
      container.innerHTML = html;
    })
    .catch(err => {
      container.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Gagal memuat data: ${err.message}</td></tr>`;
    });
}

// 2. MONITORING ABSEN
function tampilkanAbsenAdmin() {
  const container = document.getElementById("tbl-absen-body") || document.querySelector("#admin-view-absen tbody");
  if (!container) return;

  container.innerHTML = `<tr><td colspan="5" style="text-align:center;">Memuat data absen...</td></tr>`;

  fetch(`${SCRIPT_URL}?action=getAbsen`)
    .then(res => res.json())
    .then(data => {
      console.log("Response Absen:", data);

      // Proteksi: Pastikan data benar-benar Array
      if (!Array.isArray(data)) {
        container.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Format data server salah (Bukan Array).</td></tr>`;
        return;
      }

      if (data.length === 0) {
        container.innerHTML = `<tr><td colspan="5" style="text-align:center;">Belum ada data absen.</td></tr>`;
        return;
      }

      let html = "";
      data.forEach(item => {
        html += `<tr>
          <td>${item.mapel || '-'}</td>
          <td>${item.namaSiswa || '-'}</td>
          <td>${item.tanggal || '-'}</td>
          <td><b>${item.status || '-'}</b></td>
          <td>
            <button class="btn-edit" onclick="handleEditAbsen('${item.id}')">Edit</button>
            <button class="btn-delete" onclick="handleHapusAbsen('${item.id}')">Hapus</button>
          </td>
        </tr>`;
      });
      container.innerHTML = html;
    })
    .catch(err => {
      container.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Gagal memuat data: ${err.message}</td></tr>`;
    });
}

// 3. BUKU KASUS
function tampilkanKasusAdmin() {
  const container = document.getElementById("tbl-kasus-body") || document.querySelector("#admin-view-kasus tbody");
  if (!container) return;

  container.innerHTML = `<tr><td colspan="6" style="text-align:center;">Memuat data kasus...</td></tr>`;

  fetch(`${SCRIPT_URL}?action=getKasus`)
    .then(res => res.json())
    .then(data => {
      if (!Array.isArray(data) || data.length === 0) {
        container.innerHTML = `<tr><td colspan="6" style="text-align:center;">Belum ada catatan kasus.</td></tr>`;
        return;
      }
      let html = "";
      data.forEach(item => {
        html += `<tr>
          <td>${item.tanggal || '-'}</td>
          <td>${item.namaSiswa || '-'}</td>
          <td>${item.kasus || '-'}</td>
          <td>${item.penanganan || '-'}</td>
          <td>${item.guruPiket || '-'}</td>
          <td>
            <button class="btn-edit" onclick="handleEditKasus(${item.id})">Edit</button>
            <button class="btn-delete" onclick="handleHapusKasus(${item.id})">Hapus</button>
          </td>
        </tr>`;
      });
      container.innerHTML = html;
    })
    .catch(err => {
      container.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Gagal memuat data: ${err.message}</td></tr>`;
    });
}

// 4. MANAJEMEN USER
function tampilkanUserAdmin() {
  const container = document.getElementById("tbl-user-body") || document.querySelector("#admin-view-user tbody");
  if (!container) return;

  container.innerHTML = `<tr><td colspan="4" style="text-align:center;">Memuat data user...</td></tr>`;

  fetch(`${SCRIPT_URL}?action=getUser`)
    .then(res => res.json())
    .then(data => {
      if (!data || data.length === 0) {
        container.innerHTML = `<tr><td colspan="4" style="text-align:center;">Belum ada data user.</td></tr>`;
        return;
      }
      let html = "";
      data.forEach(item => {
        html += `<tr>
          <td>${item.username}</td>
          <td><b>${item.role}</b></td>
          <td>${item.refId}</td>
          <td>
            <button class="btn-edit" onclick="handleEditUser(${item.id})">Edit</button>
            <button class="btn-delete" onclick="handleHapusUser(${item.id})">Hapus</button>
          </td>
        </tr>`;
      });
      container.innerHTML = html;
    })
    .catch(err => {
      container.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">Gagal memuat data: ${err.message}</td></tr>`;
    });
}