// Kop surat SMP Negeri 36 Bandung.
// Satu sumber untuk semua dokumen yang diunduh atau dicetak dari aplikasi.
// Ubah alamat, email, atau logo di sini saja — semua file unduhan ikut berubah.

export const KOP = {
  pemerintah: 'PEMERINTAH KOTA BANDUNG',
  sekolah: 'SMP NEGERI 36 BANDUNG',
  alamat: 'Jalan. Caringin Babakan Ciparay Telp. (022) 6078507 Bandung 40223',
  email: 'email : infosmpn36_bandung@yahoo.com / smpnegeri36bandung@gmail.com',
} as const

// Lambang Kota Bandung (PNG 109x90) — diambil dari file kop_smp36.docx
const LOGO_PNG_BASE64 =
  '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'
export const LOGO_DATA_URL = `data:image/png;base64,${LOGO_PNG_BASE64}`

// ───────────────────────── Kop untuk Cetak / PDF (HTML) ─────────────────────────

export function kopHtml(): string {
  return `
    <div style="display:flex;align-items:center;gap:12px;border-bottom:3px solid #000;padding-bottom:6px;margin-bottom:14px;font-family:'Times New Roman',Times,serif;color:#000">
      <img src="${LOGO_DATA_URL}" alt="" style="width:80px;height:auto;flex:none" />
      <div style="flex:1;text-align:center;line-height:1.3">
        <div style="font-size:15px">${KOP.pemerintah}</div>
        <div style="font-size:19px;font-weight:bold">${KOP.sekolah}</div>
        <div style="font-size:11px">${KOP.alamat}</div>
        <div style="font-size:11px">${KOP.email}</div>
      </div>
      <div style="width:80px;flex:none"></div>
    </div>`
}

// ───────────────────────────── Kop untuk file Excel ─────────────────────────────

type Sel = string | number | null | undefined

export type OpsiExcelBerKop = {
  /** Isi dokumen di bawah kop. Baris pertama biasanya judul. */
  rows: Sel[][]
  sheetName: string
  fileName: string
  /** Lebar kolom, format sama seperti ws['!cols'] milik SheetJS. */
  cols?: { wch: number }[]
  /**
   * Jumlah baris awal dari `rows` yang dijadikan judul (rata tengah, memanjang selebar tabel).
   * Hanya untuk baris yang isinya satu sel saja. Default 1.
   */
  titleRows?: number
}

const TIPE_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function unduhBlob(blob: Blob, namaFile: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = namaFile
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function bangunExcelDenganLogo(opsi: OpsiExcelBerKop): Promise<Blob> {
  const { rows, sheetName, cols, titleRows = 1 } = opsi
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import('exceljs')
  const ExcelJS = mod.default ?? mod

  const wb = new ExcelJS.Workbook()
  wb.creator = 'SMP Negeri 36 Bandung'
  const ws = wb.addWorksheet(sheetName)

  const lebarIsi = rows.reduce((maks, r) => Math.max(maks, r.length), 0)
  const jmlKolom = Math.max(6, cols?.length ?? 0, lebarIsi)
  for (let i = 0; i < jmlKolom; i++) ws.getColumn(i + 1).width = cols?.[i]?.wch ?? 12

  // Kop: 4 baris teks (rata tengah selebar tabel) + garis tebal + 1 baris kosong
  const barisKop = [
    { teks: KOP.pemerintah, ukuran: 12, tebal: false, tinggi: 17 },
    { teks: KOP.sekolah, ukuran: 15, tebal: true, tinggi: 21 },
    { teks: KOP.alamat, ukuran: 9, tebal: false, tinggi: 14 },
    { teks: KOP.email, ukuran: 9, tebal: false, tinggi: 14 },
  ]
  barisKop.forEach((b, i) => {
    const r = i + 1
    ws.mergeCells(r, 1, r, jmlKolom)
    const sel = ws.getCell(r, 1)
    sel.value = b.teks
    sel.font = { name: 'Times New Roman', size: b.ukuran, bold: b.tebal }
    sel.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(r).height = b.tinggi
  })
  ws.getRow(5).height = 4
  for (let c = 1; c <= jmlKolom; c++) ws.getCell(5, c).border = { top: { style: 'thick' } }

  const logoId = wb.addImage({ base64: LOGO_DATA_URL, extension: 'png' })
  ws.addImage(logoId, { tl: { col: 0.1, row: 0.1 }, ext: { width: 60, height: 50 } })

  // Isi dokumen mulai baris 7
  const awal = 7
  rows.forEach((baris, i) => {
    baris.forEach((nilai, j) => {
      if (nilai !== '' && nilai !== null && nilai !== undefined) ws.getCell(awal + i, j + 1).value = nilai
    })
  })
  for (let i = 0; i < Math.min(titleRows, rows.length); i++) {
    const r = awal + i
    ws.mergeCells(r, 1, r, jmlKolom)
    const sel = ws.getCell(r, 1)
    sel.font = { size: 12, bold: i === 0 }
    sel.alignment = { horizontal: 'center' }
  }

  const buffer = await wb.xlsx.writeBuffer()
  return new Blob([buffer], { type: TIPE_XLSX })
}

// Cadangan: kalau pembuatan file dengan logo gagal, unduhan tetap jalan (kop teks saja, tanpa logo).
async function simpanExcelCadangan({ rows, sheetName, fileName, cols }: OpsiExcelBerKop) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import('xlsx')
  const XLSX = mod.utils ? mod : mod.default
  const kop = [[KOP.pemerintah], [KOP.sekolah], [KOP.alamat], [KOP.email], ['']]
  const ws = XLSX.utils.aoa_to_sheet([...kop, ...rows])
  if (cols) ws['!cols'] = cols
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, fileName)
}

export async function simpanExcelBerKop(opsi: OpsiExcelBerKop): Promise<void> {
  let blob: Blob | null = null
  try {
    blob = await bangunExcelDenganLogo(opsi)
  } catch (err) {
    console.error('[kop-sekolah] gagal membuat Excel dengan logo, memakai cadangan tanpa logo:', err)
  }
  if (blob) {
    unduhBlob(blob, opsi.fileName)
    return
  }
  await simpanExcelCadangan(opsi)
}
