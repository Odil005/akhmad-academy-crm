import { useEffect, useState } from "react";
import QRCode from "qrcode";

export type ReceiptData = {
  payment: {
    id: string;
    amount: number;
    subtotal: number | null;
    discount_amount: number | null;
    total_amount: number | null;
    payment_method: string | null;
    period_month: string;
    paid_at: string | null;
    created_at: string;
    fiscal_status: string;
  };
  receipt: {
    receipt_number: string | null;
    fiscal_sign: string | null;
    fiscal_qr_data: string | null;
    receipt_url: string | null;
    cashbox_id: string | null;
    test_mode: boolean;
    provider_name: string;
    created_at: string;
  } | null;
  org: {
    company_name: string | null;
    company_tin: string | null;
    branch_address: string | null;
    vat_enabled: boolean | null;
    vat_percent: number | null;
  } | null;
  studentName: string;
  courseName: string;
  cashierName: string;
};

const METHOD_LABEL: Record<string, string> = {
  cash: "Naqd", card: "Bank kartasi", qr: "QR to'lov", transfer: "Bank o'tkazmasi",
};

const fmt = (n: number | null | undefined) => Number(n ?? 0).toLocaleString("uz-UZ");

function Qr({ value }: { value: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, { margin: 0, width: 320, errorCorrectionLevel: "M" })
      .then((d) => { if (alive) setSrc(d); })
      .catch(() => { if (alive) setSrc(null); });
    return () => { alive = false; };
  }, [value]);
  if (!src) return null;
  return <img src={src} alt="Fiskal QR-kod" className="receipt-qr" width={140} height={140} />;
}

/** 80 mm thermal receipt layout. Wrapped in `.receipt-80` for print CSS. */
export function ReceiptView({ data }: { data: ReceiptData }) {
  const { payment, receipt, org } = data;
  const isFiscal = payment.fiscal_status === "fiscalized" && !!receipt && !receipt.test_mode;
  const date = new Date(receipt?.created_at ?? payment.paid_at ?? payment.created_at);
  const total = Number(payment.total_amount || payment.amount);
  const vatPercent = Number(org?.vat_percent ?? 12);
  const vatAmount = org?.vat_enabled ? Math.round((total * vatPercent) / (100 + vatPercent)) : 0;

  return (
    <div className="receipt-80 mx-auto w-[80mm] max-w-full bg-white p-3 font-mono text-[11px] leading-tight text-black">
      <div className="text-center">
        <div className="text-[15px] font-bold tracking-wide">AKHMAD ACADEMY</div>
        <div className="text-[10px]">{org?.company_name ?? "AKHMAD ACADEMY"}</div>
        {org?.company_tin && <div className="text-[10px]">STIR: {org.company_tin}</div>}
        {org?.branch_address && <div className="text-[10px]">{org.branch_address}</div>}
      </div>

      {!isFiscal && (
        <div className="my-2 border border-black p-1 text-center text-[11px] font-bold">
          {receipt?.test_mode ? "TEST CHEK — FISKAL EMAS" : "FISKAL CHEK EMAS"}
        </div>
      )}

      <div className="my-2 border-t border-dashed border-black" />

      <Row k="Chek raqami" v={receipt?.receipt_number ?? payment.id.slice(0, 8).toUpperCase()} />
      <Row k="Sana / vaqt" v={date.toLocaleString("uz-UZ")} />
      <Row k="O'quvchi" v={data.studentName} />
      <Row k="Kurs" v={data.courseName} />
      <Row k="To'lov davri" v={new Date(payment.period_month).toLocaleDateString("uz-UZ", { year: "numeric", month: "long" })} />
      <Row k="Xizmat" v="Ta'lim xizmati" />
      <Row k="To'lov turi" v={METHOD_LABEL[payment.payment_method ?? "cash"] ?? "—"} />

      <div className="my-2 border-t border-dashed border-black" />

      <Row k="Summa" v={`${fmt(payment.subtotal || payment.amount)} so'm`} />
      {Number(payment.discount_amount ?? 0) > 0 && <Row k="Chegirma" v={`-${fmt(payment.discount_amount)} so'm`} />}
      <div className="mt-1 flex justify-between text-[13px] font-bold">
        <span>JAMI</span><span>{fmt(total)} so'm</span>
      </div>
      {org?.vat_enabled && <Row k={`QQS ${vatPercent}%`} v={`${fmt(vatAmount)} so'm`} />}

      <div className="my-2 border-t border-dashed border-black" />

      <Row k="Kassa" v={receipt?.cashbox_id ?? "—"} />
      <Row k="Kassir" v={data.cashierName} />
      {receipt?.fiscal_sign && (
        <div className="mt-1 break-all text-center text-[11px] font-bold">
          Fiskal belgi: {receipt.fiscal_sign}
        </div>
      )}

      {isFiscal && receipt?.fiscal_qr_data ? (
        <div className="mt-2 flex flex-col items-center gap-1">
          <Qr value={receipt.fiscal_qr_data} />
          <div className="text-center text-[10px]">
            QR-kodni <b>Soliq</b> ilovasida skaner qiling — 1% keshbek uchun belgilangan
            muddat ichida ro'yxatdan o'tkazing.
          </div>
        </div>
      ) : (
        <div className="mt-2 text-center text-[10px]">
          Rasmiy fiskal QR-kod mavjud emas.
        </div>
      )}

      <div className="mt-3 text-center text-[10px]">Rahmat! Akhmad Academy</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="shrink-0">{k}:</span>
      <span className="text-right font-semibold">{v}</span>
    </div>
  );
}
