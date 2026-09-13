export class CommandError extends Error {
  code: string; status: number
  constructor(code: string, status = 409) { super(code); this.code=code; this.status=status }
}
