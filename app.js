// Fungsi mengisi Dropdown Siswa & Mapel setelah login
function renderMasterData(listSiswa, listMapel) {
  const selectSiswa = document.getElementById('select-siswa');
  const selectMapel = document.getElementById('select-mapel');

  // 1. Tampilkan Nama Siswa (bukan NISN)
  selectSiswa.innerHTML = '<option value="">-- Pilih Siswa --</option>';
  listSiswa.forEach(siswa => {
    const opt = document.createElement('option');
    opt.value = siswa.ref_id;
    // Menampilkan Nama Siswa dan Kelas
    opt.textContent = `${siswa.nama_siswa} (${siswa.kelas})`;
    selectSiswa.appendChild(opt);
  });

  // 2. Tampilkan Dropdown Mapel
  selectMapel.innerHTML = '<option value="">-- Pilih Mapel --</option>';
  if (listMapel && listMapel.length > 0) {
    listMapel.forEach(mapel => {
      const opt = document.createElement('option');
      opt.value = mapel;
      opt.textContent = mapel;
      selectMapel.appendChild(opt);
    });
  }
  
  // Tampilkan riwayat nilai saat ini
  tampilkanRiwayatNilai();
}

// Fungsi Menampilkan Riwayat Nilai pada Tabel
async function tampilkanRiwayatNilai() {
  const tbody = document.getElementById('tabel-riwayat-body');
  const db = await openDB();
  const tx = db.transaction('nilai_offline', 'readonly');
  const store = tx.objectStore('nilai_offline');
  const listNilai = await store.getAll();

  if (listNilai.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Belum ada data tersimpan di HP/Lokal</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  listNilai.reverse().forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.nama_siswa || item.ref_id_siswa}</td>
      <td>${item.mapel}</td>
      <td>${item.jenis_penilaian}</td>
      <td><strong>${item.nilai}</strong></td>
      <td><span style="color: ${item.synced ? 'green' : 'orange'}; font-weight: bold;">${item.synced ? 'Tersinkron' : 'Lokal (Offline)'}</span></td>
    `;
    tbody.appendChild(tr);
  });
}