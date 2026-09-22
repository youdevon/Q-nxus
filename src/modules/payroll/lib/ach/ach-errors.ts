export class AchRecordValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AchRecordValidationError";
  }
}
