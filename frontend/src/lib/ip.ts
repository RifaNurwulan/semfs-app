const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/

/** Pemeriksaan awal di browser. Server tetap yang menentukan (pesan SRS: "Format IP Invalid"). */
export function isValidIp(value: string): boolean {
  const v = value.trim()
  if (IPV4.test(v)) return true
  if (!v.includes(':') || /[\s/?#@]/.test(v)) return false
  try {
    new URL(`http://[${v}]/`)
    return true
  } catch {
    return false
  }
}
