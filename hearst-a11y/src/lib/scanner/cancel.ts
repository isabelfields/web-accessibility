export type ScanCancellationCheck = () => boolean | Promise<boolean>

export class ScanCancelledError extends Error {
  constructor(message = 'Scan cancelled') {
    super(message)
    this.name = 'ScanCancelledError'
  }
}

export async function throwIfScanCancelled(shouldCancel?: ScanCancellationCheck): Promise<void> {
  if (shouldCancel && await shouldCancel()) {
    throw new ScanCancelledError()
  }
}
