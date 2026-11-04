/**
 * Valores em ETH trafegam como strings decimais ("1.19") e são calculados em wei (bigint)
 * para evitar erros de ponto flutuante. Compartilhado entre app e mock server.
 */
const DECIMALS = 18
const UNIT = 10n ** BigInt(DECIMALS)

export function toWei(value: string): bigint {
  const trimmed = value.trim()
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) throw new Error(`Valor ETH inválido: ${value}`)
  const negative = trimmed.startsWith('-')
  const [int, frac = ''] = trimmed.replace('-', '').split('.')
  const wei = BigInt(int) * UNIT + BigInt((frac + '0'.repeat(DECIMALS)).slice(0, DECIMALS))
  return negative ? -wei : wei
}

export function fromWei(wei: bigint, minDecimals = 2): string {
  const negative = wei < 0n
  const abs = negative ? -wei : wei
  const int = abs / UNIT
  let frac = (abs % UNIT).toString().padStart(DECIMALS, '0').replace(/0+$/, '')
  if (frac.length < minDecimals) frac = frac.padEnd(minDecimals, '0')
  return `${negative ? '-' : ''}${int}${frac ? `.${frac}` : ''}`
}

export function addEth(...values: string[]): string {
  return fromWei(values.reduce((acc, v) => acc + toWei(v), 0n))
}

export function subEth(a: string, b: string): string {
  return fromWei(toWei(a) - toWei(b))
}

export function mulEth(value: string, qty: number): string {
  if (!Number.isInteger(qty)) throw new Error('Quantidade deve ser inteira')
  return fromWei(toWei(value) * BigInt(qty))
}

/** Aplica percentual inteiro (ex.: 10 => 10%). */
export function percentEth(value: string, percent: number): string {
  return fromWei((toWei(value) * BigInt(Math.round(percent * 100))) / 10000n)
}

export function compareEth(a: string, b: string): number {
  const d = toWei(a) - toWei(b)
  return d === 0n ? 0 : d > 0n ? 1 : -1
}

export function formatEth(value: string): string {
  return `${value} ETH`
}
