export interface NormalizedTxn {
  externalId: string;
  startedAt: Date;
  completedAt: Date | null;
  amountNative: number;
  feeNative: number;
  currency: string;
  state: "pending" | "completed" | "reverted" | "declined" | "failed";
  descriptionRaw: string;
  typeRaw: string;
  productRaw: string;
  runningBalanceNative: number | null;
}

export interface AccountHint {
  currency: string;
  product: string;
  externalAccountId: string;
  suggestedName: string;
  suggestedKind: "cash" | "investment";
  isLiquid: boolean;
}

export interface ParsedRow {
  txn: NormalizedTxn;
  accountHint: AccountHint;
}

export interface ParseRejection {
  rowIndex: number;
  rawRow: Record<string, unknown>;
  reason: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  rejections: ParseRejection[];
}

export interface Source {
  readonly kind: "revolut_csv";
  parse(buffer: Buffer): ParseResult;
}
