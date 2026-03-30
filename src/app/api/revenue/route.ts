import { NextResponse } from "next/server";

const RAILWAY_URL = process.env.RAILWAY_DASHBOARD_URL;

export async function GET() {
  if (!RAILWAY_URL) {
    return NextResponse.json({ error: "Missing RAILWAY_DASHBOARD_URL" }, { status: 500 });
  }

  try {
    const [dashResult, fxResult] = await Promise.allSettled([
      fetch(RAILWAY_URL, { cache: "no-store" }),
      fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" }),
    ]);

    if (dashResult.status !== "fulfilled" || !dashResult.value.ok) {
      return NextResponse.json({ error: "Railway fetch failed" }, { status: 502 });
    }

    const data = await dashResult.value.json();
    const licenses: Array<{ amount: number; currency: string }> = data.licenses ?? [];

    // Live INR/USD rate (fallback to 83 if FX fetch fails)
    let inrRate = 83;
    if (fxResult.status === "fulfilled" && fxResult.value.ok) {
      const fx = await fxResult.value.json();
      if (fx?.rates?.INR) inrRate = fx.rates.INR;
    }

    let revenueUSD = 0;
    for (const lic of licenses) {
      const amountMajor = lic.amount / 100; // paise/cents to major unit
      if (lic.currency === "USD") {
        revenueUSD += amountMajor;
      } else if (lic.currency === "INR") {
        revenueUSD += amountMajor / inrRate;
      }
    }

    return NextResponse.json({
      revenue: Math.round(revenueUSD * 100) / 100,
      sales: data.total_licenses ?? 0,
      activated: data.total_activations ?? 0,
      inrRate,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
