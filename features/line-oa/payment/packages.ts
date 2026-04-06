/** Fixed credit packages available for LINE PromptPay top-up */
export interface CreditPackage {
  id: string;
  nameTh: string;
  amountThb: number;
  credits: number;
  /** e.g. "฿100 → 500 เครดิต" */
  label: string;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'pkg_100',
    nameTh: 'แพ็กเกจเริ่มต้น',
    amountThb: 100,
    credits: 500,
    label: '฿100 → 500 เครดิต',
  },
  {
    id: 'pkg_300',
    nameTh: 'แพ็กเกจมาตรฐาน',
    amountThb: 300,
    credits: 1800,
    label: '฿300 → 1,800 เครดิต (ประหยัด 20%)',
  },
  {
    id: 'pkg_500',
    nameTh: 'แพ็กเกจคุ้มค่า',
    amountThb: 500,
    credits: 3500,
    label: '฿500 → 3,500 เครดิต (ประหยัด 30%)',
  },
  {
    id: 'pkg_1000',
    nameTh: 'แพ็กเกจธุรกิจ',
    amountThb: 1000,
    credits: 8000,
    label: '฿1,000 → 8,000 เครดิต (ประหยัด 38%)',
  },
];

export function getPackageById(id: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((p) => p.id === id);
}

/** Format package list for LINE text message */
export function formatPackageMenu(): string {
  const lines = CREDIT_PACKAGES.map((p, i) => `${i + 1}. ${p.label}`);
  return [
    '💳 เติมเครดิต Vaja AI',
    '',
    'เลือกแพ็กเกจที่ต้องการ:',
    ...lines,
    '',
    'พิมพ์ตัวเลข (1-4) เพื่อเลือกแพ็กเกจ',
  ].join('\n');
}
