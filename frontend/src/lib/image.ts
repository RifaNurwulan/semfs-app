const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp']
export const AVATAR_ACCEPT = ACCEPTED.join(',')
const MAX_SOURCE_BYTES = 8 * 1024 * 1024

/**
 * Potong foto jadi persegi (bagian tengah) lalu perkecil ke size x size dan simpan sebagai JPEG.
 * Hasilnya kecil (puluhan KB) dan data lokasi/EXIF di foto asli otomatis hilang.
 */
export async function squareAvatarBlob(file: File, size = 256): Promise<Blob> {
  if (!ACCEPTED.includes(file.type)) throw new Error('Format foto harus PNG, JPG, atau WebP')
  if (file.size > MAX_SOURCE_BYTES) throw new Error('Ukuran foto terlalu besar (maksimal 8 MB)')

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('File tidak bisa dibaca sebagai gambar')
  }

  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Browser tidak mendukung pemrosesan gambar')
  }
  ctx.fillStyle = '#ffffff' // latar putih untuk PNG transparan
  ctx.fillRect(0, 0, size, size)
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  if (!blob) throw new Error('Gagal memproses foto')
  return blob
}
